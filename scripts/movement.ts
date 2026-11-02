import { World } from '../src/sim/world';
import type { SimulationConfig } from '../src/sim/types';

/**
 * Movement quality of adults over a window after a warm-up (the Phase 4 jitter check).
 *   npm run movement -- --seed 1 [--warmup 5] [--window 300] [--calmMovementEnabled false]
 * Reports reversal rate (a step that undoes the previous one), unique cells per 300 ticks,
 * share of ticks standing still, food gained per move, and population.
 */
const argv = process.argv.slice(2);
const num = (k: string, d: number): number => {
  const i = argv.indexOf(k);
  return i >= 0 ? parseFloat(argv[i + 1]) : d;
};
const seed = num('--seed', 1);
const warm = num('--warmup', 5);
const window = num('--window', 300);
const overrides: Record<string, number | boolean> = {};
const known = new Set(['--seed', '--warmup', '--window']);
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--') && !known.has(argv[i]) && i + 1 < argv.length) {
    const v = argv[++i];
    overrides[argv[i - 1].slice(2)] = v === 'true' || v === 'false' ? v === 'true' : parseFloat(v);
  } else if (known.has(argv[i])) i++;
}

const world = new World(overrides as Partial<SimulationConfig>, seed);
const tpy = world.config.ticksPerYear || 360;
for (let t = 0; t < warm * tpy; t++) world.step();

const p = world.people;
const adultAge = world.config.adultAge ?? 5760;
const ids = new Map<number, number>(); // slot -> person id being tracked
const lastX = new Int16Array(p.capacity);
const lastY = new Int16Array(p.capacity);
const lastDir = new Int8Array(p.capacity).fill(-1);
const visited = new Map<number, Set<number>>();
let moves = 0, reversals = 0, ticks = 0, still = 0, foodGain = 0;

function dirOf(dx: number, dy: number): number {
  const wx = ((dx + 128) & 255) - 128;
  const wy = ((dy + 128) & 255) - 128;
  if (wx === 1) return 0; if (wx === -1) return 1; if (wy === 1) return 2; if (wy === -1) return 3; return -1;
}

for (let t = 0; t < window; t++) {
  world.step();
  for (let s = 0; s < p.capacity; s++) {
    if (p.alive[s] === 0 || p.age[s] < adultAge) { ids.delete(s); continue; }
    const id = p.idOf(s);
    const x = p.x[s], y = p.y[s];
    if (ids.get(s) !== id) {
      ids.set(s, id); lastX[s] = x; lastY[s] = y; lastDir[s] = -1; visited.set(id, new Set([y * 256 + x]));
      continue;
    }
    ticks++;
    const d = dirOf(x - lastX[s], y - lastY[s]);
    if (d < 0) { still++; } else {
      moves++;
      if (lastDir[s] >= 0 && d === (lastDir[s] ^ 1)) reversals++;
      foodGain += world.land.food[y * 256 + x] - world.land.food[lastY[s] * 256 + lastX[s]];
      lastDir[s] = d;
    }
    visited.get(id)!.add(y * 256 + x);
    lastX[s] = x; lastY[s] = y;
  }
}
let uniq = 0;
for (const v of visited.values()) uniq += v.size;
const f = (n: number, d = 1) => n.toFixed(d);
console.log(JSON.stringify({
  seed, calm: world.config.calmMovementEnabled, pop: world.population,
  reversalPct: f(100 * reversals / Math.max(1, moves)),
  stillPct: f(100 * still / Math.max(1, ticks)),
  uniqueCells: f(uniq / Math.max(1, visited.size)),
  foodPerMove: f(foodGain / Math.max(1, moves), 2),
}));
