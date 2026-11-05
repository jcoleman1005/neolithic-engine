import { World } from '../src/sim/world';
import { Chronicle } from '../src/sim/chronicle';
import type { ChronicleType } from '../src/sim/events';
import type { SimulationConfig } from '../src/sim/types';
import * as fs from 'fs';

/**
 * Runs the chronicle headless and counts entries per real hour at 1x
 * (3 ticks a second, so one hour is 10,800 ticks = 30 years).
 *   npm run chronicle -- --seed 1 --years 200 [--show 12] [--out file.json]
 * Any config key can be overridden with --key value (for tuning thresholds).
 */
const TICKS_PER_HOUR = 3 * 3600;
const TYPES: ChronicleType[] = ['battle', 'split', 'founded', 'leaderDeath', 'migration', 'settled', 'abandoned', 'famine', 'boom'];

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(name);
  return i >= 0 ? parseFloat(process.argv[i + 1]) : fallback;
}

const seed = arg('--seed', 42);
const years = arg('--years', 90);
const overrides: Record<string, number> = {};
const known = new Set(['--seed', '--years', '--show', '--out']);
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith('--') && !known.has(a) && i + 1 < process.argv.length) {
    overrides[a.slice(2)] = parseFloat(process.argv[++i]);
  } else if (known.has(a)) i++;
}

const world = new World(overrides as Partial<SimulationConfig>, seed);
const chronicle = new Chronicle();
const entries: Array<{ tick: number; type: ChronicleType; text: string }> = [];
const ticks = years * (world.config.ticksPerYear || 360);

for (let t = 0; t < ticks; t++) {
  world.step();
  for (const e of chronicle.record(world)) {
    if (e.kind === 'chronicle') entries.push({ tick: world.tick, type: e.type, text: e.text });
  }
}

const hours = ticks / TICKS_PER_HOUR;
console.log(`\nChronicle: seed ${seed}, ${years} years = ${hours.toFixed(1)} real hours at 1x`);
if (Object.keys(overrides).length) console.log(`Overrides: ${JSON.stringify(overrides)}`);

const windows = Math.ceil(ticks / TICKS_PER_HOUR);
console.log('\n| Hour (30-year block) | ' + TYPES.join(' | ') + ' | **all** |');
console.log('|:--|' + TYPES.map(() => '--:').join('|') + '|--:|');
const total: Record<string, number> = {};
for (let w = 0; w < windows; w++) {
  const inWindow = entries.filter((e) => e.tick > w * TICKS_PER_HOUR && e.tick <= (w + 1) * TICKS_PER_HOUR);
  const row = TYPES.map((ty) => inWindow.filter((e) => e.type === ty).length);
  const span = Math.min(TICKS_PER_HOUR, ticks - w * TICKS_PER_HOUR) / TICKS_PER_HOUR;
  const label = `${w + 1} (yrs ${w * 30}-${Math.min(years, (w + 1) * 30)}${span < 1 ? ', partial' : ''})`;
  console.log(`| ${label} | ${row.join(' | ')} | **${inWindow.length}** |`);
  TYPES.forEach((ty, i) => (total[ty] = (total[ty] ?? 0) + row[i]));
}
console.log(`| total | ${TYPES.map((ty) => total[ty]).join(' | ')} | **${entries.length}** |\n`);

const show = arg('--show', 12);
for (const e of entries.slice(0, show)) console.log(`  y${(e.tick / 360).toFixed(1)} [${e.type}] ${e.text}`);
const outIdx = process.argv.indexOf('--out');
if (outIdx >= 0) fs.writeFileSync(process.argv[outIdx + 1], JSON.stringify({ seed, years, entries }, null, 1));
