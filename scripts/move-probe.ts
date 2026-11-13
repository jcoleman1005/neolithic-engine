/**
 * Watchability W1a diagnosis: what does the movement rule decide, and why, for fed, hungry and
 * starving adults? Read only: it wraps Rules.climb, re-derives the rule's own tests from the same
 * state before the call (thirst, the stay check, searching, a richer block in far sight), and
 * tallies them with the direction the rule returned. No random draws; the run's stateHash() is
 * the same as a plain run's.
 *   npx vite-node scripts/move-probe.ts -- --seed 1 --years 20 [--someSwitch value]
 * Counts adult decisions from year 5. Prints a table and a final `RESULT {json}` line.
 */
import { World } from '../src/sim/world';
import { Rules } from '../src/sim/rules';
import { type People, CARRY_WATER, GENE_COUNT, GENE_CURIOSITY, HABIT_COUNT, HABIT_ROAMING } from '../src/sim/people';
import { type Land } from '../src/sim/land';
import { type ScentFields } from '../src/sim/fields';
import { seasonGrowthFactor } from '../src/sim/seasons';
import { parseArgs } from './args';

const { named, overrides } = parseArgs(process.argv.slice(2), ['seed', 'years']);
const seed = parseInt(named.seed ?? '1', 10);
const years = parseInt(named.years ?? '20', 10);
const w = new World(overrides as never, seed);
const cfg = w.config;
const tpy = cfg.ticksPerYear || 360;
const FROM = 5 * tpy;
const maxE = cfg.maxEnergy ?? 100;
const hungryBelow = (cfg.hungerDriveThreshold ?? 0.35) * maxE;
const critBelow = (cfg.criticalHungerThreshold ?? 0.2) * maxE;
const adultAge = cfg.adultAge ?? 5760;
const thirstOn = cfg.finiteResourcesEnabled !== false && cfg.thirstEnabled !== false;
const thirstSeek = cfg.thirstSeek ?? 60;
const searchFood = cfg.hungerSearchFood ?? 6;
const margin = 1 + (cfg.farSightMargin ?? 0.2);
const floor = cfg.landGrazingFloor ?? 1;

const GROUPS = ['fed', 'hungry', 'starving'];
const BANDS = [2, 5, 10, 20, 255];
const mk = () => ({
  n: 0, thirst: 0, stayWorth: 0, stayOther: 0, moved: 0, searching: 0, leader: 0, winter: 0,
  tileFull: 0, tileBare: 0, around: 0, scent: 0, blockBetter: 0, crowd: 0, band: [0, 0, 0, 0, 0],
});
const tally = [mk(), mk(), mk()];
const grad = new Float32Array(2);
let on = false;
let growing = 1;

type Climb = typeof Rules.climb;
const orig: Climb = Rules.climb.bind(Rules);
(Rules as unknown as { climb: Climb }).climb = (slot, people: People, land: Land, fields: ScentFields, config, prng, crowdHere = 1) => {
  if (!on || people.age[slot] < adultAge) return orig(slot, people, land, fields, config, prng, crowdHere);
  const e = people.energy[slot];
  const g = tally[e < critBelow ? 2 : e < hungryBelow ? 1 : 0];
  const px = people.x[slot], py = people.y[slot];
  const cell = (py << 8) | px;
  const hasWater = people.carryKind[slot] === CARRY_WATER && people.carry[slot] > 0;
  const thirsty = thirstOn && !hasWater && people.hydration[slot] < thirstSeek;
  const roaming = people.habits[slot * HABIT_COUNT + HABIT_ROAMING] / 255;
  const curiosity = people.genes[slot * GENE_COUNT + GENE_CURIOSITY] / 255;
  const stay = Rules.worthStaying(slot, people, land, config, crowdHere, roaming, curiosity);
  const f = land.food;
  const around = (f[cell] + f[(py << 8) | ((px + 1) & 255)] + f[(py << 8) | ((px - 1) & 255)] +
    f[(((py + 1) & 255) << 8) | px] + f[(((py - 1) & 255) << 8) | px]) / 5;
  const cap = land.capacityAt(cell, config);
  const bx = px >> 4, by = py >> 4;
  const own = land.blockFood[by * 16 + bx] * margin;
  let better = false;
  for (let dy = -1; dy <= 1 && !better; dy++) for (let dx = -1; dx <= 1; dx++) {
    if ((dx !== 0 || dy !== 0) && land.blockFood[((by + dy) & 15) * 16 + ((bx + dx) & 15)] > own) { better = true; break; }
  }
  fields.getFoodGradient(px, py, grad);
  const dir = orig(slot, people, land, fields, config, prng, crowdHere);
  g.n++;
  if (thirsty) g.thirst++;
  else if (dir !== 4) g.moved++;
  else if (stay) g.stayWorth++;
  else g.stayOther++;
  if (around < searchFood) g.searching++;
  if (people.leaderId[slot] !== 0) g.leader++;
  if (growing === 0) g.winter++;
  if (cap > 0) g.tileFull += Math.min(1, f[cell] / cap);
  if (f[cell] <= floor + 0.5) g.tileBare++;
  g.around += around;
  g.scent += Math.hypot(grad[0], grad[1]);
  if (better) g.blockBetter++;
  g.crowd += crowdHere;
  let b = 0;
  while (land.waterDist[cell] > BANDS[b]) b++;
  g.band[b]++;
  return dir;
};

{
  for (let t = 1; t <= years * tpy; t++) {
    on = t > FROM;
    growing = seasonGrowthFactor(w.tick, cfg) >= 1 ? 1 : 0;
    w.step();
    if (w.population === 0) break;
  }
  const total = tally[0].n + tally[1].n + tally[2].n;
  const pct = (a: number, n: number): number => +(100 * a / Math.max(1, n)).toFixed(1);
  const out: Record<string, unknown> = { seed, years, popEnd: w.population, hash: w.stateHash() };
  for (let k = 0; k < 3; k++) {
    const g = tally[k];
    const n = Math.max(1, g.n);
    out[GROUPS[k]] = {
      shareOfAdultTicksPct: pct(g.n, total),
      thirstWalkPct: pct(g.thirst, n), movedPct: pct(g.moved, n), stayedWorthPct: pct(g.stayWorth, n), stayedOtherPct: pct(g.stayOther, n),
      searchingPct: pct(g.searching, n), richerBlockInSightPct: pct(g.blockBetter, n), hasLeaderPct: pct(g.leader, n),
      winterHalfPct: pct(g.winter, n), ownTileBarePct: pct(g.tileBare, n),
      ownTileFull: +(g.tileFull / n).toFixed(3), foodAround: +(g.around / n).toFixed(2), scentSlope: +(g.scent / n).toFixed(3),
      crowdOnTile: +(g.crowd / n).toFixed(2), byWaterBandPct: g.band.map((v) => pct(v, n)),
    };
  }
  for (const k of GROUPS) console.log(k, JSON.stringify(out[k]));
  console.log(`RESULT ${JSON.stringify(out)}`);
}
