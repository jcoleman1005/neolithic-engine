/**
 * Belligerence probe: how the clash gate plays out. Every N years: mean belligerence habit and
 * cruelty gene, share of people over the gate (habit + cruelty > 180), and per-touch outcomes
 * (sharing, allied, not belligerent, tolerated by culture, clash). Reads only.
 *
 *   npx vite-node scripts/bell-probe.ts -- --seed 1 --years 30 --every 5 [config overrides]
 */
import { World } from '../src/sim/world';
import { parseArgs } from './args';
import { Rules } from '../src/sim/rules';
import { GENE_COUNT, GENE_CRUELTY, HABIT_BELLIGERENCE, HABIT_COUNT } from '../src/sim/people';

const { named, overrides } = parseArgs(process.argv.slice(2), ['seed', 'years', 'every']);
const w = new World(overrides as never, parseInt(named.seed ?? '1', 10));
const years = parseInt(named.years ?? '30', 10), every = parseInt(named.every ?? '5', 10);
const p = w.people;
let touches = 0, allied = 0, calm = 0;
const orig = Rules.touch;
(Rules as unknown as { touch: typeof Rules.touch }).touch = (a, b, ...rest) => {
  if (p.alive[a] && p.alive[b]) {
    touches++;
    if (Rules.isAllied(a, b, p)) allied++;
    else {
      const ba = p.habits[a * HABIT_COUNT + HABIT_BELLIGERENCE] + p.genes[a * GENE_COUNT + GENE_CRUELTY];
      const bb = p.habits[b * HABIT_COUNT + HABIT_BELLIGERENCE] + p.genes[b * GENE_COUNT + GENE_CRUELTY];
      if (!(ba > 180 || bb > 180)) calm++;
    }
  }
  return orig(a, b, ...rest);
};
let lastTol = 0, lastCon = 0, lastStr = 0;
console.log('years\tpeople\thabit\tcruelty\tover gate\ttouches/person/yr\tallied\tneither belligerent\ttolerated (culture)\tclash\tmean culture distance');
for (let y = 1; y <= years; y++) {
  for (let t = 0; t < 360; t++) w.step();
  if (y % every) continue;
  let n = 0, h = 0, c = 0, over = 0;
  for (let s = 0; s < p.capacity; s++) {
    if (!p.alive[s]) continue;
    n++; const hb = p.habits[s * HABIT_COUNT + HABIT_BELLIGERENCE], cr = p.genes[s * GENE_COUNT + GENE_CRUELTY];
    h += hb; c += cr; if (hb + cr > 180) over++;
  }
  const cs = Rules.cultureStats, bins = cs.distanceBins;
  let bn = 0, bs = 0; for (let i = 0; i < bins.length; i++) { bn += bins[i]; bs += bins[i] * (i + 0.5) / 20; }
  const tol = cs.tolerated - lastTol, con = cs.contested - lastCon;
  const str = Rules.clashStats.strangers - lastStr;
  const pc = (x: number) => (100 * x / Math.max(1, touches)).toFixed(1) + '%';
  console.log([`${y - every + 1}-${y}`, n, (h / n).toFixed(0), (c / n).toFixed(0), (100 * over / n).toFixed(0) + '%', (touches / n / every).toFixed(1), pc(allied), pc(calm), pc(tol), pc(con), (bs / Math.max(1, bn)).toFixed(3)].join('\t'));
  lastTol = cs.tolerated; lastCon = cs.contested; lastStr = Rules.clashStats.strangers; touches = allied = calm = 0;
  bins.fill(0);
  void str;
}
