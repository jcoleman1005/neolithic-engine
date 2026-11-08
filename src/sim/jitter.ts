import type { SimulationConfig } from './types';
import type { People } from './people';
import { GENE_COUNT, GENE_CURIOSITY, HABIT_COUNT, HABIT_ROAMING } from './people';
import type { Land } from './land';
import { COORD_MASK, GRID_SIZE } from './land';
import type { PRNG } from './prng';

/**
 * Persistent-walk jitter. Rows are indexed by the current heading (0 East, 1 West, 2 South, 3 North, as in
 * rules.ts) and give [straight, straight, left, right] with north up.
 */
const RELATIVE_TURNS: ReadonlyArray<Uint8Array> = [
  new Uint8Array([0, 0, 3, 2]),
  new Uint8Array([1, 1, 2, 3]),
  new Uint8Array([2, 2, 0, 1]),
  new Uint8Array([3, 3, 1, 0]),
];

/** The result is packed in one int (no allocation): direction in the low 2 bits, weight above, in 1/255 units. */
export const jitterDir = (packed: number): number => packed & 3;
export const jitterWeight = (packed: number): number => (packed >> 2) / 255;

/**
 * Always draws exactly one random number, so the stream does not depend on who is tired or dashing.
 * `seed` is the world seed, so the dash schedule differs between seeds.
 */
export function computeUnifiedJitter(
  slot: number,
  tick: number,
  people: People,
  land: Land,
  prng: PRNG,
  seed: number,
  config: SimulationConfig,
): number {
  const r = prng.nextUint32();

  const prev = people.prevDir[slot];
  const drive = (people.habits[slot * HABIT_COUNT + HABIT_ROAMING] * people.genes[slot * GENE_COUNT + GENE_CURIOSITY]) >> 8;
  const rawAmp = (drive * (255 - people.fatigue[slot])) >> 8;
  const dir = prev < 4 ? prev : (r >>> 30);
  if (rawAmp < config.jitterMinAmp) return dir;

  const idx = ((people.y[slot] & COORD_MASK) * GRID_SIZE) | (people.x[slot] & COORD_MASK);
  const damp = 255 - (((land.wear[idx] * config.jitterRoadDampPct) / 100) | 0);
  const amp = (rawAmp * damp) >> 8;

  // Dash epochs are staggered by slot so they do not switch in unison, and keyed on the seed.
  const epoch = (tick + slot * 5) >>> config.jitterEpochShift;
  let h = Math.imul(epoch ^ seed, 0x45d9f3b) + slot;
  h = Math.imul((h >>> 16) ^ h, 0x45d9f3b);
  h = Math.imul((h >>> 16) ^ h, 0x45d9f3b);
  h = (h >>> 16) ^ h;
  if (prev < 4 && (h & ((1 << config.jitterDashLog2) - 1)) === 0) {
    return dir | (((amp * config.jitterDashWeightPct) / 100 | 0) << 2);
  }

  const chosen = prev < 4 ? RELATIVE_TURNS[prev][r >>> 30] : (r >>> 30);
  return chosen | (amp << 2);
}
