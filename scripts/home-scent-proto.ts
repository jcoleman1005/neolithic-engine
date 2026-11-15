/**
 * Prototype only, not wired into the simulation: the two ideas the user proposed on 2026-11-15 in
 * place of the remembered walk back.
 *
 * 1. A "home" scent that people lay where they live and that water blocks. It spreads over land
 *    only, so its slope leads round a river bend instead of across it.
 * 2. Knowing water can't be walked on: a step is chosen among the passable directions only.
 *
 * Pure functions on plain typed arrays (a 256 x 256 wrapping grid, cell = y * 256 + x), so the
 * smoke tests and the smoke script can run them on synthetic maps and on real worlds.
 */

export const SIZE = 256;
export const CELLS = SIZE * SIZE;
const M = SIZE - 1;

export const east = (c: number): number => (c & ~M) | ((c + 1) & M);
export const west = (c: number): number => (c & ~M) | ((c - 1) & M);
export const south = (c: number): number => (((c >> 8) + 1) & M) << 8 | (c & M);
export const north = (c: number): number => (((c >> 8) - 1) & M) << 8 | (c & M);
/** Neighbour of `c` in direction 0 east, 1 west, 2 south, 3 north. */
export const step = (c: number, dir: number): number => (dir === 0 ? east(c) : dir === 1 ? west(c) : dir === 2 ? south(c) : north(c));

/**
 * One diffusion step of a scent that water blocks. A land cell gives `rate` of its scent to each
 * land neighbour and nothing to a water neighbour, and loses `evaporation` of it. Water cells hold
 * no scent. With evaporation 0 the total is conserved (nothing leaks into water).
 */
export function diffuseOnLand(cur: Float32Array, next: Float32Array, isWater: Uint8Array, rate: number, evaporation: number): void {
  for (let c = 0; c < CELLS; c++) {
    if (isWater[c] === 1) { next[c] = 0; continue; }
    const e = east(c), w = west(c), s = south(c), n = north(c);
    let give = 0, take = 0;
    if (isWater[e] === 0) { give++; take += cur[e]; }
    if (isWater[w] === 0) { give++; take += cur[w]; }
    if (isWater[s] === 0) { give++; take += cur[s]; }
    if (isWater[n] === 0) { give++; take += cur[n]; }
    const v = cur[c] * (1 - evaporation - rate * give) + rate * take;
    next[c] = v > 1e-12 ? v : 0;
  }
}

/** Runs the field with fixed sources (scent added to each source cell every step) for `steps` steps. */
export function settleField(
  isWater: Uint8Array, sources: Float32Array, rate: number, evaporation: number, steps: number
): Float32Array {
  let a = new Float32Array(CELLS), b = new Float32Array(CELLS);
  for (let k = 0; k < steps; k++) {
    for (let c = 0; c < CELLS; c++) if (sources[c] > 0 && isWater[c] === 0) a[c] += sources[c];
    diffuseOnLand(a, b, isWater, rate, evaporation);
    const t = a; a = b; b = t;
  }
  return a;
}

export interface Climb {
  readonly end: number;
  readonly steps: number;
  /** True if any step would have been onto water (must never happen). */
  readonly touchedWater: boolean;
}

/**
 * Follows the scent uphill from `start`: each step goes to the land neighbour with the most scent,
 * if it has more than the current cell. Stops at a peak, on flat ground, or after `maxSteps`.
 */
export function climbScent(field: Float32Array, isWater: Uint8Array, start: number, maxSteps = 600): Climb {
  let c = start, steps = 0, touchedWater = false;
  for (; steps < maxSteps; steps++) {
    let best = -1, bestV = field[c];
    for (let d = 0; d < 4; d++) {
      const n = step(c, d);
      if (isWater[n] === 1) continue;
      if (field[n] > bestV) { bestV = field[n]; best = n; }
    }
    if (best < 0) break;
    if (isWater[best] === 1) touchedWater = true;
    c = best;
  }
  return { end: c, steps, touchedWater };
}

/**
 * Idea 2, as one rule: of the four directions, take the passable one that best matches the pull
 * (vx east-positive, vy south-positive). A direction the pull points away from is never taken,
 * and a sideways step is taken only when the wanted step is blocked. Returns 0 east, 1 west,
 * 2 south, 3 north, or 4 to stay. `passable(dir)` says whether that step is on land.
 */
export function bestPassableStep(vx: number, vy: number, passable: (dir: number) => boolean, minPull = 0.05): number {
  const ax = Math.abs(vx), ay = Math.abs(vy);
  if (ax < minPull && ay < minPull) return 4;
  const xDir = vx > 0 ? 0 : 1, yDir = vy > 0 ? 2 : 3;
  const first = ax >= ay ? xDir : yDir;
  const second = ax >= ay ? yDir : xDir;
  const secondPull = ax >= ay ? ay : ax;
  if (passable(first)) return first;
  if (secondPull > 0 && passable(second)) return second;
  // The wanted step and the lesser one are both water: slide along the shore, whichever side is open.
  const sideA = first < 2 ? 2 : 0, sideB = sideA + 1;
  if (secondPull === 0) {
    if (passable(sideA)) return sideA;
    if (passable(sideB)) return sideB;
  } else {
    const other = second ^ 1; // the sideways step the pull leans away from: better than standing still
    if (passable(other)) return other;
  }
  return 4;
}

/** Walking distance over land from a set of cells (multi-source BFS), 65535 where unreachable. */
export function landDistance(isWater: Uint8Array, from: readonly number[]): Uint16Array {
  const dist = new Uint16Array(CELLS).fill(65535);
  const queue = new Int32Array(CELLS);
  let head = 0, tail = 0;
  for (const c of from) if (isWater[c] === 0 && dist[c] === 65535) { dist[c] = 0; queue[tail++] = c; }
  while (head < tail) {
    const c = queue[head++];
    const d = dist[c] + 1;
    for (let k = 0; k < 4; k++) {
      const n = step(c, k);
      if (isWater[n] === 1 || dist[n] !== 65535) continue;
      dist[n] = d;
      queue[tail++] = n;
    }
  }
  return dist;
}
