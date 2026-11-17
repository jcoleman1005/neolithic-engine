/**
 * Smoke test on real worlds for the home-scent idea (prototype in scripts/home-scent-proto.ts).
 * Nothing here changes the simulation: it runs today's world for some years, takes where people
 * stand, lays a home scent from them (three rules for who lays it, three evaporation rates), lets
 * it settle, and asks of every adult living 6 or more tiles from fresh water:
 *   had they just drunk at the water tile their thirst walk leads to, where would climbing the
 *   home scent take them?
 * Read: back to their own camp, to the bank, to some other inland camp, or nowhere (no slope).
 *   npx vite-node scripts/home-scent-smoke.ts -- --seed 1 --years 20
 */
import { World } from '../src/sim/world';
import { parseArgs } from './args';
import { CELLS, bestPassableStep, climbScent, landDistance, settleField, step } from './home-scent-proto';

const { named, overrides } = parseArgs(process.argv.slice(2), ['seed', 'years']);
const seed = parseInt(named.seed ?? '1', 10);
const years = parseInt(named.years ?? '20', 10);
const w = new World(overrides as never, seed);
const tpy = w.config.ticksPerYear || 360;
for (let t = 1; t <= years * tpy; t++) w.step();
const L = w.land, p = w.people;
const adultAge = w.config.adultAge ?? 5760;
const wrap = (a: number, b: number): number => { const v = Math.abs(a - b); return v > 128 ? 256 - v : v; };

// Who lays the scent.
const rules: Record<string, (cell: number) => boolean> = {
  everyone: () => true,
  'in shelter (hut, nest, fire, cave)': (c) => L.sheltered(c),
  '3+ tiles from water': (c) => L.waterDist[c] >= 3 && L.waterDist[c] < 255,
};
// The adults to test: living 6+ tiles from water, with the shore tile their thirst walk reaches.
interface Subject { home: number; shore: number; dist: number }
const subjects: Subject[] = [];
for (let q = 0; q < p.capacity; q++) {
  if (p.alive[q] === 0 || p.age[q] < adultAge) continue;
  const home = (p.y[q] << 8) | p.x[q];
  const d0 = L.waterDist[home];
  if (d0 < 6 || d0 === 255) continue;
  let c = home;
  for (let k = 0; k < 400 && L.waterDist[c] > 1; k++) {
    let best = c, bd = L.waterDist[c];
    for (let d = 0; d < 4; d++) { const n = step(c, d); if (L.isWater[n] === 0 && L.waterDist[n] < bd) { bd = L.waterDist[n]; best = n; } }
    if (best === c) break;
    c = best;
  }
  if (L.waterDist[c] <= 1) subjects.push({ home, shore: c, dist: d0 });
}
let adults = 0;
for (let q = 0; q < p.capacity; q++) if (p.alive[q] === 1 && p.age[q] >= adultAge) adults++;
console.log(`seed ${seed}, year ${years}: population ${w.population}, adults ${adults}, adults 6+ tiles from water tested ${subjects.length}`);

const median = (a: number[]): number => { if (a.length === 0) return -1; const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
const pct = (a: number, n: number): number => +(100 * a / Math.max(1, n)).toFixed(1);
const results: Record<string, unknown>[] = [];
for (const [ruleName, lays] of Object.entries(rules)) {
  const sources = new Float32Array(CELLS);
  let layers = 0;
  for (let q = 0; q < p.capacity; q++) {
    if (p.alive[q] === 0) continue;
    const c = (p.y[q] << 8) | p.x[q];
    if (lays(c)) { sources[c] += 1; layers++; }
  }
  for (const evaporation of [0.02, 0.005, 0.001]) {
    const t0 = Date.now();
    const steps = Math.min(6000, Math.round(4 / evaporation));
    const field = settleField(L.isWater, sources, 0.1, evaporation, steps);
    const ms = (Date.now() - t0) / steps;
    let own = 0, bank = 0, elsewhere = 0, none = 0, weak = 0, wet = 0;
    const off: number[] = [], ratio: number[] = [];
    for (const s of subjects) {
      // The slope they would feel at the shore tile, water neighbours counted as their own tile.
      const v = (d: number): number => (L.isWater[step(s.shore, d)] === 1 ? field[s.shore] : field[step(s.shore, d)]);
      if (Math.max(Math.abs(v(0) - v(1)), Math.abs(v(2) - v(3))) < 0.05) weak++;
      const walk = climbScent(field, L.isWater, s.shore);
      if (walk.touchedWater) wet++;
      const dx = wrap(walk.end & 255, s.home & 255), dy = wrap(walk.end >> 8, s.home >> 8);
      off.push(Math.max(dx, dy));
      if (walk.steps === 0) none++;
      else if (dx <= 3 && dy <= 3) { own++; ratio.push(walk.steps / s.dist); }
      else if (L.waterDist[walk.end] <= 2) bank++;
      else elsewhere++;
    }
    const n = subjects.length;
    const row = {
      whoLaysIt: ruleName, layers, evaporation, settleSteps: steps, msPerFieldStep: +ms.toFixed(2),
      backToOwnCampPct: pct(own, n), toTheBankPct: pct(bank, n), toAnotherInlandCampPct: pct(elsewhere, n), noSlopeAtAllPct: pct(none, n),
      slopeUnderFeltMinimumPct: pct(weak, n), endOffByTilesMedian: median(off),
      stepsOverShortestMedian: +median(ratio).toFixed(2), steppedOnWater: wet,
    };
    results.push(row);
    console.log(JSON.stringify(row));
  }
}

// Second question: keep a remembered place as the destination, and compare three ways of walking to it
// from the shore tile: (a) today's straight line, giving up when water blocks both wanted steps;
// (b) the passable-step rule alone (slide along the shore); (c) straight line, and when water blocks it,
// follow the home scent (laid 3+ tiles from water) uphill until the straight line is open again.
const inland = new Float32Array(CELLS);
for (let q = 0; q < p.capacity; q++) {
  if (p.alive[q] === 0) continue;
  const c = (p.y[q] << 8) | p.x[q];
  if (L.waterDist[c] >= 3 && L.waterDist[c] < 255) inland[c] += 1;
}
const scent = settleField(L.isWater, inland, 0.1, 0.005, 800);
const open = (c: number) => (d: number): boolean => L.isWater[step(c, d)] === 0;
const gap = (from: number, to: number): [number, number] => {
  let dx = (to & 255) - (from & 255), dy = (to >> 8) - (from >> 8);
  if (dx > 128) dx -= 256; else if (dx < -128) dx += 256;
  if (dy > 128) dy -= 256; else if (dy < -128) dy += 256;
  return [dx, dy];
};
type Walker = (c: number, prev: number, home: number) => number; // returns the next cell, or -1 to give up
const straight: Walker = (c, _prev, home) => {
  const [dx, dy] = gap(c, home);
  const ax = Math.abs(dx), ay = Math.abs(dy);
  const xDir = dx > 0 ? 0 : 1, yDir = dy > 0 ? 2 : 3;
  const first = ax >= ay ? xDir : yDir, second = ax >= ay ? (ay > 0 ? yDir : -1) : (ax > 0 ? xDir : -1);
  if (open(c)(first)) return step(c, first);
  if (second !== -1 && open(c)(second)) return step(c, second);
  return -1;
};
const slide: Walker = (c, _prev, home) => {
  const [dx, dy] = gap(c, home);
  const d = bestPassableStep(dx, dy, open(c), 0);
  return d === 4 ? -1 : step(c, d);
};
const withScent: Walker = (c, prev, home) => {
  const n = straight(c, prev, home);
  if (n !== -1) return n;
  let best = -1, bv = -1;
  for (let d = 0; d < 4; d++) { const k = step(c, d); if (L.isWater[k] === 1 || k === prev) continue; if (scent[k] > bv) { bv = scent[k]; best = k; } }
  return best;
};
const LIMIT = 200; // thirstReturnTicks
for (const [name, walker] of [['straight line (today)', straight], ['passable step, slide along the shore', slide], ['straight line, home scent when blocked', withScent]] as const) {
  let arrived = 0, gaveUp = 0, outOfTime = 0, wet = 0;
  const ratio: number[] = [];
  for (const sub of subjects) {
    const shortest = landDistance(L.isWater, [sub.home])[sub.shore];
    let c = sub.shore, prev = -1, k = 0, ok = false;
    for (; k < LIMIT; k++) {
      const [dx, dy] = gap(c, sub.home);
      if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) { ok = true; break; }
      const n = walker(c, prev, sub.home);
      if (n === -1) break;
      if (L.isWater[n] === 1) wet++;
      prev = c; c = n;
    }
    if (ok) { arrived++; if (shortest > 0 && shortest < 65535) ratio.push(k / shortest); }
    else if (k >= LIMIT) outOfTime++;
    else gaveUp++;
  }
  const row = { walkBack: name, arrivedPct: pct(arrived, subjects.length), gaveUpPct: pct(gaveUp, subjects.length), outOfTimePct: pct(outOfTime, subjects.length), stepsOverShortestMedian: +median(ratio).toFixed(2), steppedOnWater: wet };
  results.push(row);
  console.log(JSON.stringify(row));
}
console.log(`RESULT ${JSON.stringify({ seed, years, population: w.population, tested: subjects.length, results })}`);
