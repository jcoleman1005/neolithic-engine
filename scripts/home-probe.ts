/**
 * Watchability, observation only: how people live now that they walk back after drinking.
 * Read only (reads people, land and the chronicle's settlement tracker after each tick; no random
 * draws; the run's stateHash() equals a plain run's). Counted from year 5.
 *   npx vite-node scripts/home-probe.ts -- --seed 1 --years 30 [--someSwitch value]
 * It reports, by distance band from fresh water (0-2, 3-5, 6-10, 11-20, 21+ tiles):
 *   - water trips: how far out the remembered place is, and how each walk back ends;
 *   - who is at the bank: on a trip, or living there, and where they were born;
 *   - a person's year: the nearest and furthest they got from water;
 *   - where people born in each band live as adults;
 *   - the seasons: where adults are in each quarter of the year;
 *   - settlements: how many, how big, and how far from water.
 */
import { World } from '../src/sim/world';
import { Chronicle } from '../src/sim/chronicle';
import { parseArgs } from './args';

const { named, overrides } = parseArgs(process.argv.slice(2), ['seed', 'years']);
const seed = parseInt(named.seed ?? '1', 10);
const years = parseInt(named.years ?? '30', 10);
const w = new World(overrides as never, seed);
const cfg = w.config;
const L = w.land;
const tpy = cfg.ticksPerYear || 360;
const FROM = 5 * tpy;
const adultAge = cfg.adultAge ?? 5760;
const BANDS = [2, 5, 10, 20, 255];
const NB = 5;
const bandOf = new Uint8Array(65536);
for (let i = 0; i < 65536; i++) { let b = 0; while (L.waterDist[i] > BANDS[b]) b++; bandOf[i] = b; }
const chronicle = new Chronicle();
const wrap = (a: number, b: number): number => { const v = Math.abs(a - b); return v > 128 ? 256 - v : v; };

let cap = 0;
let lastGen = new Int32Array(0), lastState = new Uint8Array(0), natal = new Uint8Array(0);
let tripStart = new Int32Array(0), yrMin = new Uint8Array(0), yrMax = new Uint8Array(0), yrSeen = new Uint16Array(0);
const ensure = (need: number): void => {
  if (need <= cap) return;
  const g = <T extends Int32Array | Uint8Array | Uint16Array>(a: T, fill = 0): T => {
    const n = new (a.constructor as new (n: number) => T)(need);
    if (fill !== 0) n.fill(fill);
    n.set(a);
    return n;
  };
  lastGen = g(lastGen, -1); lastState = g(lastState); natal = g(natal, 255);
  tripStart = g(tripStart, -1); yrMin = g(yrMin, 255); yrMax = g(yrMax); yrSeen = g(yrSeen);
  cap = need;
};

// Trips.
const homeDist = new Uint32Array(256); // distance from water of the remembered place, per trip started
let started = 0, arrived = 0, blocked = 0, timedOut = 0, thirstyAgain = 0, dropped = 0;
let roundTripSum = 0, roundTripN = 0;
const stateTicks = new Float64Array(NB * 3); // adult-ticks by band and homeState
// Bank adults by natal band (born in the run) and by trip state.
const bankNatal = new Float64Array(NB + 1); // last = founders or born before counting
// Natal band -> adult band.
const natalAdult = new Float64Array(NB * NB);
// The seasons.
const quarterBand = new Float64Array(4 * NB);
// A person's year: 0 never left the bank (max <= 2), 1 short range (reached water, max 3-5),
// 2 commuter (reached water, max 6+), 3 never beside water (min > 1).
const yearKind = new Float64Array(4);
const yearKindMax = new Float64Array(4);
// Settlements at each year end, by band of their mean distance to water.
const setN = new Float64Array(NB), setRes = new Float64Array(NB);
let setYears = 0, setBig = 0;
let adultTicks = 0;

for (let t = 1; t <= years * tpy; t++) {
  w.step();
  chronicle.record(w);
  if (w.population === 0) break;
  const p = w.people;
  ensure(p.capacity);
  const on = t > FROM;
  const q4 = Math.min(3, Math.floor(((t - 1) % tpy) / (tpy / 4)));
  for (let q = 0; q < p.capacity; q++) {
    if (p.alive[q] === 0) { lastGen[q] = -1; continue; }
    const g = p.slotGenerations[q];
    const cell = (p.y[q] << 8) | p.x[q];
    const b = bandOf[cell];
    const st = p.homeState[q];
    if (lastGen[q] !== g) {
      // A new person in this slot: born now (or a founder on the first tick).
      natal[q] = t === 1 ? 255 : b;
      lastGen[q] = g; lastState[q] = st; tripStart[q] = -1; yrMin[q] = 255; yrMax[q] = 0; yrSeen[q] = 0;
    }
    const prev = lastState[q];
    if (on && st !== prev) {
      if (prev === 0 && st === 1) { started++; homeDist[L.waterDist[(p.homeY[q] << 8) | p.homeX[q]]]++; tripStart[q] = t; }
      else if (prev === 2 && st === 1) thirstyAgain++;
      else if (prev === 1 && st === 0) dropped++;
      else if (prev === 2 && st === 0) {
        if (wrap(p.x[q], p.homeX[q]) <= 1 && wrap(p.y[q], p.homeY[q]) <= 1) {
          arrived++;
          if (tripStart[q] >= 0) { roundTripSum += t - tripStart[q]; roundTripN++; }
        } else if (p.homeTicks[q] === 0) timedOut++;
        else blocked++;
        tripStart[q] = -1;
      }
    }
    lastState[q] = st;
    if (p.age[q] < adultAge) continue;
    const wd = L.waterDist[cell];
    if (wd < yrMin[q]) yrMin[q] = wd;
    if (wd > yrMax[q] && wd < 255) yrMax[q] = wd;
    yrSeen[q]++;
    if (!on) continue;
    adultTicks++;
    stateTicks[b * 3 + st]++;
    quarterBand[q4 * NB + b]++;
    if (natal[q] !== 255) natalAdult[natal[q] * NB + b]++;
    if (b === 0) bankNatal[natal[q] === 255 ? NB : natal[q]]++;
  }
  if (t % tpy === 0) {
    if (on) {
      for (let q = 0; q < p.capacity; q++) {
        if (p.alive[q] === 0 || yrSeen[q] < tpy) continue; // adults seen the whole year
        const k = yrMin[q] > 1 ? 3 : yrMax[q] <= 2 ? 0 : yrMax[q] <= 5 ? 1 : 2;
        yearKind[k]++; yearKindMax[k] += yrMax[q];
      }
      setYears++;
      for (const r of chronicle.settlements.records.values()) {
        let d = 0, n = 0;
        for (const c of r.cells) { const v = L.waterDist[c]; if (v < 255) { d += v; n++; } }
        if (n === 0) continue;
        let b = 0;
        while (d / n > BANDS[b]) b++;
        setN[b]++; setRes[b] += r.residents;
        if (r.residents >= 20) setBig++;
      }
    }
    yrMin.fill(255); yrMax.fill(0); yrSeen.fill(0);
  }
}

const r1 = (v: number): number => +v.toFixed(1);
const pct = (a: number, n: number): number => r1(100 * a / Math.max(1, n));
const quant = (h: Uint32Array, q: number): number => {
  let tot = 0;
  for (let i = 0; i < h.length; i++) tot += h[i];
  let acc = 0;
  for (let i = 0; i < h.length; i++) { acc += h[i]; if (acc >= q * tot) return i; }
  return -1;
};
const ended = arrived + blocked + timedOut;
const yrTot = yearKind.reduce((a, b) => a + b, 0);
const bandRow = (off: number, arr: Float64Array, n: number): number[] => { let tot = 0; for (let k = 0; k < n; k++) tot += arr[off + k]; return Array.from({ length: n }, (_, k) => pct(arr[off + k], tot)); };
const bankTot = stateTicks[0] + stateTicks[1] + stateTicks[2];
const out = {
  seed, years, popEnd: w.population,
  // Water trips (from 3 or more tiles out).
  tripsPerAdultYear: r1(started / Math.max(1, adultTicks) * tpy),
  rememberedPlaceDistMedian: quant(homeDist, 0.5), rememberedPlaceDistP90: quant(homeDist, 0.9), rememberedPlaceDistP99: quant(homeDist, 0.99),
  walkBackArrivedPct: pct(arrived, ended), walkBackBlockedByWaterPct: pct(blocked, ended), walkBackTimedOutPct: pct(timedOut, ended),
  thirstyAgainOnTheWayPct: pct(thirstyAgain, started), droppedBeforeLeavingPct: pct(dropped, started),
  roundTripTicksMean: r1(roundTripSum / Math.max(1, roundTripN)),
  // Adult time by band, split into no trip / going to water or drinking / walking back.
  adultTimeByBandPct: [0, 1, 2, 3, 4].map((b) => pct(stateTicks[b * 3] + stateTicks[b * 3 + 1] + stateTicks[b * 3 + 2], adultTicks)),
  onATripShareByBandPct: [0, 1, 2, 3, 4].map((b) => pct(stateTicks[b * 3 + 1] + stateTicks[b * 3 + 2], stateTicks[b * 3] + stateTicks[b * 3 + 1] + stateTicks[b * 3 + 2])),
  bankAdults: { livingTherePct: pct(stateTicks[0], bankTot), drinkingOrArrivingPct: pct(stateTicks[1], bankTot), settingOffBackPct: pct(stateTicks[2], bankTot) },
  // Bank adults by where they were born (bands, then founders).
  bankAdultsBornInBandPct: bandRow(0, bankNatal, NB + 1),
  // Where people born in each band spend their adult time (rows: born 0-2 ... 21+).
  adultBandByNatalBandPct: [0, 1, 2, 3, 4].map((n) => bandRow(n * NB, natalAdult, NB)),
  // A person's year (adults seen all year): never left the bank / short range / commuter / never beside water.
  yearKindPct: Array.from(yearKind, (v) => pct(v, yrTot)),
  yearKindFurthestMean: Array.from(yearKindMax, (v, k) => r1(v / Math.max(1, yearKind[k]))),
  // Adults by band in each quarter (spring, summer, autumn, winter).
  bandByQuarterPct: [0, 1, 2, 3].map((k) => bandRow(k * NB, quarterBand, NB)),
  // Settlements at year ends, by band of their mean distance to water.
  settlementsPerYearByBand: Array.from(setN, (v) => r1(v / Math.max(1, setYears))),
  residentsPerSettlementByBand: Array.from(setRes, (v, b) => r1(v / Math.max(1, setN[b]))),
  settlementsWith20PlusPerYear: r1(setBig / Math.max(1, setYears)),
  hash: w.stateHash(),
};
for (const [k, v] of Object.entries(out)) console.log(`${k}: ${JSON.stringify(v)}`);
console.log(`RESULT ${JSON.stringify(out)}`);
