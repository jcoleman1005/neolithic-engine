import { World } from '../src/sim/world';
import type { SimulationConfig } from '../src/sim/types';

/**
 * Farmland, desert and seeds over time (Phase 5b).
 *   npm run farming -- --seed 1 --years 60 [--farmingPhysicsEnabled false]
 * farm = cells with tilled > 0.3; desert = soil health below 0.6; seeds = cells holding seeds.
 */
const argv = process.argv.slice(2);
const num = (k: string, d: number): number => {
  const i = argv.indexOf(k);
  return i >= 0 ? parseFloat(argv[i + 1]) : d;
};
const seed = num('--seed', 1);
const years = num('--years', 60);
const every = num('--every', 10);
const overrides: Record<string, number | boolean> = {};
const known = new Set(['--seed', '--years', '--every']);
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--') && !known.has(argv[i]) && i + 1 < argv.length) {
    const v = argv[++i];
    overrides[argv[i - 1].slice(2)] = v === 'true' || v === 'false' ? v === 'true' : parseFloat(v);
  } else if (known.has(argv[i])) i++;
}
const world = new World(overrides as Partial<SimulationConfig>, seed);
const tpy = world.config.ticksPerYear || 360;
const rows: string[] = [];
for (let y = 1; y <= years; y++) {
  for (let t = 0; t < tpy; t++) world.step();
  if (y % every !== 0) continue;
  const l = world.land;
  let farm = 0, desert = 0, seeds = 0, land = 0, food = 0;
  for (let i = 0; i < 65536; i++) {
    if (l.isWater[i] === 1) continue;
    land++;
    food += l.food[i];
    if (l.tilled[i] > 0.3) farm++;
    if (l.soilHealth[i] < 0.6) desert++;
    if (l.seeds[i] > 0.5) seeds++;
  }
  let carrying = 0;
  const p = world.people;
  for (let s = 0; s < p.capacity; s++) if (p.alive[s] === 1 && p.carry[s] > 0.05) carrying++;
  rows.push(`seed ${seed} farming=${world.config.farmingPhysicsEnabled} y${y}: pop ${world.population}, farm ${farm}, desert ${desert}, seeds ${seeds}, carrying ${carrying}, land ${land}, meanFood ${(food / land).toFixed(2)}`);
}
console.log(rows.join('\n'));
