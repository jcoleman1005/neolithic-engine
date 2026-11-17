/**
 * Smoke test on real worlds for a home scent that carries a band's identity, like a colony odour
 * (the user's idea of 2026-11-16). Prototype only (scripts/home-scent-proto.ts); the simulation is
 * not changed. It runs today's world, then:
 *   1. measures the identity itself: how many adults have a band, how big bands are, how spread
 *      out a band's members are, and how often a person's band changes;
 *   2. lays home scents from where people stand and asks of every adult living 6+ tiles from fresh
 *      water: from the shore tile their thirst walk reaches, where does climbing THEIR scent lead?
 *      Compared: one shared scent; one scent per band (exact); and a few shared channels that bands
 *      are hashed into (what a real implementation could afford).
 *   npx vite-node scripts/band-scent-smoke.ts -- --seed 1 --years 20
 */
import { World } from '../src/sim/world';
import { parseArgs } from './args';
import { CELLS, climbScent, settleField, step } from './home-scent-proto';

const { named, overrides } = parseArgs(process.argv.slice(2), ['seed', 'years']);
const seed = parseInt(named.seed ?? '1', 10);
const years = parseInt(named.years ?? '20', 10);
const w = new World(overrides as never, seed);
const tpy = w.config.ticksPerYear || 360;
const L = w.land;
const adultAge = w.config.adultAge ?? 5760;
const wrap = (a: number, b: number): number => { const v = Math.abs(a - b); return v > 128 ? 256 - v : v; };
const pct = (a: number, n: number): number => +(100 * a / Math.max(1, n)).toFixed(1);
const median = (a: number[]): number => { if (a.length === 0) return -1; const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
/** A person's band: their root leader, or themselves when they follow nobody. */
const bandOfSlot = (q: number): number => w.people.rootLeaderId[q] || w.people.idOf(q);

// ---- 1. the identity: how often does it change? ----
for (let t = 1; t <= (years - 1) * tpy; t++) w.step();
const snap = (): Map<number, number> => {
  const m = new Map<number, number>();
  const p = w.people;
  for (let q = 0; q < p.capacity; q++) if (p.alive[q] === 1 && p.age[q] >= adultAge) m.set(p.idOf(q), bandOfSlot(q));
  return m;
};
const changed = (a: Map<number, number>, b: Map<number, number>): number => {
  let n = 0, c = 0;
  for (const [id, band] of a) { const now = b.get(id); if (now === undefined) continue; n++; if (now !== band) c++; }
  return pct(c, n);
};
const yearStart = snap();
let prev = yearStart;
const perSeason: number[] = [];
for (let t = 1; t <= tpy; t++) {
  w.step();
  if (t % 90 === 0) { const now = snap(); perSeason.push(changed(prev, now)); prev = now; }
}
const changedInAYear = changed(yearStart, snap());

const p = w.people;
const members = new Map<number, number[]>(); // band -> cells of everyone in it
const adultsOf = new Map<number, number>();
let adults = 0;
for (let q = 0; q < p.capacity; q++) {
  if (p.alive[q] === 0) continue;
  const b = bandOfSlot(q);
  const c = (p.y[q] << 8) | p.x[q];
  let list = members.get(b);
  if (!list) { list = []; members.set(b, list); }
  list.push(c);
  if (p.age[q] >= adultAge) { adults++; adultsOf.set(b, (adultsOf.get(b) ?? 0) + 1); }
}
let alone = 0, small = 0, mid = 0, big = 0;
for (let q = 0; q < p.capacity; q++) {
  if (p.alive[q] === 0 || p.age[q] < adultAge) continue;
  const n = members.get(bandOfSlot(q))!.length;
  if (n === 1) alone++; else if (n < 10) small++; else if (n < 50) mid++; else big++;
}
// How spread out is a band? For bands of 10 or more: the share of members within 5 and 15 tiles of the
// member who has the most bandmates near them (the band's densest spot).
const spread5: number[] = [], spread15: number[] = [];
for (const list of members.values()) {
  if (list.length < 10) continue;
  let best5 = 0, best15 = 0;
  for (const c of list) {
    let n5 = 0, n15 = 0;
    for (const o of list) {
      const d = Math.max(wrap(c & 255, o & 255), wrap(c >> 8, o >> 8));
      if (d <= 5) n5++;
      if (d <= 15) n15++;
    }
    if (n5 > best5) best5 = n5;
    if (n15 > best15) best15 = n15;
  }
  spread5.push(100 * best5 / list.length); spread15.push(100 * best15 / list.length);
}
const identity = {
  seed, year: years, population: w.population, adults, bands: members.size,
  adultsAlonePct: pct(alone, adults), adultsInBandsOf2to9Pct: pct(small, adults), adultsInBandsOf10to49Pct: pct(mid, adults), adultsInBandsOf50PlusPct: pct(big, adults),
  bandsOf10Plus: spread5.length,
  membersWithin5TilesOfDensestSpotPctMedian: +median(spread5).toFixed(0), membersWithin15TilesPctMedian: +median(spread15).toFixed(0),
  adultsChangingBandPerSeasonPct: perSeason, adultsChangingBandInAYearPct: changedInAYear,
};
console.log(`identity ${JSON.stringify(identity)}`);

// A finer identity for comparison: the family (a mother, her mate and her children under adult age).
const familyOfSlot = (q: number): number => {
  if (p.age[q] < adultAge && p.motherId[q] !== 0) return p.motherId[q];
  if (p.sex[q] === 1 && p.mateId[q] !== 0) return p.mateId[q];
  return p.idOf(q);
};
const familyCells = new Map<number, number[]>();
for (let q = 0; q < p.capacity; q++) {
  if (p.alive[q] === 0) continue;
  const f = familyOfSlot(q);
  let list = familyCells.get(f);
  if (!list) { list = []; familyCells.set(f, list); }
  list.push((p.y[q] << 8) | p.x[q]);
}
// ---- 2. where does a band's scent lead? ----
interface Subject { slot: number; home: number; shore: number; band: number; family: number }
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
  if (L.waterDist[c] <= 1) subjects.push({ slot: q, home, shore: c, band: bandOfSlot(q), family: familyOfSlot(q) });
}
const inland = (c: number): boolean => L.waterDist[c] >= 3 && L.waterDist[c] < 255;
const RATE = 0.1, EVAP = 0.005, STEPS = 800;
const results: Record<string, unknown>[] = [];
/** Scores the climbs. `fieldFor(subject)` gives the scent that subject follows. */
const score = (name: string, fields: number, fieldFor: (s: Subject) => Float32Array): void => {
  let own = 0, bank = 0, mates = 0, strangers = 0, none = 0, wet = 0;
  const off: number[] = [];
  for (const s of subjects) {
    const walk = climbScent(fieldFor(s), L.isWater, s.shore);
    if (walk.touchedWater) wet++;
    const dx = wrap(walk.end & 255, s.home & 255), dy = wrap(walk.end >> 8, s.home >> 8);
    off.push(Math.max(dx, dy));
    if (walk.steps === 0) { none++; continue; }
    if (dx <= 3 && dy <= 3) { own++; continue; }
    if (L.waterDist[walk.end] <= 2) { bank++; continue; }
    // Somewhere else inland: is anyone of their band there?
    let found = false;
    for (const c of members.get(s.band)!) {
      if (Math.max(wrap(c & 255, walk.end & 255), wrap(c >> 8, walk.end >> 8)) <= 3) { found = true; break; }
    }
    if (found) mates++; else strangers++;
  }
  const n = subjects.length;
  const row = {
    scent: name, fields, backToOwnCampPct: pct(own, n), toBandmatesElsewherePct: pct(mates, n), toStrangersInlandPct: pct(strangers, n),
    toTheBankPct: pct(bank, n), noSlopePct: pct(none, n), endOffByTilesMedian: median(off), steppedOnWater: wet,
  };
  results.push(row);
  console.log(JSON.stringify(row));
};

for (const [layName, lays] of [['everyone lays it', () => true], ['laid 3+ tiles from water', inland]] as const) {
  // One shared scent.
  const shared = new Float32Array(CELLS);
  for (const list of members.values()) for (const c of list) if (lays(c)) shared[c] += 1;
  const sharedField = settleField(L.isWater, shared, RATE, EVAP, STEPS);
  score(`shared, ${layName}`, 1, () => sharedField);

  // One scent per band (exact identity). Only the bands of the people tested need settling.
  const exact = new Map<number, Float32Array>();
  for (const s of subjects) {
    if (exact.has(s.band)) continue;
    const src = new Float32Array(CELLS);
    for (const c of members.get(s.band)!) if (lays(c)) src[c] += 1;
    exact.set(s.band, settleField(L.isWater, src, RATE, EVAP, STEPS));
  }
  score(`one per band (${exact.size} bands among those tested), ${layName}`, members.size, (s) => exact.get(s.band)!);

  // One scent per family (exact), to see whether a finer identity than the band is what is needed.
  const fam = new Map<number, Float32Array>();
  for (const s of subjects) {
    if (fam.has(s.family)) continue;
    const src = new Float32Array(CELLS);
    for (const c of familyCells.get(s.family)!) if (lays(c)) src[c] += 1;
    fam.set(s.family, settleField(L.isWater, src, RATE, EVAP, STEPS));
  }
  score(`one per family (${fam.size} families among those tested), ${layName}`, familyCells.size, (s) => fam.get(s.family)!);

  // A few shared channels; a band is hashed into one, so unrelated bands sometimes share a scent.
  for (const K of [4, 8, 16]) {
    // A full mix first: band ids are slot and generation packed together, so their low bits barely vary.
    const chan = (band: number): number => {
      let h = Math.imul(band ^ (band >>> 15), 2246822519);
      h = Math.imul(h ^ (h >>> 13), 3266489917);
      return ((h ^ (h >>> 16)) >>> 0) % K;
    };
    const src = Array.from({ length: K }, () => new Float32Array(CELLS));
    for (const [band, list] of members) for (const c of list) if (lays(c)) src[chan(band)][c] += 1;
    const fields = src.map((s) => settleField(L.isWater, s, RATE, EVAP, STEPS));
    score(`${K} channels, ${layName}`, K, (s) => fields[chan(s.band)]);
  }
}
// The honest version of the family scent: the person tested is away at the water, so their own scent
// is left out, and only the family members still at home lay it. Someone with no family at home has
// nothing to follow. (Laid 3+ tiles from water.)
{
  let own = 0, bank = 0, elsewhere = 0, none = 0, alone = 0;
  const off: number[] = [];
  for (const s of subjects) {
    const src = new Float32Array(CELLS);
    let any = false, skipped = false;
    for (const c of familyCells.get(s.family)!) {
      if (!skipped && c === s.home) { skipped = true; continue; } // their own share
      if (inland(c)) { src[c] += 1; any = true; }
    }
    if (!any) { alone++; none++; off.push(Math.max(wrap(s.shore & 255, s.home & 255), wrap(s.shore >> 8, s.home >> 8))); continue; }
    const walk = climbScent(settleField(L.isWater, src, RATE, EVAP, STEPS), L.isWater, s.shore);
    const dx = wrap(walk.end & 255, s.home & 255), dy = wrap(walk.end >> 8, s.home >> 8);
    off.push(Math.max(dx, dy));
    if (walk.steps === 0) none++;
    else if (dx <= 3 && dy <= 3) own++;
    else if (L.waterDist[walk.end] <= 2) bank++;
    else elsewhere++;
  }
  const n = subjects.length;
  const row = {
    scent: 'one per family, their own scent left out, laid 3+ tiles from water', backToOwnCampPct: pct(own, n), toFamilyElsewherePct: pct(elsewhere, n),
    toTheBankPct: pct(bank, n), noSlopePct: pct(none, n), ofWhichNoFamilyAtHomePct: pct(alone, n), endOffByTilesMedian: median(off),
  };
  results.push(row);
  console.log(JSON.stringify(row));
}
console.log(`RESULT ${JSON.stringify({ identity, tested: subjects.length, results })}`);
