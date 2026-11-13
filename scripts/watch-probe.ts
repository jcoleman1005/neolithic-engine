/**
 * Watchability W0: how watchable is a run? Read only (see scripts/watch-probe-lib.ts for what it
 * measures and how). The world it leaves has the same stateHash() as a plain run of the same seed.
 *   npx vite-node scripts/watch-probe.ts -- --seed 1 --years 50 [--every 30] [--report 30] [--someSwitch value]
 * Measures from year 5 on. Prints one line a decade, a `RESULT {json}` line at each `--report` year
 * (comma separated, so a 50-year run also gives the 30-year numbers), and a final `RESULT {json}` line.
 */
import { World } from '../src/sim/world';
import { parseArgs } from './args';
import { attachWatchProbe } from './watch-probe-lib';

const { named, overrides } = parseArgs(process.argv.slice(2), ['seed', 'years', 'every', 'report']);
const seed = parseInt(named.seed ?? '1', 10);
const years = parseInt(named.years ?? '50', 10);
const every = parseInt(named.every ?? '30', 10);
const reportAt = (named.report ?? '').split(',').filter((s) => s !== '').map((s) => parseInt(s, 10));
const w = new World(overrides as never, seed);
const tpy = w.config.ticksPerYear || 360;
const probe = attachWatchProbe(w, { every });

const t0 = Date.now();
for (let t = 1; t <= years * tpy; t++) {
  w.step();
  probe.afterStep();
  if (w.population === 0) break;
  if (t % tpy === 0) {
    const y = t / tpy;
    if (y % 10 === 0) console.log(`year ${y}: pop ${w.population}, herds ${w.herds.count}, wolves ${w.wolves.count}, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    if (reportAt.includes(y) && y !== years) console.log(`RESULT ${JSON.stringify(probe.result())}`);
  }
}
console.log(`RESULT ${JSON.stringify(probe.result())}`);
