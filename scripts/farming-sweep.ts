import * as fs from 'fs';
import { World } from '../src/sim/world';
import type { SimulationConfig } from '../src/sim/types';

/**
 * Screens several farming value sets in ONE process and prints one table with pass/fail.
 *   npm run farming-sweep -- --sets sets.json [--seed 1] [--years 20] [--part 1/2]
 * sets.json: [{ "name": "A", "o": { "tillGain": 0.02, "tillDecay": 0.002 } }, ...]
 * Targets (edit below): worked soil 10-35% of land, desert < 15%, seeds < 20% of land,
 * population within 5% of the farming-off run at the same year. The off run is computed once.
 * --part i/n runs every n-th set, so n processes can share the cores (check `nproc` and load first).
 */
const argv = process.argv.slice(2);
const arg = (k: string, d: string): string => {
  const i = argv.indexOf(k);
  return i >= 0 ? argv[i + 1] : d;
};
const seed = parseFloat(arg('--seed', '1'));
const years = parseFloat(arg('--years', '20'));
const [partIdx, partN] = arg('--part', '1/1').split('/').map(Number);
const setsFile = arg('--sets', '');
if (!setsFile) throw new Error('--sets <file.json> is required');

const TARGETS = { workedMin: 0.1, workedMax: 0.35, desertMax: 0.15, seedsMax: 0.2, popTol: 0.05 };

interface SetDef { name: string; o: Record<string, number | boolean> }
const all: SetDef[] = JSON.parse(fs.readFileSync(setsFile, 'utf8'));
const mine = all.filter((_, i) => i % partN === partIdx - 1);

function run(o: Record<string, number | boolean>) {
  const w = new World(o as Partial<SimulationConfig>, seed);
  const tpy = w.config.ticksPerYear || 360;
  for (let t = 0; t < years * tpy; t++) w.step();
  const l = w.land;
  let land = 0, worked = 0, farm = 0, desert = 0, seeds = 0;
  for (let i = 0; i < 65536; i++) {
    if (l.isWater[i] === 1) continue;
    land++;
    if (l.tilled[i] > 0.3) farm++;
    if (l.tilled[i] > 0.1) worked++;
    if (l.soilHealth[i] < 0.6) desert++;
    if (l.seeds[i] > 0.5) seeds++;
  }
  return { pop: w.population, worked: worked / land, farm: farm / land, desert: desert / land, seeds: seeds / land };
}

const off = run({ farmingPhysicsEnabled: false });
const pct = (x: number) => (100 * x).toFixed(1).padStart(5) + '%';
console.log(`seed ${seed}, ${years} years, off-run pop ${off.pop}; targets: worked ${100 * TARGETS.workedMin}-${100 * TARGETS.workedMax}%, desert <${100 * TARGETS.desertMax}%, seeds <${100 * TARGETS.seedsMax}%, pop within ${100 * TARGETS.popTol}%`);
console.log('set   | pop    vs off  | worked | farm   | desert | seeds  | pass');
for (const s of mine) {
  const r = run(s.o);
  const dPop = r.pop / off.pop - 1;
  const ok =
    r.worked >= TARGETS.workedMin && r.worked <= TARGETS.workedMax &&
    r.desert < TARGETS.desertMax && r.seeds < TARGETS.seedsMax && Math.abs(dPop) <= TARGETS.popTol;
  console.log(
    `${s.name.padEnd(5)} | ${String(r.pop).padStart(6)} ${(100 * dPop).toFixed(1).padStart(6)}% | ${pct(r.worked)} | ${pct(r.farm)} | ${pct(r.desert)} | ${pct(r.seeds)} | ${ok ? 'PASS' : 'no'}`
  );
}
