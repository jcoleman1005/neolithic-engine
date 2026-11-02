import { World } from '../src/sim/world';
import type { SimulationConfig } from '../src/sim/types';

/**
 * Heaps and granary floors over time (Phase 5c), with a stockpiles-off run for comparison.
 *   npm run stockpiles -- --seed 1 --years 20 [--every 5] [--key value ...]
 * Targets: heaps 0.3-5% of land, granary floors >= 5 cells and < 1% of land, population within 5%
 * of the off run, and under 20% of heaps sitting at the cap.
 */
const argv = process.argv.slice(2);
const num = (k: string, d: number): number => {
  const i = argv.indexOf(k);
  return i >= 0 ? parseFloat(argv[i + 1]) : d;
};
const seed = num('--seed', 1);
const years = num('--years', 20);
const every = num('--every', 5);
const overrides: Record<string, number | boolean> = {};
const known = new Set(['--seed', '--years', '--every']);
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--') && !known.has(argv[i]) && i + 1 < argv.length) {
    const v = argv[++i];
    overrides[argv[i - 1].slice(2)] = v === 'true' || v === 'false' ? v === 'true' : parseFloat(v);
  } else if (known.has(argv[i])) i++;
}
const on = new World(overrides as Partial<SimulationConfig>, seed);
const off = new World({ ...overrides, stockpilesEnabled: false } as Partial<SimulationConfig>, seed);
const tpy = on.config.ticksPerYear || 360;
console.log('year | pop on / off (vs) | heaps %land | granary | mass | at cap % | carriers');
for (let y = 1; y <= years; y++) {
  for (let t = 0; t < tpy; t++) { on.step(); off.step(); }
  if (y % every !== 0) continue;
  const l = on.land;
  let land = 0, heaps = 0, gran = 0, mass = 0, atCap = 0;
  for (let i = 0; i < 65536; i++) {
    if (l.isWater[i] === 1) continue;
    land++;
    if (l.pile[i] >= (on.config.heapMin ?? 2)) heaps++;
    if (l.form[i] === 2) gran++;
    mass += l.pile[i];
    if (l.pile[i] >= (on.config.pileCap ?? 200) - 1e-3) atCap++;
  }
  let carriers = 0;
  for (let s = 0; s < on.people.capacity; s++) if (on.people.alive[s] === 1 && on.people.carryKind[s] === 2) carriers++;
  const d = (on.population / off.population - 1) * 100;
  console.log(
    `${String(y).padStart(4)} | ${on.population} / ${off.population} (${d.toFixed(1)}%) | ${(100 * heaps / land).toFixed(2)}% | ${gran} | ${mass.toFixed(0)} | ${heaps ? (100 * atCap / heaps).toFixed(0) : 0}% | ${carriers}`
  );
}
