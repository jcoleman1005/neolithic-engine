import type { SimulationConfig } from './types';
import {
  type People,
  GENE_STRENGTH,
  GENE_BRAVERY,
  GENE_GREED,
  GENE_PIETY,
  GENE_CHARISMA,
  GENE_CURIOSITY,
  GENE_WISDOM,
  GENE_CRUELTY,
  GENE_COUNT,
  HABIT_FORAGE,
  HABIT_CAUTION,
  HABIT_GENEROSITY,
  HABIT_BELLIGERENCE,
  HABIT_ROAMING,
  HABIT_LOYALTY,
  HABIT_COUNT,
  slotFromId,
  genFromId,
  GEN_MASK,
} from './people';
import type { Land } from './land';
import { wrapDiff } from './land';
import type { ScentFields } from './fields';
import type { SpatialIndex } from './spatial';
import type { EnergyLedger } from './ledger';
import type { PRNG } from './prng';

// Preallocated scratch arrays for zero allocations in hot loops
const scratchGradFood = new Float32Array(2);
const scratchGradDanger = new Float32Array(2);

export interface ClashStats {
  strangers: number;
  sameBand: number;
  leaderFollower: number;
  kin: number;
}

/** Observer counts of belligerent non-allied encounters, binned by habit distance (Agent rule 11) */
export interface CultureStats {
  distanceBins: number[]; // 20 bins over 0..1
  tolerated: number;
  contested: number;
}

/**
 * Observer ring of recent clashes between different bands, drained by the chronicle.
 * Fixed typed arrays, no allocation; overwrites the oldest when full (Agent rules 7 and 11).
 */
export const CLASH_RING = 8192;
export class ClashLog {
  /** Root leader (or the person alone) of the side that won the clash. */
  public readonly winner = new Uint32Array(CLASH_RING);
  /** Root leader (or the person alone) of the side that lost. */
  public readonly loser = new Uint32Array(CLASH_RING);
  /** 1 when the loser died in the clash. */
  public readonly fell = new Uint8Array(CLASH_RING);
  public readonly x = new Uint8Array(CLASH_RING);
  public readonly y = new Uint8Array(CLASH_RING);
  /** Total clashes ever pushed; entry n lives at index n % CLASH_RING. */
  public head = 0;

  public push(winner: number, loser: number, fell: number, x: number, y: number): void {
    const i = this.head % CLASH_RING;
    this.winner[i] = winner;
    this.loser[i] = loser;
    this.fell[i] = fell;
    this.x[i] = x;
    this.y[i] = y;
    this.head++;
  }
}

export class Rules {
  public static clashLog = new ClashLog();

  public static cultureStats: CultureStats = {
    distanceBins: new Array(20).fill(0),
    tolerated: 0,
    contested: 0,
  };

  public static resetCultureStats(): void {
    Rules.cultureStats.distanceBins.fill(0);
    Rules.cultureStats.tolerated = 0;
    Rules.cultureStats.contested = 0;
  }

  /** Mean absolute habit difference, normalised to 0..1 */
  public static habitDistance(slotA: number, slotB: number, people: People): number {
    const a = slotA * HABIT_COUNT;
    const b = slotB * HABIT_COUNT;
    let sum = 0;
    for (let h = 0; h < HABIT_COUNT; h++) {
      const d = people.habits[a + h] - people.habits[b + h];
      sum += d < 0 ? -d : d;
    }
    return sum / (HABIT_COUNT * 255);
  }

  /** Nudge one habit by delta, clamped to 0..255. */
  public static nudgeHabit(people: People, slot: number, habit: number, delta: number): void {
    const i = slot * HABIT_COUNT + habit;
    const v = people.habits[i] + delta;
    people.habits[i] = v < 0 ? 0 : v > 255 ? 255 : v;
  }

  /** Hunger raises forage and roaming; plenty lowers them (small steps, config.ts). */
  public static experienceNeeds(slot: number, people: People, config: Readonly<SimulationConfig>): void {
    const maxE = config.maxEnergy ?? 100.0;
    const e = people.energy[slot] / maxE;
    if (e < (config.habitHungerEnergy ?? 0.25)) {
      const step = config.habitHungerStep ?? 1;
      Rules.nudgeHabit(people, slot, HABIT_FORAGE, step);
      Rules.nudgeHabit(people, slot, HABIT_ROAMING, step);
    } else if (e > (config.habitFedEnergy ?? 0.75)) {
      const step = -(config.habitFedStep ?? 1);
      Rules.nudgeHabit(people, slot, HABIT_FORAGE, step);
      Rules.nudgeHabit(people, slot, HABIT_ROAMING, step);
    }
  }

  /** Observer tracking of physical clashes by relationship (Agent rule 11) */
  public static clashStats: ClashStats = {
    strangers: 0,
    sameBand: 0,
    leaderFollower: 0,
    kin: 0,
  };

  public static resetClashStats(): void {
    Rules.clashStats.strangers = 0;
    Rules.clashStats.sameBand = 0;
    Rules.clashStats.leaderFollower = 0;
    Rules.clashStats.kin = 0;
  }
  /**
   * Rule 1: Climb
   * Determines movement direction based on food scent gradient, danger scent aversion,
   * leader pull, and curiosity exploration jitter.
   * Returns cardinal direction (0=East, 1=West, 2=South, 3=North) or 4=Stay.
   */
  public static climb(
    slot: number,
    people: People,
    land: Land,
    fields: ScentFields,
    config: Readonly<SimulationConfig>,
    prng: PRNG
  ): number {
    const px = people.x[slot];
    const py = people.y[slot];
    const gOff = slot * GENE_COUNT;
    const hOff = slot * HABIT_COUNT;

    // Scent gradients
    fields.getFoodGradient(px, py, scratchGradFood);
    fields.getDangerGradient(px, py, scratchGradDanger);

    const caution = people.habits[hOff + HABIT_CAUTION] / 255;
    const bravery = people.genes[gOff + GENE_BRAVERY] / 255;
    const curiosity = people.genes[gOff + GENE_CURIOSITY] / 255;
    const roaming = people.habits[hOff + HABIT_ROAMING] / 255;
    const forageTenacity = people.habits[hOff + HABIT_FORAGE] / 255;

    // Danger aversion factor: caution increases aversion, bravery reduces it
    const dangerAversion = Math.max(0, caution * 1.5 - bravery * 0.5);

    const foodWeight = 1.0 + 0.5 * forageTenacity;
    let vx = scratchGradFood[0] * foodWeight - scratchGradDanger[0] * dangerAversion;
    let vy = scratchGradFood[1] * foodWeight - scratchGradDanger[1] * dangerAversion;

    // Leader pull
    let leaderPulling = false;
    const lId = people.leaderId[slot];
    if (lId !== 0) {
      const lSlot = slotFromId(lId);
      const lGen = genFromId(lId);
      if (
        lSlot < people.capacity &&
        people.alive[lSlot] === 1 &&
        (people.slotGenerations[lSlot] & GEN_MASK) === lGen
      ) {
        const dx = wrapDiff(people.x[lSlot], px);
        const dy = wrapDiff(people.y[lSlot], py);
        const distSq = dx * dx + dy * dy;
        // Pull if leader is not right on the same tile
        if (distSq > 1) {
          leaderPulling = true;
          const loyalty = people.genes[gOff + GENE_CHARISMA] / 255; // personal devotion
          const pull = 0.8 + 0.8 * loyalty;
          vx += (dx > 0 ? 1 : dx < 0 ? -1 : 0) * pull;
          vy += (dy > 0 ? 1 : dy < 0 ? -1 : 0) * pull;
        }
      } else {
        people.leaderId[slot] = 0;
      }
    }

    // Thirst: a person low on water heads for the nearest fresh water (down the distance map),
    // and stays put once beside it to drink.
    if (config.finiteResourcesEnabled !== false && config.thirstEnabled !== false && people.hydration[slot] < (config.thirstSeek ?? 60)) {
      const here = land.waterDist[(py << 8) | px];
      if (here <= 1) return 4;
      if (here < 255) {
        let best = 4;
        let bestD = here;
        for (let d = 0; d < 4; d++) {
          const nx = d === 0 ? (px + 1) & 0xff : d === 1 ? (px - 1) & 0xff : px;
          const ny = d === 2 ? (py + 1) & 0xff : d === 3 ? (py - 1) & 0xff : py;
          const nd = land.waterDist[(ny << 8) | nx];
          if (nd < bestD && Rules.canStep(px, py, d, land)) { best = d; bestD = nd; }
        }
        if (best !== 4) return best;
      }
    }

    // Cold: a fed person in the cold heads for the nearest cave or fire and stays once sheltered.
    if (config.coldEnabled !== false && people.energy[slot] >= (config.coldSeekEnergy ?? 0.5) * (config.maxEnergy ?? 100)) {
      const here = (py << 8) | px;
      if (land.coldAt(here) > 0.2) {
        if (land.sheltered(here)) return 4;
        const hd = land.warmDist[here];
        if (hd < 255) {
          let best = 4;
          let bestD = hd;
          for (let d = 0; d < 4; d++) {
            const nx = d === 0 ? (px + 1) & 0xff : d === 1 ? (px - 1) & 0xff : px;
            const ny = d === 2 ? (py + 1) & 0xff : d === 3 ? (py - 1) & 0xff : py;
            const nd = land.warmDist[(ny << 8) | nx];
            if (nd < bestD && Rules.canStep(px, py, d, land)) { best = d; bestD = nd; }
          }
          if (best !== 4) return best;
        }
      }
    }

    // Calm movement: a person on a rich enough tile stays and grazes, unless a leader is
    // pulling them along. Hungry people want a richer tile before they settle for it.
    const calm = config.calmMovementEnabled ?? true;
    if (calm && !leaderPulling) {
      const cell = (py << 8) | px;
      const max = land.capacityAt(cell, config);
      if (max > 0) {
        const hungry = people.energy[slot] < (config.habitHungerEnergy ?? 0.25) * (config.maxEnergy ?? 100);
        const need = (config.stayFoodFraction ?? 0.5) * (hungry ? 1 + (config.hungerStayPenalty ?? 0.5) : 1);
        if (land.food[cell] >= need * max) return 4;
      }
    }

    // Roaming / curiosity jitter
    const exploreChance = (curiosity + roaming) * 0.2;
    if (prng.next() < exploreChance) {
      const jDir = prng.nextInt(0, 4);
      if (jDir === 0) vx += 0.8;
      else if (jDir === 1) vx -= 0.8;
      else if (jDir === 2) vy += 0.8;
      else if (jDir === 3) vy -= 0.8;
    }

    // If movement desire is negligible, stay
    if (Math.abs(vx) < 0.05 && Math.abs(vy) < 0.05) {
      return 4; // Stay
    }

    // Try primary and secondary directions based on vector magnitudes
    const absX = Math.abs(vx);
    const absY = Math.abs(vy);

    let primaryDir = -1;
    let secondaryDir = -1;

    if (absX >= absY) {
      primaryDir = vx > 0 ? 0 : 1; // East or West
      secondaryDir = vy !== 0 ? (vy > 0 ? 2 : 3) : -1;
    } else {
      primaryDir = vy > 0 ? 2 : 3; // South or North
      secondaryDir = vx !== 0 ? (vx > 0 ? 0 : 1) : -1;
    }

    // Calm movement: no stepping straight back unless the pull is strong; sidestep or stay.
    if (calm && people.prevDir[slot] < 4 && primaryDir === (people.prevDir[slot] ^ 1)
        && Math.max(absX, absY) < (config.reversalOverride ?? 1.5)) {
      if (secondaryDir !== -1 && Rules.canStep(px, py, secondaryDir, land)) return secondaryDir;
      return 4;
    }

    // Check if primary direction is land (not water)
    if (Rules.canStep(px, py, primaryDir, land)) {
      return primaryDir;
    }

    // If primary is water, try secondary
    if (secondaryDir !== -1 && Rules.canStep(px, py, secondaryDir, land)) {
      return secondaryDir;
    }

    // Both blocked or water: stay
    return 4;
  }

  private static canStep(x: number, y: number, dir: number, land: Land): boolean {
    let nx = x;
    let ny = y;
    if (dir === 0) nx = (x + 1) & 0xff;
    else if (dir === 1) nx = (x - 1) & 0xff;
    else if (dir === 2) ny = (y + 1) & 0xff;
    else if (dir === 3) ny = (y - 1) & 0xff;
    else return true;

    return !land.isWaterAt(nx, ny);
  }

  /**
   * Rule 2: Copy
   * Staggered social evaluation: evaluates nearby neighbors without directional bias
   * or heap closures (Agent rule 7). Incumbency bonus applies to current leader / self.
   * Other candidates are compared with a plain `>`.
   */
  public static copy(
    slot: number,
    people: People,
    spatial: SpatialIndex,
    config: Readonly<SimulationConfig>,
    prng: PRNG
  ): void {
    const px = people.x[slot];
    const py = people.y[slot];
    const maxEnergy = config.maxEnergy ?? 100.0;
    const radius = config.leaderSearchRadius ?? 6;
    const stickiness = config.habitStickiness ?? 0.9;
    const incumbency = config.incumbencyBonus ?? 0.35;
    const rSq = radius * radius;
    const side = 2 * radius + 1;

    // Self attractiveness
    const selfScore = Rules.scoreAttraction(slot, slot, people, config, maxEnergy);

    // Calculate incumbency threshold
    const curLeaderId = people.leaderId[slot];
    let thresholdToBeat = selfScore * (1 + incumbency);

    if (curLeaderId !== 0 && people.isValidId(curLeaderId)) {
      const curLeaderSlot = slotFromId(curLeaderId);
      const curScore = Rules.scoreAttraction(slot, curLeaderSlot, people, config, maxEnergy);
      thresholdToBeat = curScore * (1 + incumbency);
    }

    let bestCandidateScore = -1;
    let bestCandidateSlot = -1;

    // Remove directional bias: start scan at a randomized offset within the search square
    const startY = prng.nextInt(0, side);
    const startX = prng.nextInt(0, side);

    const cellStarts = spatial.cellStarts;
    const cellPeople = spatial.cellPeople;

    for (let stepY = 0; stepY < side; stepY++) {
      const dy = ((startY + stepY) % side) - radius;
      const y = (py + dy) & 255;
      const row = y << 8;

      for (let stepX = 0; stepX < side; stepX++) {
        const dx = ((startX + stepX) % side) - radius;
        if (dx * dx + dy * dy > rSq) continue;

        const x = (px + dx) & 255;
        const cell = row | x;
        const start = cellStarts[cell];
        const end = cellStarts[cell + 1];

        for (let idx = start; idx < end; idx++) {
          const otherSlot = cellPeople[idx];
          if (otherSlot === slot || people.alive[otherSlot] === 0) continue;

          const score = Rules.scoreAttraction(slot, otherSlot, people, config, maxEnergy);
          // Compare candidates to each other with a plain >
          if (score > bestCandidateScore) {
            bestCandidateScore = score;
            bestCandidateSlot = otherSlot;
          }
        }
      }
    }

    // Incumbency check: candidate must beat the incumbent threshold
    if (bestCandidateSlot !== -1 && bestCandidateScore > thresholdToBeat) {
      people.leaderId[slot] = people.idOf(bestCandidateSlot);
      // Cultural learning: shift habits towards leader
      const targetHOff = bestCandidateSlot * HABIT_COUNT;
      const hOff = slot * HABIT_COUNT;
      for (let h = 0; h < HABIT_COUNT; h++) {
        const cur = people.habits[hOff + h];
        const tgt = people.habits[targetHOff + h];
        const shifted = Math.round(cur * stickiness + tgt * (1.0 - stickiness));
        people.habits[hOff + h] = Math.max(0, Math.min(255, shifted));
      }
    } else if (curLeaderId === 0 || !people.isValidId(curLeaderId)) {
      people.leaderId[slot] = 0;
    }
  }

  /**
   * Evaluates how attractive targetSlot is as a leader to observerSlot.
   * Multi-attribute utility: strength, charisma, energy wealth, kin, wisdom, bravery.
   */
  public static scoreAttraction(
    observerSlot: number,
    targetSlot: number,
    people: People,
    config: Readonly<SimulationConfig>,
    maxEnergy: number
  ): number {
    const adultAge = config.adultAge ?? 5760;
    const targetAge = people.age[targetSlot];
    const isAdult = targetAge >= adultAge;

    // Children are generally not followed by adults
    if (!isAdult && people.age[observerSlot] >= adultAge) {
      return 0.1;
    }

    const tGOff = targetSlot * GENE_COUNT;
    const str = people.genes[tGOff + GENE_STRENGTH] / 255;
    const cha = people.genes[tGOff + GENE_CHARISMA] / 255;
    const wis = people.genes[tGOff + GENE_WISDOM] / 255;
    const bra = people.genes[tGOff + GENE_BRAVERY] / 255;
    const pie = people.genes[tGOff + GENE_PIETY] / 255;
    const nrg = Math.max(0, people.energy[targetSlot]) / maxEnergy;

    // Observer personality modifiers
    const oGOff = observerSlot * GENE_COUNT;
    const obsGreed = people.genes[oGOff + GENE_GREED] / 255;
    const obsPiety = people.genes[oGOff + GENE_PIETY] / 255;

    // Base utility with configurable weights
    const wStr = config.leaderWeightStrength ?? 1.0;
    const wCha = config.leaderWeightCharisma ?? 1.0;
    const wE = config.leaderWeightEnergy ?? 1.0;
    const wWis = config.leaderWeightWisdom ?? 1.0;
    const wBra = config.leaderWeightBravery ?? 1.0;
    const wKin = config.leaderWeightKin ?? 1.0;

    const energyVal = nrg * wE * (0.6 + 0.8 * obsGreed);
    const wisdomVal = (wis + pie * 0.5) * wWis * (0.6 + 0.8 * obsPiety);

    let score = str * wStr + cha * wCha + energyVal + wisdomVal + bra * wBra;

    // Kinship bonus
    if (observerSlot !== targetSlot) {
      const obsMother = people.motherId[observerSlot];
      const obsFather = people.fatherId[observerSlot];
      const targetId = people.idOf(targetSlot);
      if (obsMother === targetId || obsFather === targetId) {
        score += wKin * 0.5;
      }
    }

    return Math.max(0.01, score);
  }

  /**
   * Comprehensive ally predicate.
   * Allied if A follows B or B follows A, they share a root leader,
   * are mates, are maternal siblings, or are parent and child.
   */
  public static isAllied(slotA: number, slotB: number, people: People): boolean {
    const idA = people.idOf(slotA);
    const idB = people.idOf(slotB);
    const leaderA = people.leaderId[slotA];
    const leaderB = people.leaderId[slotB];

    // 1. A follows B or B follows A
    if (leaderA === idB || leaderB === idA) return true;

    // 2. Share a root leader
    const rootA = people.rootLeaderId[slotA];
    const rootB = people.rootLeaderId[slotB];
    if (rootA !== 0 && rootA === rootB) return true;

    // 3. Mates
    if (people.mateId[slotA] === idB || people.mateId[slotB] === idA) return true;

    // 4. Maternal siblings
    const momA = people.motherId[slotA];
    if (momA > 0 && momA === people.motherId[slotB]) return true;

    // 5. Parent and child
    if (
      momA === idB ||
      people.fatherId[slotA] === idB ||
      people.motherId[slotB] === idA ||
      people.fatherId[slotB] === idA
    ) {
      return true;
    }

    return false;
  }

  /**
   * Counts nearby allies within 1 cell without heap allocations.
   */
  public static countNearbyAllies(
    slot: number,
    cx: number,
    cy: number,
    people: People,
    spatial: SpatialIndex
  ): number {
    let allies = 0;
    const cellStarts = spatial.cellStarts;
    const cellPeople = spatial.cellPeople;

    for (let dy = -1; dy <= 1; dy++) {
      const y = (cy + dy) & 255;
      const row = y << 8;
      for (let dx = -1; dx <= 1; dx++) {
        const x = (cx + dx) & 255;
        const cell = row | x;
        const start = cellStarts[cell];
        const end = cellStarts[cell + 1];
        for (let i = start; i < end; i++) {
          const other = cellPeople[i];
          if (other !== slot && people.alive[other] === 1 && Rules.isAllied(slot, other, people)) {
            allies++;
          }
        }
      }
    }
    return allies;
  }

  /**
   * Pairs everyone in a crowded cell in rotating/random order so all co-located
   * people are evaluated fairly.
   */
  public static touchCell(
    start: number,
    count: number,
    cellPeople: Uint32Array,
    people: People,
    land: Land,
    fields: ScentFields,
    spatial: SpatialIndex,
    ledger: EnergyLedger,
    config: Readonly<SimulationConfig>,
    prng: PRNG,
    tick: number
  ): void {
    if (count < 2) return;

    // Rotating offset to vary pairing order across ticks
    const rot = (tick + start) % count;

    for (let i = 0; i + 1 < count; i += 2) {
      const idxA = start + ((rot + i) % count);
      const idxB = start + ((rot + i + 1) % count);
      const slotA = cellPeople[idxA];
      const slotB = cellPeople[idxB];
      Rules.touch(slotA, slotB, people, land, fields, spatial, ledger, config, prng);
    }
  }

  /**
   * Rule 3: Touch
   * Evaluates close-range physical contact between co-located people:
   * - Sharing food/energy with hungry kin or allies (zero-sum internal transfer).
   * - Decisive combat clashes between belligerent non-allies.
   */
  public static touch(
    slotA: number,
    slotB: number,
    people: People,
    land: Land,
    fields: ScentFields,
    spatial: SpatialIndex,
    ledger: EnergyLedger,
    config: Readonly<SimulationConfig>,
    prng: PRNG
  ): void {
    if (people.alive[slotA] === 0 || people.alive[slotB] === 0) return;

    const allied = Rules.isAllied(slotA, slotB, people);

    const hOffA = slotA * HABIT_COUNT;
    const hOffB = slotB * HABIT_COUNT;
    const gOffA = slotA * GENE_COUNT;
    const gOffB = slotB * GENE_COUNT;

    const generosityA = people.habits[hOffA + HABIT_GENEROSITY];
    const generosityB = people.habits[hOffB + HABIT_GENEROSITY];
    const minSurplus = config.shareEnergyMinSurplus ?? 15.0;
    const shareAmt = config.shareEnergyAmount ?? 5.0;
    const reproThreshold = config.reproductionThreshold ?? 65.0;

    // 1. Sharing
    if (allied || generosityA > 160 || generosityB > 160) {
      // Check if A can give to hungry B
      if (people.energy[slotA] > reproThreshold && people.energy[slotB] < reproThreshold * 0.5) {
        const gift = Math.min(shareAmt, people.energy[slotA] - minSurplus);
        if (gift > 0) {
          people.energy[slotA] -= gift;
          people.energy[slotB] += gift;
          if (config.experienceHabitsEnabled ?? true) {
            const hs = config.habitHelpStep ?? 3;
            Rules.nudgeHabit(people, slotB, HABIT_GENEROSITY, hs);
            Rules.nudgeHabit(people, slotB, HABIT_LOYALTY, hs);
          }
          return;
        }
      }
      // Check if B can give to hungry A
      if (people.energy[slotB] > reproThreshold && people.energy[slotA] < reproThreshold * 0.5) {
        const gift = Math.min(shareAmt, people.energy[slotB] - minSurplus);
        if (gift > 0) {
          people.energy[slotB] -= gift;
          people.energy[slotA] += gift;
          if (config.experienceHabitsEnabled ?? true) {
            const hs = config.habitHelpStep ?? 3;
            Rules.nudgeHabit(people, slotA, HABIT_GENEROSITY, hs);
            Rules.nudgeHabit(people, slotA, HABIT_LOYALTY, hs);
          }
          return;
        }
      }
    }

    // 2. Decisive Clash
    if (!allied) {
      const bellA = people.habits[hOffA + HABIT_BELLIGERENCE] + people.genes[gOffA + GENE_CRUELTY];
      const bellB = people.habits[hOffB + HABIT_BELLIGERENCE] + people.genes[gOffB + GENE_CRUELTY];

      if (bellA > 180 || bellB > 180) {
        // Culture similarity: near habits tolerate; far habits clash with rising chance
        if (config.cultureTouchEnabled ?? true) {
          const dist = Rules.habitDistance(slotA, slotB, people);
          const bin = Math.min(19, Math.floor(dist * 20));
          Rules.cultureStats.distanceBins[bin]++;
          const threshold = config.cultureToleranceThreshold ?? 0.08;
          if (dist <= threshold) {
            Rules.cultureStats.tolerated++;
            return;
          }
          const slope = config.cultureClashSlope ?? 4.0;
          if (prng.next() >= Math.min(1, slope * (dist - threshold))) {
            Rules.cultureStats.tolerated++;
            return;
          }
          Rules.cultureStats.contested++;
        }

        const idA = people.idOf(slotA);
        const idB = people.idOf(slotB);
        const leaderA = people.leaderId[slotA];
        const leaderB = people.leaderId[slotB];
        const rootA = people.rootLeaderId[slotA];
        const rootB = people.rootLeaderId[slotB];

        if (leaderA === idB || leaderB === idA) {
          Rules.clashStats.leaderFollower++;
        } else if (rootA !== 0 && rootA === rootB) {
          Rules.clashStats.sameBand++;
        } else if (
          people.mateId[slotA] === idB ||
          people.motherId[slotA] === idB ||
          people.fatherId[slotA] === idB ||
          people.motherId[slotB] === idA ||
          people.fatherId[slotB] === idA ||
          (people.motherId[slotA] !== 0 && people.motherId[slotA] === people.motherId[slotB])
        ) {
          Rules.clashStats.kin++;
        } else {
          Rules.clashStats.strangers++;
        }

        const px = people.x[slotA];
        const py = people.y[slotA];

        // Combat scores: strength + nearby allies + PRNG noise
        const alliesA = Rules.countNearbyAllies(slotA, px, py, people, spatial);
        const alliesB = Rules.countNearbyAllies(slotB, px, py, people, spatial);
        const strA = people.genes[gOffA + GENE_STRENGTH] / 255;
        const strB = people.genes[gOffB + GENE_STRENGTH] / 255;

        const scoreA = strA * 10 + alliesA * 3 + prng.next() * 2;
        const scoreB = strB * 10 + alliesB * 3 + prng.next() * 2;

        const winnerSlot = scoreA >= scoreB ? slotA : slotB;
        const loserSlot = winnerSlot === slotA ? slotB : slotA;

        // Energy mechanics: loser loses share, winner takes most, remainder struggle waste
        const lossShare = config.clashLossShare ?? 0.25;
        const lootEfficiency = config.clashLootEfficiency ?? 0.8;
        const maxEnergy = config.maxEnergy ?? 100.0;

        let loserLoss = people.energy[loserSlot] * lossShare;
        if (loserLoss < 0.5) {
          loserLoss = Math.min(people.energy[loserSlot], 0.5);
        }
        loserLoss = Math.min(people.energy[loserSlot], loserLoss);
        const rawLoot = loserLoss * lootEfficiency;
        const actualLoot = Math.min(rawLoot, Math.max(0, maxEnergy - people.energy[winnerSlot]));
        const struggleWaste = loserLoss - actualLoot;

        people.energy[loserSlot] -= loserLoss;
        people.energy[winnerSlot] += actualLoot;
        ledger.attack += struggleWaste;

        if (config.experienceHabitsEnabled ?? true) {
          Rules.nudgeHabit(people, winnerSlot, HABIT_BELLIGERENCE, config.habitWinStep ?? 3);
          Rules.nudgeHabit(people, loserSlot, HABIT_BELLIGERENCE, -(config.habitLoseStep ?? 3));
        }

        const loserFell = people.energy[loserSlot] <= 0;
        if ((config.chronicleEnabled ?? true) && rootA !== rootB) {
          // Observer only: who beat whom, and whether the loser died.
          const wRoot = winnerSlot === slotA ? (rootA !== 0 ? rootA : idA) : rootB !== 0 ? rootB : idB;
          const lRoot = winnerSlot === slotA ? (rootB !== 0 ? rootB : idB) : rootA !== 0 ? rootA : idA;
          Rules.clashLog.push(wRoot, lRoot, loserFell ? 1 : 0, px, py);
        }

        if (loserFell) {
          if (people.energy[loserSlot] < 0) {
            ledger.overdraft += -people.energy[loserSlot];
          }
          fields.depositDanger(px, py, config.scentDangerDeath ?? 10.0);
          people.kill(loserSlot);
        } else {
          fields.depositDanger(px, py, config.scentDangerClash ?? 5.0);
          Rules.retreatStep(loserSlot, people, land, prng);
        }
      }
    }
  }

  private static retreatStep(slot: number, people: People, land: Land, prng: PRNG): void {
    const px = people.x[slot];
    const py = people.y[slot];
    const rDir = prng.nextInt(0, 4);
    let nx = px;
    let ny = py;
    if (rDir === 0) nx = (px + 1) & 0xff;
    else if (rDir === 1) nx = (px - 1) & 0xff;
    else if (rDir === 2) ny = (py + 1) & 0xff;
    else if (rDir === 3) ny = (py - 1) & 0xff;

    if (!land.isWaterAt(nx, ny)) {
      people.x[slot] = nx;
      people.y[slot] = ny;
    }
  }
}
