import { World } from '../src/sim/world';
import { Chronicle } from '../src/sim/chronicle';
import type { ChronicleType } from '../src/sim/events';

// 1x speed is 3 ticks per second (host default), so one real hour is 10,800 ticks, 30 years.
const TICKS_PER_HOUR = 3 * 3600;

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(name);
  return i >= 0 ? parseFloat(process.argv[i + 1]) : fallback;
}

const seed = arg('--seed', 42);
const years = arg('--years', 90);
const world = new World({}, seed);
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
console.log(`\nChronicle: seed ${seed}, ${years} years = ${hours.toFixed(1)} real hours at 1x\n`);
console.log('| Type | Entries | Per hour |');
console.log('|:--|--:|--:|');
let total = 0;
for (const [type, n] of Object.entries(chronicle.counts)) {
  total += n;
  console.log(`| ${type} | ${n} | ${(n / hours).toFixed(1)} |`);
}
console.log(`| **all** | ${total} | ${(total / hours).toFixed(1)} |\n`);
const show = arg('--show', 12);
for (const e of entries.slice(0, show)) console.log(`  y${(e.tick / 360).toFixed(1)} [${e.type}] ${e.text}`);
