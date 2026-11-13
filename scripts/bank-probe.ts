/**
 * Watchability diagnosis: why do people end up at the water? Founders are scattered evenly over the
 * land, so the crowd at the bank is made by one of three things, and this probe separates them, by
 * distance band from fresh water (0-2, 3-5, 6-10, 11-20, 21+ tiles):
 *   1. walking: each adult step's change in distance to water, for thirsty walks, winter and summer;
 *      and the people crossing between bands, thirsty or not;
 *   2. dying: deaths by band and by what the body looked like on its last tick;
 *   3. breeding: births by the band they happen in, per adult woman there.
 * Read only: wraps Rules.climb and reads people after each tick. No random draws; the run's
 * stateHash() equals a plain run's.
 *   npx vite-node scripts/bank-probe.ts -- --seed 1 --years 20 [--someSwitch value]
 * Prints the band populations each year, then two periods (years 0-5 and 5 on), then `RESULT {json}`.
 */
import { World } from '../src/sim/world';
import { Rules } from '../src/sim/rules';
import { type People, CARRY_WATER } from '../src/sim/people';
import { type Land } from '../src/sim/land';
import { type ScentFields } from '../src/sim/fields';
import { seasonGrowthFactor } from '../src/sim/seasons';
import { parseArgs } from './args';

const { named, overrides } = parseArgs(process.argv.slice(2), ['seed', 'years']);
const seed = parseInt(named.seed ?? '1', 10);
const years = parseInt(named.years ?? '20', 10);
const w = new World(overrides as never, seed);
const cfg = w.config;
const L = w.land;
const tpy = cfg.ticksPerYear || 360;
const adultAge = cfg.adultAge ?? 5760;
const maxAge = cfg.maxAge ?? 21600;
const maxE = cfg.maxEnergy ?? 100;
const thirstOn = cfg.finiteResourcesEnabled !== false && cfg.thirstEnabled !== false;
const thirstSeek = cfg.thirstSeek ?? 60;
const BANDS = [2, 5, 10, 20, 255];
const NB = 5;
const bandOf = new Uint8Array(65536);
const bandLand = new Float64Array(NB);
for (let i = 0; i < 65536; i++) {
  let b = 0;
  while (L.waterDist[i] > BANDS[b]) b++;
  bandOf[i] = b;
  if (L.isWater[i] === 0) bandLand[b]++;
}

const mkPeriod = () => ({
  ticks: 0,
  // climb decisions by band and state (0 thirsty, 1 not thirsty in the growing half, 2 not thirsty in the cold half)
  n: new Float64Array(NB * 3), steps: new Float64Array(NB * 3), dWater: new Float64Array(NB * 3),
  // adults crossing bands: inward and outward, by state before the step (0 thirsty, 1 not)
  inward: new Float64Array(NB * 2), outward: new Float64Array(NB * 2),
  // person-ticks and body state by band
  personTicks: new Float64Array(NB), adultTicks: new Float64Array(NB), womanTicks: new Float64Array(NB),
  energy: new Float64Array(NB), hydration: new Float64Array(NB), parched: new Float64Array(NB), hungry: new Float64Array(NB),
  births: new Float64Array(NB),
  // deaths by band: 0 old age, 1 dry (hydration at zero), 2 starved or weakened (energy near zero), 3 other (killed with energy left)
  deaths: new Float64Array(NB * 4),
});
const periods = [mkPeriod(), mkPeriod()];
let P = periods[0];
let growing = 1;

type Climb = typeof Rules.climb;
const orig: Climb = Rules.climb.bind(Rules);
(Rules as unknown as { climb: Climb }).climb = (slot, people: People, land: Land, fields: ScentFields, config, prng, crowdHere = 1) => {
  if (people.age[slot] < adultAge) return orig(slot, people, land, fields, config, prng, crowdHere);
  const px = people.x[slot], py = people.y[slot];
  const cell = (py << 8) | px;
  const hasWater = people.carryKind[slot] === CARRY_WATER && people.carry[slot] > 0;
  const thirsty = thirstOn && !hasWater && people.hydration[slot] < thirstSeek;
  const dir = orig(slot, people, land, fields, config, prng, crowdHere);
  const k = bandOf[cell] * 3 + (thirsty ? 0 : growing ? 1 : 2);
  P.n[k]++;
  if (dir !== 4) {
    const nx = dir === 0 ? (px + 1) & 255 : dir === 1 ? (px - 1) & 255 : px;
    const ny = dir === 2 ? (py + 1) & 255 : dir === 3 ? (py - 1) & 255 : py;
    P.steps[k]++;
    P.dWater[k] += land.waterDist[(ny << 8) | nx] - land.waterDist[cell];
  }
  return dir;
};

// Last tick's view of each slot.
let cap = 0;
let lastGen = new Int32Array(0), lastBand = new Uint8Array(0), lastThirsty = new Uint8Array(0), lastAdult = new Uint8Array(0);
let lastE = new Float32Array(0), lastH = new Float32Array(0), lastAge = new Int32Array(0);
const ensure = (need: number): void => {
  if (need <= cap) return;
  const g = <T extends Int32Array | Uint8Array | Float32Array>(a: T, fill = 0): T => {
    const n = new (a.constructor as new (n: number) => T)(need);
    if (fill !== 0) n.fill(fill);
    n.set(a);
    return n;
  };
  lastGen = g(lastGen, -1); lastBand = g(lastBand); lastThirsty = g(lastThirsty); lastAdult = g(lastAdult);
  lastE = g(lastE); lastH = g(lastH); lastAge = g(lastAge);
  cap = need;
};
const hungryBelow = (cfg.hungerDriveThreshold ?? 0.35) * maxE;
const popByYear: number[][] = [];

const scan = (first: boolean): void => {
  const p = w.people;
  ensure(p.capacity);
  for (let q = 0; q < p.capacity; q++) {
    const aliveNow = p.alive[q] === 1;
    const g = aliveNow ? p.slotGenerations[q] : -1;
    if (!first && lastGen[q] !== -1 && lastGen[q] !== g) {
      // The person seen here last tick is gone.
      const b = lastBand[q];
      const cause = lastAge[q] >= maxAge - 1 ? 0 : thirstOn && lastH[q] <= 0.5 ? 1 : lastE[q] <= 2 ? 2 : 3;
      P.deaths[b * 4 + cause]++;
    }
    if (!aliveNow) { lastGen[q] = -1; continue; }
    const b = bandOf[(p.y[q] << 8) | p.x[q]];
    const adult = p.age[q] >= adultAge;
    if (!first && lastGen[q] !== g) P.births[b]++;
    else if (!first && adult && lastAdult[q] === 1 && b !== lastBand[q]) {
      if (b < lastBand[q]) P.inward[lastBand[q] * 2 + (lastThirsty[q] ? 0 : 1)]++;
      else P.outward[lastBand[q] * 2 + (lastThirsty[q] ? 0 : 1)]++;
    }
    P.personTicks[b]++;
    P.energy[b] += p.energy[q]; P.hydration[b] += p.hydration[q];
    if (p.hydration[q] < 30) P.parched[b]++;
    if (p.energy[q] < hungryBelow) P.hungry[b]++;
    if (adult) { P.adultTicks[b]++; if (p.sex[q] === 0) P.womanTicks[b]++; }
    lastGen[q] = g; lastBand[q] = b; lastAdult[q] = adult ? 1 : 0;
    lastThirsty[q] = thirstOn && p.hydration[q] < thirstSeek ? 1 : 0;
    lastE[q] = p.energy[q]; lastH[q] = p.hydration[q]; lastAge[q] = p.age[q];
  }
};
const census = (): number[] => {
  const c = [0, 0, 0, 0, 0];
  const p = w.people;
  for (let q = 0; q < p.capacity; q++) if (p.alive[q] === 1) c[bandOf[(p.y[q] << 8) | p.x[q]]]++;
  return c;
};

scan(true);
popByYear.push(census());
for (let t = 1; t <= years * tpy; t++) {
  P = periods[t <= 5 * tpy ? 0 : 1];
  growing = seasonGrowthFactor(w.tick, cfg) >= 1 ? 1 : 0;
  w.step();
  P.ticks++;
  scan(false);
  if (w.population === 0) break;
  if (t % tpy === 0) popByYear.push(census());
}

const r = (v: number, d = 2): number => +v.toFixed(d);
const landPct = Array.from(bandLand, (v) => r(100 * v / bandLand.reduce((a, b) => a + b, 0), 1));
console.log('land share by band %', JSON.stringify(landPct));
popByYear.forEach((c, y) => {
  const tot = c.reduce((a, b) => a + b, 0);
  if (y <= 6 || y % 5 === 0) console.log(`year ${y}: pop ${tot}, share by band % ${JSON.stringify(c.map((v) => r(100 * v / Math.max(1, tot), 1)))}`);
});
const summary = (p: ReturnType<typeof mkPeriod>) => {
  const yrs = Math.max(1e-9, p.ticks / tpy);
  const perBand = (f: (b: number) => number): number[] => [0, 1, 2, 3, 4].map(f);
  const drift = (s: number): number[] => perBand((b) => r(p.dWater[b * 3 + s] / Math.max(1, p.n[b * 3 + s]), 4));
  const stepRate = (s: number): number[] => perBand((b) => r(p.steps[b * 3 + s] / Math.max(1, p.n[b * 3 + s]), 3));
  const meanPeople = perBand((b) => p.personTicks[b] / Math.max(1, p.ticks));
  return {
    years: r(yrs, 1),
    meanPeople: meanPeople.map((v) => Math.round(v)),
    // Share of adult decisions made while thirsty, and the mean change in distance to water per decision (negative = toward water).
    thirstyDecisionPct: perBand((b) => r(100 * p.n[b * 3] / Math.max(1, p.n[b * 3] + p.n[b * 3 + 1] + p.n[b * 3 + 2]), 1)),
    driftThirsty: drift(0), driftGrowingHalf: drift(1), driftColdHalf: drift(2),
    stepRateThirsty: stepRate(0), stepRateGrowingHalf: stepRate(1), stepRateColdHalf: stepRate(2),
    // Adults leaving each band per 100 adults there per year, by direction and by whether they were thirsty.
    inwardThirstyPer100: perBand((b) => r(100 * p.inward[b * 2] / Math.max(1, p.adultTicks[b]) * tpy, 1)),
    inwardOtherPer100: perBand((b) => r(100 * p.inward[b * 2 + 1] / Math.max(1, p.adultTicks[b]) * tpy, 1)),
    outwardThirstyPer100: perBand((b) => r(100 * p.outward[b * 2] / Math.max(1, p.adultTicks[b]) * tpy, 1)),
    outwardOtherPer100: perBand((b) => r(100 * p.outward[b * 2 + 1] / Math.max(1, p.adultTicks[b]) * tpy, 1)),
    // Bodies.
    energy: perBand((b) => r(p.energy[b] / Math.max(1, p.personTicks[b]), 1)),
    hydration: perBand((b) => r(p.hydration[b] / Math.max(1, p.personTicks[b]), 1)),
    parchedPct: perBand((b) => r(100 * p.parched[b] / Math.max(1, p.personTicks[b]), 1)),
    hungryPct: perBand((b) => r(100 * p.hungry[b] / Math.max(1, p.personTicks[b]), 1)),
    // Per 100 people a year in the band (births: per 100 adult women there).
    birthsPer100Women: perBand((b) => r(100 * p.births[b] / Math.max(1, p.womanTicks[b]) * tpy, 1)),
    deathsOldPer100: perBand((b) => r(100 * p.deaths[b * 4] / Math.max(1, p.personTicks[b]) * tpy, 2)),
    deathsDryPer100: perBand((b) => r(100 * p.deaths[b * 4 + 1] / Math.max(1, p.personTicks[b]) * tpy, 2)),
    deathsStarvedPer100: perBand((b) => r(100 * p.deaths[b * 4 + 2] / Math.max(1, p.personTicks[b]) * tpy, 2)),
    deathsOtherPer100: perBand((b) => r(100 * p.deaths[b * 4 + 3] / Math.max(1, p.personTicks[b]) * tpy, 2)),
  };
};
const out = { seed, years, landPct, popByYear, early: summary(periods[0]), later: summary(periods[1]), hash: w.stateHash() };
for (const k of ['early', 'later'] as const) {
  console.log(`== ${k}`);
  for (const [name, v] of Object.entries(out[k])) console.log(`  ${name}: ${JSON.stringify(v)}`);
}
console.log(`RESULT ${JSON.stringify(out)}`);
