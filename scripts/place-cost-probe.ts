/**
 * S3x unit A probe (adapted from scripts/wound-probe.ts): how the place cost changes where clash
 * losers and winners are 90 days later, and its guardrails. Clashes are caught by wrapping
 * Rules.touch, so it measures the same with the place cost on or off. Observer only.
 *   npx vite-node scripts/place-cost-probe.ts -- --seed 1 --years 50 [--placeCostEnabled false]
 * Prints one line a decade and a final `RESULT {json}` line.
 */
import { World } from '../src/sim/world';
import { Rules } from '../src/sim/rules';
import { Chronicle } from '../src/sim/chronicle';
import { slotFromId, type People } from '../src/sim/people';
import { wrapDiff } from '../src/sim/land';
import { parseArgs } from './args';

const { named, overrides } = parseArgs(process.argv.slice(2), ['seed', 'years']);
const seed = parseInt(named.seed ?? '1', 10);
const years = parseInt(named.years ?? '50', 10);
const w = new World(overrides as never, seed);
const tpy = w.config.ticksPerYear || 360;
const adultAge = w.config.adultAge ?? 5760;
const R = w.config.costRadius ?? 8;
const LATER = 90;
const p = w.people;
const chronicle = new Chronicle();

// Clash outcomes, queued for a look 90 days later.
const MAXS = 1 << 20;
const qId = new Uint32Array(MAXS), qX = new Uint8Array(MAXS), qY = new Uint8Array(MAXS), qT = new Uint32Array(MAXS), qWin = new Uint8Array(MAXS);
let qHead = 0, qTail = 0;
const away = [[0, 0], [0, 0]]; // [loser, winner] x [checked, away]
const origTouch = Rules.touch;
(Rules as unknown as { touch: typeof Rules.touch }).touch = function (a: number, b: number, people: People, ...rest: unknown[]) {
  const f0 = Rules.clashStats.fights;
  const ea = people.energy[a], eb = people.energy[b];
  const x = people.x[a], y = people.y[a];
  const ida = people.idOf(a), idb = people.idOf(b);
  (origTouch as (...args: unknown[]) => void).call(Rules, a, b, people, ...rest);
  if (Rules.clashStats.fights === f0 || qTail - qHead > MAXS - 2) return;
  const da = people.alive[a] ? people.energy[a] - ea : -Infinity;
  const db = people.alive[b] ? people.energy[b] - eb : -Infinity;
  const loserA = da < db;
  for (const [id, win] of [[ida, loserA ? 0 : 1], [idb, loserA ? 1 : 0]] as const) {
    const i = qTail++ & (MAXS - 1);
    qId[i] = id; qX[i] = x; qY[i] = y; qT[i] = w.tick; qWin[i] = win;
  }
} as typeof Rules.touch;

let births = 0, childDeaths = 0, ticked = false;
const origSpawn = p.spawn.bind(p);
p.spawn = ((...args: Parameters<People['spawn']>) => { if (ticked) births++; return origSpawn(...args); }) as People['spawn'];
const origKill = p.kill.bind(p);
p.kill = (s: number) => { if (p.alive[s] === 1 && p.age[s] < adultAge) childDeaths++; origKill(s); };

let popSum = 0, popN = 0;
let costShareSum = 0, stillSum = 0, capSum = 0, samples = 0;
const pop: number[] = [];
let died = false;
const t0 = Date.now();
for (let t = 1; t <= years * tpy; t++) {
  ticked = true;
  w.step();
  chronicle.record(w);
  while (qHead < qTail && w.tick - qT[qHead & (MAXS - 1)] >= LATER) {
    const i = qHead++ & (MAXS - 1);
    if (!p.isValidId(qId[i])) continue;
    const s = slotFromId(qId[i]);
    const dx = wrapDiff(p.x[s], qX[i]), dy = wrapDiff(p.y[s], qY[i]);
    const a = away[qWin[i]]; a[0]++; if (dx * dx + dy * dy > R * R) a[1]++;
  }
  if (w.population === 0) { died = true; break; }
  popSum += w.population; popN++;
  if (t % 90 === 0 && t >= 10 * tpy) {
    let ad = 0, withCost = 0, still = 0, cap = 0;
    for (let s = 0; s < p.capacity; s++) {
      if (p.alive[s] === 0 || p.age[s] < adultAge) continue;
      ad++;
      if (p.placeCost[s] >= 1) withCost++;
      if (p.prevDir[s] === 4) still++;
      cap += w.land.capacityAt((p.y[s] << 8) | p.x[s], w.config);
    }
    if (ad > 0) { costShareSum += withCost / ad; stillSum += still / ad; capSum += cap / ad; samples++; }
  }
  if (t % tpy === 0) {
    const y = t / tpy;
    pop.push(w.population);
    if (y % 10 === 0) console.log(`year ${y}: pop ${w.population}, losersAway ${(100 * away[0][1] / Math.max(1, away[0][0])).toFixed(1)}%, winnersAway ${(100 * away[1][1] / Math.max(1, away[1][0])).toFixed(1)}%, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
}
const ts = chronicle.settlements;
const lives = ts.endedLifetimes.map((l) => l / tpy);
for (const r of ts.records.values()) lives.push((w.tick - r.foundedTick) / tpy);
const meanPop = popSum / Math.max(1, popN);
const result = {
  seed, years, placeCost: w.config.placeCostEnabled !== false, diedOut: died,
  popEnd: w.population, meanPop: Math.round(meanPop),
  losersAwayPct: +(100 * away[0][1] / Math.max(1, away[0][0])).toFixed(2), losersChecked: away[0][0],
  winnersAwayPct: +(100 * away[1][1] / Math.max(1, away[1][0])).toFixed(2), winnersChecked: away[1][0],
  adultsWithCostPct: +(100 * costShareSum / Math.max(1, samples)).toFixed(2),
  adultsStillPct: +(100 * stillSum / Math.max(1, samples)).toFixed(2),
  capacityUnderfoot: +(capSum / Math.max(1, samples)).toFixed(3),
  birthsPerHeadYear: +(births / Math.max(1, meanPop) / (popN / tpy)).toFixed(4),
  childDeaths, settlements10y: lives.filter((l) => l >= 10).length, settlementsAll: lives.length,
  fights: Rules.clashStats.fights, hash: w.stateHash(),
};
console.log(`RESULT ${JSON.stringify(result)}`);
