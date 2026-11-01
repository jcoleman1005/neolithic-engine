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
const scratchCandidateSlots = new Int32Array(64);

export class Rules {
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
    _config: Readonly<SimulationConfig>,
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
          const loyalty = people.habits[hOff + HABIT_LOYALTY] / 255;
          const pull = 0.8 + 0.8 * loyalty;
          vx += (dx > 0 ? 1 : dx < 0 ? -1 : 0) * pull;
          vy += (dy > 0 ? 1 : dy < 0 ? -1 : 0) * pull;
        }
      } else {
        people.leaderId[slot] = 0;
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
   * Staggered social evaluation: evaluates nearby neighbors and leaders to decide
   * who to follow, and shifts habits towards leaders and thriving peers.
   */
  public static copy(
    slot: number,
    people: People,
    spatial: SpatialIndex,
    config: Readonly<SimulationConfig>,
    _prng: PRNG
  ): void {
    const px = people.x[slot];
    const py = people.y[slot];
    const maxEnergy = config.maxEnergy ?? 100.0;
    const radius = config.leaderSearchRadius ?? 6;
    const stickiness = config.habitStickiness ?? 0.9;
    const hOff = slot * HABIT_COUNT;

    // Calculate self attractiveness
    const selfScore = Rules.scoreAttraction(slot, slot, people, config, maxEnergy);

    // Collect nearby candidate slots
    let candidateCount = 0;
    spatial.query(px, py, radius, (otherSlot) => {
      if (otherSlot !== slot && candidateCount < scratchCandidateSlots.length) {
        scratchCandidateSlots[candidateCount++] = otherSlot;
      }
    });

    let bestScore = selfScore;
    let bestSlot = slot;

    // Loyalty threshold: must beat self/current leader by loyalty margin
    const loyalty = people.habits[hOff + HABIT_LOYALTY] / 255;
    const loyaltyMargin = 0.15 + 0.35 * loyalty;

    for (let i = 0; i < candidateCount; i++) {
      const cSlot = scratchCandidateSlots[i];
      const score = Rules.scoreAttraction(slot, cSlot, people, config, maxEnergy);
      if (score > bestScore * (1 + loyaltyMargin)) {
        bestScore = score;
        bestSlot = cSlot;
      }
    }

    // Update leader
    if (bestSlot !== slot) {
      people.leaderId[slot] = people.idOf(bestSlot);
      // Cultural learning: shift habits towards leader
      const targetHOff = bestSlot * HABIT_COUNT;
      for (let h = 0; h < HABIT_COUNT; h++) {
        const cur = people.habits[hOff + h];
        const tgt = people.habits[targetHOff + h];
        const shifted = Math.round(cur * stickiness + tgt * (1.0 - stickiness));
        people.habits[hOff + h] = Math.max(0, Math.min(255, shifted));
      }
    } else {
      // Self-led: clear leader ID
      people.leaderId[slot] = 0;
    }
  }

  /**
   * Evaluates how attractive targetSlot is as a leader to observerSlot.
   * Multi-attribute utility: strength, charisma, energy wealth, kin, wisdom, bravery.
   * Modulated by observer's own personality (greed values wealth, piety values devotion/wisdom).
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
   * Rule 3: Touch
   * Evaluates close-range physical contact between co-located people:
   * - Sharing food/energy with hungry kin or allies.
   * - Clash/border friction between hostile or belligerent non-allies.
   */
  public static touch(
    slotA: number,
    slotB: number,
    people: People,
    land: Land,
    fields: ScentFields,
    ledger: EnergyLedger,
    config: Readonly<SimulationConfig>,
    prng: PRNG
  ): void {
    if (people.alive[slotA] === 0 || people.alive[slotB] === 0) return;

    const leaderA = people.leaderId[slotA];
    const leaderB = people.leaderId[slotB];
    const idA = people.idOf(slotA);
    const idB = people.idOf(slotB);

    const isAllied =
      (leaderA !== 0 && leaderA === leaderB) ||
      people.motherId[slotA] === idB ||
      people.fatherId[slotA] === idB ||
      people.motherId[slotB] === idA ||
      people.fatherId[slotB] === idA;

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
    if (isAllied || generosityA > 160 || generosityB > 160) {
      // Check if A can give to hungry B
      if (people.energy[slotA] > reproThreshold && people.energy[slotB] < reproThreshold * 0.5) {
        const gift = Math.min(shareAmt, people.energy[slotA] - minSurplus);
        if (gift > 0) {
          people.energy[slotA] -= gift;
          people.energy[slotB] += gift;
          // Internal transfer leaves ledger residual unchanged
          return;
        }
      }
      // Check if B can give to hungry A
      if (people.energy[slotB] > reproThreshold && people.energy[slotA] < reproThreshold * 0.5) {
        const gift = Math.min(shareAmt, people.energy[slotB] - minSurplus);
        if (gift > 0) {
          people.energy[slotB] -= gift;
          people.energy[slotA] += gift;
          return;
        }
      }
    }

    // 2. Clash / Dispute
    // If not allied, check belligerence and cruelty
    if (!isAllied) {
      const bellA = people.habits[hOffA + HABIT_BELLIGERENCE] + people.genes[gOffA + GENE_CRUELTY];
      const bellB = people.habits[hOffB + HABIT_BELLIGERENCE] + people.genes[gOffB + GENE_CRUELTY];

      if (bellA > 180 || bellB > 180) {
        const clashCost = config.clashEnergyCost ?? 1.0;
        const px = people.x[slotA];
        const py = people.y[slotA];

        // Deduct energy & book to ledger
        people.energy[slotA] -= clashCost;
        ledger.attack += clashCost;
        if (people.energy[slotA] <= 0) {
          if (people.energy[slotA] < 0) {
            ledger.overdraft += -people.energy[slotA];
          }
          fields.depositDanger(px, py, config.scentDangerDeath ?? 10.0);
          people.kill(slotA);
        }

        people.energy[slotB] -= clashCost;
        ledger.attack += clashCost;
        if (people.energy[slotB] <= 0) {
          if (people.energy[slotB] < 0) {
            ledger.overdraft += -people.energy[slotB];
          }
          fields.depositDanger(px, py, config.scentDangerDeath ?? 10.0);
          people.kill(slotB);
        }

        // Deposit danger scent at clash site
        fields.depositDanger(px, py, config.scentDangerClash ?? 5.0);

        // Retreat weaker/less brave participant if still alive
        if (people.alive[slotA] === 1 && people.alive[slotB] === 1) {
          const braA = people.genes[gOffA + GENE_BRAVERY];
          const braB = people.genes[gOffB + GENE_BRAVERY];
          const retreatSlot = braA < braB ? slotA : slotB;
          Rules.retreatStep(retreatSlot, people, land, prng);
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
