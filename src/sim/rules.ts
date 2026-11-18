import { CONTEST_CONCEDE, CONTEST_FIGHT, CONTEST_YIELD } from './protocol';
import { act, ACT_FIGHT, ACT_YIELD } from './activity';
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
  stageWork,
  CARRY_WATER,
  CARRY_EARTH,
  maxCarryCapacity,
  CARRY_NONE,
  CARRY_SEED,
  CARRY_FOOD,
  CARRY_BRUSH,
  CARRY_STONE,
} from './people';
import type { Land } from './land';
import { FORM_NEST } from './land';
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
  /** S3x contest: neither side thought a fight worth it. */
  declined: number;
  /** S3x contest: the defender gave way (stepped off, or conceded food). */
  yields: number;
  /** S3x concession: of the yields, those where the defender stayed and the other took food away. */
  concessions: number;
  /** Fights actually fought. */
  fights: number;
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
    declined: 0,
    yields: 0,
    concessions: 0,
    fights: 0,
  };

  public static resetClashStats(): void {
    Rules.clashStats.strangers = 0;
    Rules.clashStats.sameBand = 0;
    Rules.clashStats.leaderFollower = 0;
    Rules.clashStats.kin = 0;
    Rules.clashStats.declined = 0;
    Rules.clashStats.yields = 0;
    Rules.clashStats.concessions = 0;
    Rules.clashStats.fights = 0;
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
    prng: PRNG,
    crowdHere = 1
  ): number {
    const px = people.x[slot];
    const py = people.y[slot];
    const gOff = slot * GENE_COUNT;
    const hOff = slot * HABIT_COUNT;

    // Scent gradients
    fields.getFoodGradient(px, py, scratchGradFood);
    if (config.shoreScentEnabled !== false) {
      // W1a shore fix: scent drifts over water, but nobody can walk there. A water neighbour counts as
      // this tile's own scent, so the slope never points into a river or lake.
      const fc = fields.foodCurrent;
      const isW = land.isWater;
      const row = py << 8;
      const own = fc[row | px];
      const e = row | ((px + 1) & 0xff), wst = row | ((px - 1) & 0xff);
      const s = (((py + 1) & 0xff) << 8) | px, n = (((py - 1) & 0xff) << 8) | px;
      scratchGradFood[0] = (isW[e] === 1 ? own : fc[e]) - (isW[wst] === 1 ? own : fc[wst]);
      scratchGradFood[1] = (isW[s] === 1 ? own : fc[s]) - (isW[n] === 1 ? own : fc[n]);
    }
    fields.getDangerGradient(px, py, scratchGradDanger);

    const caution = people.habits[hOff + HABIT_CAUTION] / 255;
    const bravery = people.genes[gOff + GENE_BRAVERY] / 255;
    const curiosity = people.genes[gOff + GENE_CURIOSITY] / 255;
    const roaming = people.habits[hOff + HABIT_ROAMING] / 255;
    const forageTenacity = people.habits[hOff + HABIT_FORAGE] / 255;

    // Danger aversion factor: caution increases aversion, bravery reduces it
    let dangerAversion = Math.max(0, caution * 1.5 - bravery * 0.5);

    let foodWeight = 1.0 + 0.5 * forageTenacity;
    let leaderPullMul = 1.0;
    let suppressRoam = false;
    let searching = false;

    // Primitive 18: Hunger drive - chosen from body state
    const drivesOn = config.bodyDrivesEnabled !== false;
    if (drivesOn) {
      const maxE = config.maxEnergy ?? 100;
      const curE = people.energy[slot];
      const hungerThreshold = (config.hungerDriveThreshold ?? 0.35) * maxE;
      if (curE < hungerThreshold) {
        // HUNGER DRIVE dominates: food gradient is amplified
        const hungerWeightMul = config.hungerFoodWeightMul ?? 2.5;
        foodWeight *= hungerWeightMul;
        leaderPullMul = config.hungerLeaderPullMul ?? 0.25;

        // Shore test 1: with nothing better to smell, a hungry person searches: keeps going the
        // way they were heading, and roams rather than stalling.
        if (config.hungerSearchEnabled !== false) {
          // Searching starts when the ground around is poor, not when the scent is flat: plants
          // give off scent almost everywhere, so a flat-scent test hardly ever fired.
          const f = land.food;
          const row = py << 8;
          const around = (f[row | px] + f[row | ((px + 1) & 0xff)] + f[row | ((px - 1) & 0xff)] +
            f[(((py + 1) & 0xff) << 8) | px] + f[(((py - 1) & 0xff) << 8) | px]) / 5;
          searching = around < (config.hungerSearchFood ?? 6);
        }

        // When critically hungry, suppress curiosity/roaming jitter and reduce danger aversion
        const critHungerThreshold = (config.criticalHungerThreshold ?? 0.20) * maxE;
        if (curE < critHungerThreshold) {
          suppressRoam = !searching;
          // Starving people risk danger for food, unless wounds and a defeat have made them afraid (S3x).
          if (!(config.fearWoundsEnabled !== false && config.fearEnabled !== false && people.fear[slot] > 0)) dangerAversion *= 0.5;
        }
      }
    }

    let vx = scratchGradFood[0] * foodWeight - scratchGradDanger[0] * dangerAversion;
    let vy = scratchGradFood[1] * foodWeight - scratchGradDanger[1] * dangerAversion;

    // S2: lean toward the more worn neighbour, so used routes reinforce themselves.
    if (config.pathsEnabled !== false) {
      const pull = (config.pathPull ?? 0.3) / 255;
      const wear = land.wear;
      const row = py << 8;
      vx += (wear[row | ((px + 1) & 0xff)] - wear[row | ((px - 1) & 0xff)]) * pull;
      vy += (wear[(((py + 1) & 0xff) << 8) | px] - wear[(((py - 1) & 0xff) << 8) | px]) * pull;
    }

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
          const pull = (0.8 + 0.8 * loyalty) * leaderPullMul;
          vx += (dx > 0 ? 1 : dx < 0 ? -1 : 0) * pull;
          vy += (dy > 0 ? 1 : dy < 0 ? -1 : 0) * pull;
        }
      } else {
        people.leaderId[slot] = 0;
      }
    }

    // Thirst: a person low on water heads for the nearest fresh water (down the distance map),
    // and stays put once beside it to drink.
    const carriedWater = config.waterCarryEnabled !== false && config.stockpilesEnabled !== false;
    // S3w: someone carrying water drinks from it instead of walking to the river.
    const hasWater = carriedWater && people.carryKind[slot] === CARRY_WATER && people.carry[slot] > 0;
    if (config.finiteResourcesEnabled !== false && config.thirstEnabled !== false && !hasWater && people.hydration[slot] < (config.thirstSeek ?? 60)) {
      const cellHere = (py << 8) | px;
      // Rivers and stores alike are drunk from on or beside them.
      if (land.waterDist[cellHere] <= 1 || (carriedWater && land.waterInReach(px, py))) return 4;
      const dist = carriedWater ? land.drinkDist : land.waterDist;
      const here = dist[cellHere];
      // The walk back: remember where thirst found them (far enough out to be worth remembering). Someone
      // who turns thirsty again on the way back keeps the place they were heading for.
      if (config.thirstReturnEnabled !== false) {
        if (people.homeState[slot] === 2) people.homeState[slot] = 1;
        else if (people.homeState[slot] === 0 && here < 255 && here >= (config.thirstReturnMinDist ?? 3)) {
          people.homeX[slot] = px;
          people.homeY[slot] = py;
          people.homeState[slot] = 1;
        }
      }
      if (here < 255) {
        let best = 4;
        let bestD = here;
        for (let d = 0; d < 4; d++) {
          const nx = d === 0 ? (px + 1) & 0xff : d === 1 ? (px - 1) & 0xff : px;
          const ny = d === 2 ? (py + 1) & 0xff : d === 3 ? (py - 1) & 0xff : py;
          const nd = dist[(ny << 8) | nx];
          if (nd < bestD && Rules.canStep(px, py, d, land)) { best = d; bestD = nd; }
        }
        if (best !== 4) return best;
      }
    }

    // The walk back after drinking: drink up beside the water, then head straight for the remembered place.
    if (config.thirstReturnEnabled !== false && people.homeState[slot] !== 0) {
      let st = people.homeState[slot];
      if (st === 1) {
        if (people.hydration[slot] >= (config.thirstReturnHydration ?? 90)) {
          st = 2;
          people.homeTicks[slot] = Math.min(255, config.thirstReturnTicks ?? 200);
        } else if (land.waterDist[(py << 8) | px] <= 1 || (carriedWater && land.waterInReach(px, py))) {
          return 4; // still drinking
        } else {
          st = 0; // watered some other way (a carried skin): nothing to walk back from
        }
      }
      if (st === 2) {
        const dx = wrapDiff(people.homeX[slot], px);
        const dy = wrapDiff(people.homeY[slot], py);
        const ax = dx < 0 ? -dx : dx, ay = dy < 0 ? -dy : dy;
        if ((ax <= 1 && ay <= 1) || people.homeTicks[slot] === 0) {
          st = 0;
        } else {
          people.homeTicks[slot]--;
          const xDir = dx > 0 ? 0 : 1, yDir = dy > 0 ? 2 : 3;
          const first = ax >= ay ? xDir : yDir;
          const second = ax >= ay ? (ay > 0 ? yDir : -1) : (ax > 0 ? xDir : -1);
          if (Rules.canStep(px, py, first, land)) { people.homeState[slot] = 2; return first; }
          if (second !== -1 && Rules.canStep(px, py, second, land)) { people.homeState[slot] = 2; return second; }
          st = 0; // water in the way: give the place up
        }
      }
      people.homeState[slot] = st;
    }

    // Cold: a fed person in the cold heads for the nearest cave or fire and stays once sheltered.
    // S3x: fear is checked before cold, so a shelter inside the feared region does not hold a frightened person.
    const afraid = Rules.inFearRegion(slot, people, config);
    if (!afraid && config.coldEnabled !== false && people.energy[slot] >= (config.coldSeekEnergy ?? 0.5) * (config.maxEnergy ?? 100)) {
      const here = (py << 8) | px;
      // S3x unit A: shelter is weighed, not overridden. While this place costs more than the cold upkeep a
      // shelter saves, the cold rule neither holds them in a shelter nor walks them to one; the ordinary
      // stay check decides.
      if (land.coldAt(here) > 0.2 && Rules.shelterOutweighsCost(slot, here, people, land, config)) {
        if (land.sheltered(here)) {
          return 4;
        } else {
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
    }

    // Calm movement: a person on a rich enough tile stays and grazes, unless a leader is
    // pulling them along. Hungry people want a richer tile before they settle for it.
    const calm = config.calmMovementEnabled ?? true;
    if (calm && config.stayValueEnabled !== false) {
      // S1: the place counts, not just its plants. A heap underfoot is food too, and the food
      // a person needs scales with what it costs to live on this tile. A comfortable person
      // also resists a leader's pull.
      if (!leaderPulling || config.comfortableStayEnabled !== false) {
        if (Rules.worthStaying(slot, people, land, config, crowdHere, roaming, curiosity)) return 4;
      }
    } else if (calm && !leaderPulling) {
      const cell = (py << 8) | px;
      const max = land.capacityAt(cell, config);
      if (max > 0) {
        const hungry = people.energy[slot] < (config.habitHungerEnergy ?? 0.25) * (config.maxEnergy ?? 100);
        const need = (config.stayFoodFraction ?? 0.5) * (hungry ? 1 + (config.hungerStayPenalty ?? 0.5) : 1) * Rules.fearStayMul(slot, people, config)
          * Rules.placeCostStayMul(slot, 1, people, config);
        if (land.food[cell] >= need * max) return 4;
      }
    }

    if (searching && config.farSightEnabled !== false) {
      // Shore test 2: look across the neighbouring blocks for richer land and lean toward the best.
      const bx = px >> 4, by = py >> 4;
      const own = land.blockFood[by * 16 + bx];
      let best = own * (1 + (config.farSightMargin ?? 0.2)), bdx = 0, bdy = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const f = land.blockFood[((by + dy) & 15) * 16 + ((bx + dx) & 15)];
          if (f > best) { best = f; bdx = dx; bdy = dy; }
        }
      }
      const pull = config.farSightPull ?? 1.0;
      vx += bdx * pull;
      vy += bdy * pull;
    }
    if (searching) {
      const d = people.prevDir[slot];
      const keep = config.hungerSearchPersist ?? 1.2;
      if (d === 0) vx += keep;
      else if (d === 1) vx -= keep;
      else if (d === 2) vy += keep;
      else if (d === 3) vy -= keep;
    }

    // S3x: a frightened person is pushed straight away from where they were beaten, at full
    // strength until they are out of the region. Wounds make the push stronger.
    let awayX = 0, awayY = 0;
    if (afraid) {
      awayX = wrapDiff(px, people.fearX[slot]);
      awayY = wrapDiff(py, people.fearY[slot]);
      if (awayX === 0 && awayY === 0) {
        // On the centre itself: carry on the way they were heading, else east. No random draw.
        const d = people.prevDir[slot];
        awayX = d === 0 ? 1 : d === 1 ? -1 : d === 4 ? 1 : 0;
        awayY = d === 2 ? 1 : d === 3 ? -1 : 0;
      }
      let push = (config.fearPush ?? 2.0) * (people.fear[slot] / 255);
      if (config.fearWoundsEnabled !== false) push *= 1 + (config.fearWoundMul ?? 1.0) * (people.injury[slot] / 255);
      vx += (awayX > 0 ? 1 : awayX < 0 ? -1 : 0) * push;
      vy += (awayY > 0 ? 1 : awayY < 0 ? -1 : 0) * push;
    }

    // Roaming / curiosity jitter
    const exploreChance = (drivesOn && suppressRoam) ? 0
      : searching ? Math.max((curiosity + roaming) * 0.2, config.hungerSearchExplore ?? 0.6)
      : (curiosity + roaming) * 0.2;
    if (prng.next() < exploreChance) {
      const jDir = prng.nextInt(0, 4);
      if (jDir === 0) vx += 0.8;
      else if (jDir === 1) vx -= 0.8;
      else if (jDir === 2) vy += 0.8;
      else if (jDir === 3) vy -= 0.8;
    }

    // Gentle hearth / campfire attraction: resting or idle individuals in camps lean towards nearby warmth/shelter
    if (config.hearthGatheringEnabled !== false && !searching && !afraid) {
      const here = (py << 8) | px;
      if (Rules.shelterOutweighsCost(slot, here, people, land, config)) {
        const hd = land.warmDist[here];
        if (hd > 0 && hd <= (config.hearthGatherRadius ?? 6)) {
          let bestDir = -1;
          let bestD = hd;
          for (let d = 0; d < 4; d++) {
            const nx = d === 0 ? (px + 1) & 0xff : d === 1 ? (px - 1) & 0xff : px;
            const ny = d === 2 ? (py + 1) & 0xff : d === 3 ? (py - 1) & 0xff : py;
            const nd = land.warmDist[(ny << 8) | nx];
            if (nd < bestD && Rules.canStep(px, py, d, land)) {
              bestD = nd;
              bestDir = d;
            }
          }
          if (bestDir !== -1) {
            const pull = config.hearthGatherPull ?? 0.35;
            if (bestDir === 0) vx += pull;
            else if (bestDir === 1) vx -= pull;
            else if (bestDir === 2) vy += pull;
            else if (bestDir === 3) vy -= pull;
          }
        }
      }
    }

    // Hunters or meat carriers with food heading home: steer back to remembered home camp / hearth
    if (config.pursuitHuntEnabled !== false && people.carryKind[slot] === CARRY_FOOD && people.carry[slot] > 0 && people.homeX[slot] !== 0 && people.homeY[slot] !== 0) {
      const dx = wrapDiff(people.homeX[slot], px);
      const dy = wrapDiff(people.homeY[slot], py);
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        const pull = 0.5;
        if (dx > 0) vx += pull; else if (dx < 0) vx -= pull;
        if (dy > 0) vy += pull; else if (dy < 0) vy -= pull;
      }
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

    // S3x: a frightened person hemmed in by water takes any passable step that is not back toward the centre.
    if (afraid) {
      for (let d = 0; d < 4; d++) {
        const back = (d === 0 && awayX < 0) || (d === 1 && awayX > 0) || (d === 2 && awayY < 0) || (d === 3 && awayY > 0);
        if (!back && d !== primaryDir && d !== secondaryDir && Rules.canStep(px, py, d, land)) return d;
      }
    }

    // W1a shore fix: blocked by water both ways. Step sideways along the shore (keeping the last heading
    // when it is one of the two sideways steps) rather than stand facing the water. No random draw.
    if (config.shoreSlideEnabled !== false) {
      const a = primaryDir < 2 ? 2 : 0;
      const prev = people.prevDir[slot];
      const first = prev === a + 1 ? a + 1 : a;
      const second = first === a ? a + 1 : a;
      if (first !== secondaryDir && Rules.canStep(px, py, first, land)) return first;
      if (second !== secondaryDir && Rules.canStep(px, py, second, land)) return second;
    }

    // Both blocked or water: stay
    return 4;
  }

  /**
   * S1 stay check. Food here (plants plus any heap) against what living here costs: the usual
   * fraction of the tile's capacity, scaled by the upkeep of the tile (a hut or nest, shared when
   * crowded), raised when hungry and for roaming, curious people. A hungry person stays only
   * where there is actually something to eat.
   */
  public static worthStaying(
    slot: number,
    people: People,
    land: Land,
    config: Readonly<SimulationConfig>,
    crowdHere: number,
    roaming: number,
    curiosity: number
  ): boolean {
    const cell = (people.y[slot] << 8) | people.x[slot];
    const plants = land.food[cell];
    const heap = config.stockpilesEnabled === false ? 0
      : config.adjacentStoresEnabled !== false ? land.pileInReach(people.x[slot], people.y[slot]) : land.pile[cell];
    const hungry = people.energy[slot] < (config.habitHungerEnergy ?? 0.25) * (config.maxEnergy ?? 100);
    if (hungry && heap <= 1.0 && plants <= (config.landGrazingFloor ?? 1.0) + 0.5) return false;
    let upkeepShare = 1;
    const n = crowdHere > 1 ? crowdHere : 1;
    if (land.structure[cell] === 1) {
      const room = config.hutCapacity ?? 4;
      const disc = 1 - (config.hutUpkeep ?? 0.5);
      upkeepShare = 1 - disc * (config.tileCrowdingEnabled !== false && n > room ? room / n : 1);
    } else if (config.nestsEnabled !== false && land.form[cell] === FORM_NEST) {
      const room = config.nestCapacity ?? 3;
      const disc = 1 - (config.nestUpkeep ?? 0.7);
      upkeepShare = 1 - disc * (config.tileCrowdingEnabled !== false && n > room ? room / n : 1);
    }
    const max = land.capacityAt(cell, config);
    const ref = max > 0 ? max : config.stayRefFood ?? 10;
    const wander = 1 + (config.roamStayWeight ?? 0.5) * ((roaming + curiosity) / 2 - 0.5) * 2;
    const need = (config.stayFoodFraction ?? 0.5) * upkeepShare * wander * (hungry ? 1 + (config.hungerStayPenalty ?? 0.5) : 1)
      * Rules.fearStayMul(slot, people, config) * Rules.placeCostStayMul(slot, upkeepShare, people, config);
    return plants + heap >= need * ref;
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
    const adultAge = config.adultAge ?? 5760;
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

    let bestCandidateScore = 0;
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
          if (people.age[otherSlot] < adultAge) continue;

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
    } else if (curLeaderId === 0 || !people.isValidId(curLeaderId) || people.age[slotFromId(curLeaderId)] < adultAge) {
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

    // Primitive 24: adultAge gates leader attraction. Non-adults cannot lead.
    if (!isAdult) {
      return 0;
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
   * S3x: a defeat (a lost clash or a wolf bite) frightens only the person who suffered it. A loss
   * near the place of earlier losses stacks and draws the centre toward the new spot; a loss
   * elsewhere starts a new place, keeping half the old fear. No random numbers.
   */
  public static addFear(slot: number, x: number, y: number, people: People, config: Readonly<SimulationConfig>): void {
    if (config.fearEnabled === false) return;
    const add = config.fearPerLoss ?? 60;
    const r = config.fearRadius ?? 8;
    const f = people.fear[slot];
    if (f > 0) {
      const dx = wrapDiff(x, people.fearX[slot]);
      const dy = wrapDiff(y, people.fearY[slot]);
      if (dx * dx + dy * dy <= r * r) {
        const nf = f + add > 255 ? 255 : f + add;
        const w = add / (f + add);
        people.fearX[slot] = (people.fearX[slot] + Math.round(dx * w)) & 0xff;
        people.fearY[slot] = (people.fearY[slot] + Math.round(dy * w)) & 0xff;
        people.fear[slot] = nf;
        return;
      }
      const nf = f * 0.5 + add;
      people.fear[slot] = nf > 255 ? 255 : nf;
    } else {
      people.fear[slot] = add > 255 ? 255 : add;
    }
    people.fearX[slot] = x & 0xff;
    people.fearY[slot] = y & 0xff;
  }

  /** S3x: whether a person stands inside the region they fear. */
  public static inFearRegion(slot: number, people: People, config: Readonly<SimulationConfig>): boolean {
    if (people.fear[slot] <= 0 || config.fearEnabled === false) return false;
    const r = config.fearRadius ?? 8;
    const dx = wrapDiff(people.x[slot], people.fearX[slot]);
    const dy = wrapDiff(people.y[slot], people.fearY[slot]);
    return dx * dx + dy * dy <= r * r;
  }

  /** S3x: how much more food a frightened person needs before a tile is worth staying on (1 = no change). */
  public static fearStayMul(slot: number, people: People, config: Readonly<SimulationConfig>): number {
    if (!Rules.inFearRegion(slot, people, config)) return 1;
    return 1 + (config.fearStayMul ?? 2) * (people.fear[slot] / 255);
  }

  /**
   * S3x unit A, place cost. `amount` is the energy actually lost (positive: a lost clash, a wolf bite)
   * or the loot gained (negative: a won clash). A loss within costRadius of the centre adds and nudges
   * the centre toward the event, weighted by size; a loss farther away starts a new memory there and
   * drops the old one. A win only pays off the region it happens in, and the cost never goes below 0.
   * No random numbers.
   */
  public static addPlaceCost(slot: number, x: number, y: number, amount: number, people: People, config: Readonly<SimulationConfig>): void {
    if (config.placeCostEnabled === false || amount === 0) return;
    const cost = people.placeCost[slot];
    const r = config.costRadius ?? 8;
    const dx = wrapDiff(x, people.costX[slot]);
    const dy = wrapDiff(y, people.costY[slot]);
    const inside = cost > 0 && dx * dx + dy * dy <= r * r;
    if (amount < 0) {
      if (!inside) return;
      const left = cost + amount;
      people.placeCost[slot] = left > 0 ? left : 0;
      return;
    }
    if (inside) {
      const w = amount / (cost + amount);
      people.costX[slot] = (people.costX[slot] + Math.round(dx * w)) & 0xff;
      people.costY[slot] = (people.costY[slot] + Math.round(dy * w)) & 0xff;
      people.placeCost[slot] = cost + amount;
      return;
    }
    people.placeCost[slot] = amount;
    people.costX[slot] = x & 0xff;
    people.costY[slot] = y & 0xff;
  }

  /** S3x unit A: the expected cost a tick of living where the person stands (0 outside their region). */
  public static placeCostUpkeep(slot: number, people: People, config: Readonly<SimulationConfig>): number {
    const cost = people.placeCost[slot];
    if (cost <= 0 || config.placeCostEnabled === false) return 0;
    const r = config.costRadius ?? 8;
    const dx = wrapDiff(people.x[slot], people.costX[slot]);
    const dy = wrapDiff(people.y[slot], people.costY[slot]);
    if (dx * dx + dy * dy > r * r) return 0;
    return cost / (config.costMemoryTicks ?? 360);
  }

  /** S3x unit A: whether the cold upkeep a shelter saves on cell `here` beats the expected cost of this place (true with no cost). */
  public static shelterOutweighsCost(slot: number, here: number, people: People, land: Land, config: Readonly<SimulationConfig>): boolean {
    const pc = Rules.placeCostUpkeep(slot, people, config);
    return pc === 0 || pc < (config.metabolismCost ?? 0.25) * (config.coldUpkeep ?? 0.6) * land.coldAt(here);
  }

  /** S3x unit A: the place cost as a multiplier on the food staying needs (real upkeep plus expected cost, over real upkeep). */
  public static placeCostStayMul(slot: number, upkeepShare: number, people: People, config: Readonly<SimulationConfig>): number {
    const extra = Rules.placeCostUpkeep(slot, people, config);
    if (extra <= 0) return 1;
    const base = (config.metabolismCost ?? 0.25) * (upkeepShare > 0 ? upkeepShare : 1);
    return 1 + extra / base;
  }

  /**
   * S3x contest: is a fight worth it? Each side weighs the food at stake (what they could eat of it,
   * beyond the half they'd get by sharing) against their own estimate of the odds and the real cost
   * of losing (energy, the upkeep of a wound until it heals, and their share of the stake).
   * Belligerence sets risk appetite. Refinements (each with a switch): residents value the stake more;
   * each side judges the odds from their own confidence; close matches cost more.
   * Returns 0 for no fight, 1 for a fight, -1 when A attacks and B gives way, -2 when B attacks and
   * A gives way. No random numbers: the odds of the noisy fight score are computed exactly.
   */
  public static contest(
    slotA: number, slotB: number, fixedA: number, fixedB: number, strA: number, strB: number,
    bellA: number, bellB: number, people: People, land: Land, config: Readonly<SimulationConfig>
  ): number {
    const cell = (people.y[slotA] << 8) | people.x[slotA];
    let stake = land.food[cell] - (config.landGrazingFloor ?? 1.0);
    if (stake < 0) stake = 0;
    if (config.stockpilesEnabled !== false) {
      stake += config.adjacentStoresEnabled !== false ? land.pileInReach(people.x[slotA], people.y[slotA]) : land.pile[cell];
    }
    if (stake <= 0) return 0;
    // Each side's own view of their chance (the noise difference is triangular on -2..2).
    const pA = Rules.winChance(fixedA + Rules.confidenceNow(slotA, people, config) - fixedB);
    const pB = Rules.winChance(fixedB + Rules.confidenceNow(slotB, people, config) - fixedA);
    const maxE = config.maxEnergy ?? 100;
    const lossShare = config.clashLossShare ?? 0.25;
    const lootEff = config.clashLootEfficiency ?? 0.8;
    const hurt = config.clashInjury ?? 60;
    const hurtWin = hurt * (config.clashInjuryWinner ?? 0.25);
    const w = config.contestRiskWeight ?? 0.5;
    // main's strike damage, which a contest fight always carries (there is always a stake).
    const flat = config.resourceClashEnabled !== false ? config.clashFlatDamage ?? 6.0 : 0;
    const resOn = config.residenceEnabled !== false;
    const resTicks = config.residentTicks ?? 10;
    const resMul = config.residentValueMul ?? 1.5;
    const eA = people.energy[slotA] > 0 ? people.energy[slotA] : 0;
    const eB = people.energy[slotB] > 0 ? people.energy[slotB] : 0;
    const headA = maxE - eA > 0 ? maxE - eA : 0;
    const headB = maxE - eB > 0 ? maxE - eB : 0;
    const valA = resOn && people.restTicks[slotA] >= resTicks ? resMul : 1;
    const valB = resOn && people.restTicks[slotB] >= resTicks ? resMul : 1;
    const mulA = Rules.matchMul(pA, config);
    const mulB = Rules.matchMul(pB, config);
    const half = stake * 0.5;
    // What winning adds over sharing, for each side.
    const keepA = valA * (Math.min(stake, headA) - Math.min(half, headA));
    const keepB = valB * (Math.min(stake, headB) - Math.min(half, headB));
    const shareA = valA * Math.min(half, headA);
    const shareB = valB * Math.min(half, headB);
    const drainA = Math.min(eA, (eA * lossShare + flat * (0.5 + 0.5 * strB)) * mulA);
    const drainB = Math.min(eB, (eB * lossShare + flat * (0.5 + 0.5 * strA)) * mulB);
    const lootA = Math.min(Math.min(eB, (eB * lossShare + flat * (0.5 + 0.5 * strA)) * mulA) * lootEff, headA);
    const lootB = Math.min(Math.min(eA, (eA * lossShare + flat * (0.5 + 0.5 * strB)) * mulB) * lootEff, headB);
    // Losing costs energy, a wound, and the share of the stake, since the loser is driven off.
    const lossA = drainA + Rules.woundCost(slotA, hurt * mulA, people, config) + shareA;
    const lossB = drainB + Rules.woundCost(slotB, hurt * mulB, people, config) + shareB;
    const gainA = keepA + lootA - Rules.woundCost(slotA, hurtWin * mulA, people, config);
    const gainB = keepB + lootB - Rules.woundCost(slotB, hurtWin * mulB, people, config);
    const rA = w * (bellA / 255 - 1);
    const rB = w * (bellB / 255 - 1);
    // How far each side's expected fight beats leaving things as they are (sharing).
    const fightA = (1 + rA) * pA * gainA - (1 - rA) * (1 - pA) * lossA;
    const fightB = (1 + rB) * pB * gainB - (1 - rB) * (1 - pB) * lossB;
    const marginA = keepA > 0 ? fightA : -1;
    const marginB = keepB > 0 ? fightB : -1;
    if (marginA <= 0 && marginB <= 0) return 0;
    const aAttacks = marginA >= marginB;
    // The defender fights back if fighting beats giving up their share of the stake.
    if (aAttacks ? fightB > -shareB : fightA > -shareA) return 1;
    return aAttacks ? -1 : -2;
  }

  /** S3x: the tick touches are being judged on, for the confidence fade (set by touchCell). */
  public static nowTick = 0;

  /** S3x self-assessment: a person's current belief in how much stronger they are, faded since it last changed. */
  public static confidenceNow(slot: number, people: People, config: Readonly<SimulationConfig>): number {
    if (config.selfAssessEnabled === false) return 0;
    const c = people.confidence[slot];
    if (c === 0) return 0;
    const dt = Rules.nowTick - people.confTick[slot];
    return dt > 0 ? c * Math.exp(-dt / (config.confFadeTicks ?? 360)) : c;
  }

  /** S3x self-assessment: a win or loss moves belief in one's own strength, clamped to +-confMax. */
  public static shiftConfidence(slot: number, delta: number, people: People, config: Readonly<SimulationConfig>): void {
    const m = config.confMax ?? 5;
    const v = Rules.confidenceNow(slot, people, config) + delta;
    people.confidence[slot] = v > m ? m : v < -m ? -m : v;
    people.confTick[slot] = Rules.nowTick;
  }

  /** S3x match cost: how much of a fight's harm lands, from matchCostFloor (certain outcome) to 1 (even match). */
  public static matchMul(p: number, config: Readonly<SimulationConfig>): number {
    if (config.matchCostEnabled === false) return 1;
    const f = config.matchCostFloor ?? 0.25;
    return f + (1 - f) * (1 - Math.abs(2 * p - 1));
  }

  /**
   * S3x concession (tolerated theft): the one who won the standoff takes food away in hand, from the
   * plants here and then the heaps in reach, up to what they can carry and eat. Plant food is outside
   * the energy ledger until eaten, as with any gathering. Returns how much was taken.
   */
  public static concede(taker: number, people: People, land: Land, config: Readonly<SimulationConfig>): number {
    // Food is only ever carried with stockpiles on; without them the defender steps off instead.
    if (config.stockpilesEnabled === false) return 0;
    const kind = people.carryKind[taker];
    if (kind !== CARRY_NONE && kind !== CARRY_FOOD) return 0;
    const room = maxCarryCapacity(taker, CARRY_FOOD, people, config) - (kind === CARRY_FOOD ? people.carry[taker] : 0);
    const head = (config.maxEnergy ?? 100) - people.energy[taker];
    const want = room < head ? room : head;
    if (want <= 0) return 0;
    const x = people.x[taker], y = people.y[taker];
    let got = land.graze(x, y, want, config, false);
    if (got < want) {
      got += config.adjacentStoresEnabled !== false ? land.takePileInReach(x, y, want - got) : land.takePile(x, y, want - got);
    }
    if (got > 0) {
      people.carry[taker] = (kind === CARRY_FOOD ? people.carry[taker] : 0) + got;
      people.carryKind[taker] = CARRY_FOOD;
    }
    return got;
  }

  /** S3x: chance that the side ahead by d in fixed fight score wins, when each adds noise uniform on 0..2. */
  public static winChance(d: number): number {
    return d <= -2 ? 0 : d >= 2 ? 1 : d < 0 ? ((d + 2) * (d + 2)) / 8 : 1 - ((2 - d) * (2 - d)) / 8;
  }

  /** S3x: the energy a wound of size inj costs in extra upkeep until it heals at this person's current rate. */
  public static woundCost(slot: number, inj: number, people: People, config: Readonly<SimulationConfig>): number {
    if (config.injuryEnabled === false) return 0;
    const maxE = config.maxEnergy ?? 100;
    const heal = config.injuryHeal ?? 0.3;
    const healAbove = (config.injuryHealEnergy ?? 0.5) * maxE;
    const floor = config.healFloor ?? 0.2;
    const e = people.energy[slot] > 0 ? people.energy[slot] : 0;
    const fed = e >= healAbove ? 1 : config.slowHealEnabled !== false ? floor + (1 - floor) * (e / healAbove) : floor;
    const rate = heal * fed;
    // Upkeep falls linearly as the wound heals, so the total is the mean upkeep times the healing time.
    return ((config.metabolismCost ?? 0.25) * (config.injuryUpkeep ?? 0.3) * inj * inj) / (2 * 255 * rate);
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
    Rules.nowTick = tick;
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

    if (config.diseaseEnabled !== false) {
      // Illness passes between people who touch (a hash of both slots and ages: no random draw).
      const sa = people.sick[slotA];
      const sb = people.sick[slotB];
      if ((sa > 0) !== (sb > 0)) {
        const hs = (Math.imul(people.age[slotA] + 3, 2246822519) ^ Math.imul(slotA * 65537 + slotB + 1, 3266489917)) >>> 0;
        if (hs / 4294967296 < (config.sickSpread ?? 0.03)) {
          const ill = sa > 0 ? slotB : slotA;
          people.sick[ill] = config.sickTicks ?? 120;
        }
      }
    }

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

      const resourceOn = config.resourceClashEnabled !== false;
      const px = people.x[slotA];
      const py = people.y[slotA];
      const cell = (py << 8) | px;

      // Competing motivations (Option C):
      // 1. Sustenance / food drive: hunger vs food or carried loot
      const hungerThreshold = config.clashHungerThreshold ?? 35.0;
      const ea = people.energy[slotA];
      const eb = people.energy[slotB];
      const carriesFoodA = people.carryKind[slotA] === CARRY_FOOD && people.carry[slotA] > 0;
      const carriesFoodB = people.carryKind[slotB] === CARRY_FOOD && people.carry[slotB] > 0;
      const hungryA = ea < hungerThreshold;
      const hungryB = eb < hungerThreshold;
      const foodStakes =
        (hungryA && (carriesFoodB || eb > hungerThreshold * 0.5)) ||
        (hungryB && (carriesFoodA || ea > hungerThreshold * 0.5));

      // 2. Contested tile: standing on a food heap / carcass, or crowded shelter in the cold
      const heapStakes = land.pile[cell] > 0.5;
      const coldStakes = (land.sheltered(cell) || land.fire[cell] > 0) && land.coldAt(cell) > 0.2;
      const hasStakes = foodStakes || heapStakes || coldStakes;

      // S3x: with the contest on, it decides below; the gates here apply only with it off.
      const contestOn = config.contestEnabled !== false;
      let willClash: boolean;
      if (contestOn) {
        willClash = true;
      } else if (resourceOn) {
        if (hasStakes) {
          // Competing material interests: lower threshold needed to fight
          const bonus = config.clashContestedResourceBonus ?? 1.5;
          willClash = (bellA * bonus > 180) || (bellB * bonus > 180) || (hungryA && eb > 20) || (hungryB && ea > 20);
        } else {
          // No material stakes: only extreme belligerence/cruelty triggers an unprovoked scuffle
          willClash = bellA > 280 || bellB > 280;
        }
      } else {
        willClash = bellA > 180 || bellB > 180;
      }

      if (willClash) {
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

        // Combat scores: strength + nearby allies + PRNG noise
        const alliesA = Rules.countNearbyAllies(slotA, px, py, people, spatial);
        const alliesB = Rules.countNearbyAllies(slotB, px, py, people, spatial);
        let strA = people.genes[gOffA + GENE_STRENGTH] / 255;
        let strB = people.genes[gOffB + GENE_STRENGTH] / 255;
        if (config.stagesEnabled !== false) {
          const adultAge = config.adultAge ?? 5760;
          const elderAge = Math.floor((config.maxAge ?? 21600) * 0.75);
          strA *= stageWork(people.age[slotA], adultAge, elderAge, config.childWork ?? 0.6, config.elderWork ?? 0.8);
          strB *= stageWork(people.age[slotB], adultAge, elderAge, config.childWork ?? 0.6, config.elderWork ?? 0.8);
        }

        if (contestOn) {
          const fight = Rules.contest(slotA, slotB, strA * 10 + alliesA * 3, strB * 10 + alliesB * 3, strA, strB, bellA, bellB, people, land, config);
          if (fight === 0) { Rules.clashStats.declined++; return; }
          if (fight < 0) {
            Rules.clashStats.yields++;
            // Concession: the defender stays, unhurt, and lets the other take food away in hand.
            // If nothing can be taken (hands full of something else), the defender steps off instead.
            if (config.concedeEnabled !== false && Rules.concede(fight === -1 ? slotA : slotB, people, land, config) > 0) {
              Rules.clashStats.concessions++;
              land.contests.record(px, py, CONTEST_CONCEDE, Rules.nowTick);
              if (config.activityViewEnabled !== false) act(people.activity, fight === -1 ? slotA : slotB, ACT_YIELD);
              return;
            }
            // The defender gives way: steps off the tile unhurt and leaves the stake.
            // Walking away is an ordinary step, paid as one (no sprint, no parting blow: there was no fight).
            const yielder = fight === -1 ? slotB : slotA;
            const step = config.moveCost ?? 0.05;
            people.energy[yielder] -= step;
            ledger.move += step;
            if (people.energy[yielder] < 0) { ledger.overdraft += -people.energy[yielder]; people.energy[yielder] = 0; }
            land.contests.record(px, py, CONTEST_YIELD, Rules.nowTick);
            if (config.activityViewEnabled !== false) act(people.activity, yielder, ACT_YIELD);
            Rules.retreatStep(yielder, people, land, prng);
            return;
          }
        }
        // Primitive 76: Courage / tactical retreat before clash
        if (!contestOn && config.clashCourageEnabled !== false) {
          const powerA = strA * 10 + alliesA * 3;
          const powerB = strB * 10 + alliesB * 3;
          const oddsA = powerA / (powerA + powerB + 0.001);
          const oddsB = 1 - oddsA;

          const braA = people.genes[gOffA + GENE_BRAVERY] / 255;
          const braB = people.genes[gOffB + GENE_BRAVERY] / 255;
          const baseThreshold = config.courageOddsThreshold ?? 0.35;
          const reqOddsA = baseThreshold * Math.max(0.05, 1.2 - braA - (hasStakes ? 0.2 : 0));
          const reqOddsB = baseThreshold * Math.max(0.05, 1.2 - braB - (hasStakes ? 0.2 : 0));

          const retreatA = oddsA < reqOddsA;
          const retreatB = oddsB < reqOddsB;

          if (retreatA || retreatB) {
            const cowardSlot = (retreatA && retreatB) ? (oddsA <= oddsB ? slotA : slotB) : (retreatA ? slotA : slotB);
            const pursuerSlot = cowardSlot === slotA ? slotB : slotA;
            fields.depositDanger(px, py, (config.scentDangerClash ?? 5.0) * 0.5);
            if (config.experienceHabitsEnabled ?? true) {
              Rules.nudgeHabit(people, cowardSlot, HABIT_CAUTION, 1);
            }

            // Tactical retreat physical honesty:
            // 1. Exertion sprint energy cost (booked to ledger.move)
            const retreatMoveCost = (config.moveCost ?? 0.05) * (config.clashRetreatMoveMul ?? 1.5);
            people.energy[cowardSlot] -= retreatMoveCost;
            ledger.move += retreatMoveCost;
            if (people.energy[cowardSlot] < 0) {
              ledger.overdraft += -people.energy[cowardSlot];
              people.energy[cowardSlot] = 0;
            }

            // 2. Adrenaline exhaustion / fatigue spike
            if (config.fatigueEnabled !== false) {
              people.fatigue[cowardSlot] = Math.min(255, people.fatigue[cowardSlot] + (config.clashRetreatFatigue ?? 6));
            }

            // 3. Glancing strike / parting swipe scaled by pursuer's cruelty & belligerence
            if (config.injuryEnabled !== false) {
              const pursuerGOff = pursuerSlot * GENE_COUNT;
              const pursuerHOff = pursuerSlot * HABIT_COUNT;
              const cruelty = people.genes[pursuerGOff + GENE_CRUELTY] / 255;
              const belligerence = people.habits[pursuerHOff + HABIT_BELLIGERENCE] / 255;
              const pursuitUrge = (cruelty + belligerence) * 0.5;
              const baseInjury = config.clashInjury ?? 60;
              const scrape = Math.round(baseInjury * (config.clashRetreatInjuryMul ?? 0.20) * (0.5 + 0.5 * pursuitUrge));
              people.injury[cowardSlot] = Math.min(255, people.injury[cowardSlot] + scrape);
            }

            // 4. Encumbrance panic drop: drop heavy cargo to flee faster
            const dropThreshold = config.clashRetreatDropThreshold ?? 3.0;
            if (people.carryKind[cowardSlot] !== CARRY_NONE && people.carry[cowardSlot] > dropThreshold) {
              Rules.dropCarriedToLand(people.carryKind[cowardSlot], people.carry[cowardSlot], px, py, land, config);
              people.carryKind[cowardSlot] = CARRY_NONE;
              people.carry[cowardSlot] = 0;
            }

            Rules.retreatStep(cowardSlot, people, land, prng);
            return;
          }
        }

        Rules.clashStats.fights++;
        land.contests.record(px, py, CONTEST_FIGHT, Rules.nowTick);
        if (config.activityViewEnabled !== false) {
          act(people.activity, slotA, ACT_FIGHT);
          act(people.activity, slotB, ACT_FIGHT);
        }
        const scoreA = strA * 10 + alliesA * 3 + prng.next() * 2;
        const scoreB = strB * 10 + alliesB * 3 + prng.next() * 2;
        // S3x: a contest fight always has a stake, so main's strike damage and lethal collapse apply;
        // close matches cost more (true odds, not either side's belief).
        const stakesHere = hasStakes || contestOn;
        const harm = contestOn ? Rules.matchMul(Rules.winChance(strA * 10 + alliesA * 3 - (strB * 10 + alliesB * 3)), config) : 1;

        const winnerSlot = scoreA >= scoreB ? slotA : slotB;
        const loserSlot = winnerSlot === slotA ? slotB : slotA;
        const winnerStr = winnerSlot === slotA ? strA : strB;

        // Energy mechanics: loser loses share, winner takes most, remainder struggle waste
        const lossShare = config.clashLossShare ?? 0.25;
        const lootEfficiency = config.clashLootEfficiency ?? 0.8;
        const maxEnergy = config.maxEnergy ?? 100.0;

        let loserLoss = people.energy[loserSlot] * lossShare * harm;
        if (resourceOn) {
          if (stakesHere) {
            // Flat damage from strike, scaled by winner strength (3.0 to 6.0)
            const flatDmg = (config.clashFlatDamage ?? 6.0) * (0.5 + 0.5 * winnerStr) * harm;
            loserLoss = Math.min(people.energy[loserSlot], loserLoss + flatDmg);
          } else {
            if (loserLoss < 0.5) loserLoss = Math.min(people.energy[loserSlot], 0.5);
            loserLoss = Math.min(people.energy[loserSlot], loserLoss);
          }
        } else {
          if (loserLoss < 0.5) {
            loserLoss = Math.min(people.energy[loserSlot], 0.5);
          }
          loserLoss = Math.min(people.energy[loserSlot], loserLoss);
        }
        const rawLoot = loserLoss * lootEfficiency;
        const actualLoot = Math.min(rawLoot, Math.max(0, maxEnergy - people.energy[winnerSlot]));
        const struggleWaste = loserLoss - actualLoot;

        people.energy[loserSlot] -= loserLoss;
        people.energy[winnerSlot] += actualLoot;
        ledger.attack += struggleWaste;
        Rules.addFear(loserSlot, px, py, people, config);
        // S3x unit A: the loser remembers what this place cost them; the winner's loot pays theirs off.
        Rules.addPlaceCost(loserSlot, px, py, loserLoss, people, config);
        Rules.addPlaceCost(winnerSlot, px, py, -actualLoot, people, config);
        let loserFell = people.energy[loserSlot] <= 0;

        if (config.injuryEnabled !== false) {
          const hurt = (config.clashInjury ?? 60) * harm;
          const newInjuryLoser = Math.min(255, people.injury[loserSlot] + hurt);
          people.injury[loserSlot] = newInjuryLoser;
          people.injury[winnerSlot] = Math.min(255, people.injury[winnerSlot] + hurt * (config.clashInjuryWinner ?? 0.25));

          if (resourceOn && stakesHere && newInjuryLoser >= (config.clashLethalInjury ?? 220)) {
            loserFell = true;
          }
        }

        // Primitive 78: Looting carried goods
        if (config.clashLootEnabled !== false) {
          const loserKind = people.carryKind[loserSlot];
          const loserAmt = people.carry[loserSlot];

          if (loserKind !== CARRY_NONE && loserAmt > 0) {
            const winnerKind = people.carryKind[winnerSlot];
            const winnerAmt = people.carry[winnerSlot];
            const winnerCap = maxCarryCapacity(winnerSlot, loserKind, people, config);

            if (winnerKind === CARRY_NONE || winnerAmt <= 0) {
              const taken = Math.min(winnerCap, loserAmt);
              people.carryKind[winnerSlot] = loserKind;
              people.carry[winnerSlot] = taken;
              const excess = loserAmt - taken;
              if (excess > 0) {
                Rules.dropCarriedToLand(loserKind, excess, px, py, land, config);
              }
            } else if (winnerKind === loserKind) {
              const space = Math.max(0, winnerCap - winnerAmt);
              const taken = Math.min(space, loserAmt);
              people.carry[winnerSlot] += taken;
              const excess = loserAmt - taken;
              if (excess > 0) {
                Rules.dropCarriedToLand(loserKind, excess, px, py, land, config);
              }
            } else {
              Rules.dropCarriedToLand(loserKind, loserAmt, px, py, land, config);
            }

            people.carryKind[loserSlot] = CARRY_NONE;
            people.carry[loserSlot] = 0;
          }
        }

        if (contestOn && config.selfAssessEnabled !== false) {
          // S3x: winning and losing change belief in one's own strength, not belligerence.
          const step = config.confStep ?? 0.5;
          Rules.shiftConfidence(winnerSlot, step, people, config);
          Rules.shiftConfidence(loserSlot, -step, people, config);
        } else if (config.experienceHabitsEnabled ?? true) {
          Rules.nudgeHabit(people, winnerSlot, HABIT_BELLIGERENCE, config.habitWinStep ?? 3);
          Rules.nudgeHabit(people, loserSlot, HABIT_BELLIGERENCE, -(config.habitLoseStep ?? 3));
        }

        if ((config.chronicleEnabled ?? true) && rootA !== rootB) {
          // Observer only: who beat whom, and whether the loser died.
          const wRoot = winnerSlot === slotA ? (rootA !== 0 ? rootA : idA) : rootB !== 0 ? rootB : idB;
          const lRoot = winnerSlot === slotA ? (rootB !== 0 ? rootB : idB) : rootA !== 0 ? rootA : idA;
          Rules.clashLog.push(wRoot, lRoot, loserFell ? 1 : 0, px, py);
        }

        if (loserFell) {
          if (people.energy[loserSlot] > 0) {
            ledger.deathFat += people.energy[loserSlot];
          } else if (people.energy[loserSlot] < 0) {
            ledger.overdraft += -people.energy[loserSlot];
          }
          if (config.clashLootEnabled !== false) {
            if (people.carryKind[loserSlot] !== CARRY_NONE && people.carry[loserSlot] > 0) {
              Rules.dropCarriedToLand(people.carryKind[loserSlot], people.carry[loserSlot], px, py, land, config);
              people.carryKind[loserSlot] = CARRY_NONE;
              people.carry[loserSlot] = 0;
            }
          } else {
            if (people.carryKind[loserSlot] === CARRY_FOOD && people.carry[loserSlot] > 0) {
              land.dropFood(px, py, people.carry[loserSlot], config);
            }
          }
          fields.depositDanger(px, py, config.scentDangerDeath ?? 10.0);
          land.markDeath(px, py, config.graveTicks ?? 150);
          people.kill(loserSlot);
        } else {
          fields.depositDanger(px, py, config.scentDangerClash ?? 5.0);
          Rules.retreatStep(loserSlot, people, land, prng);
        }
      }
    }
  }

  public static dropCarriedToLand(
    kind: number,
    amount: number,
    px: number,
    py: number,
    land: Land,
    config: Readonly<SimulationConfig>
  ): void {
    if (amount <= 0) return;
    if (kind === CARRY_FOOD) {
      land.dropFood(px, py, amount, config);
    } else if (kind === CARRY_SEED) {
      land.dropSeeds(px, py, amount, config);
    } else if (kind === CARRY_BRUSH) {
      land.dropBrush(px, py, amount, config);
    } else if (kind === CARRY_STONE) {
      land.build(px, py, amount, config);
    } else if (kind === CARRY_EARTH) {
      land.build(px, py, amount, config, true);
    } else if (kind === CARRY_WATER) {
      // Spilled water soaks in unless the tile can hold a store.
      land.pourWater((py << 8) | px, amount, config);
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
      people.restTicks[slot] = 0;
      people.x[slot] = nx;
      people.y[slot] = ny;
    }
  }
}
