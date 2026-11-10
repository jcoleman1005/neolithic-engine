/**
 * S4a probe: does farming near settlements make a surplus that feeds people? Observer only: it wraps
 * Land.graze / takePile / dropFood / pickBerries / catchFish / step (and Herds.step, Wolves.step,
 * Herds.kill, Rules.concede for context) to count food flows, and makes no random draws.
 *   npx vite-node scripts/surplus-probe.ts -- --seed 1 --years 50 [--pileSpoil 0.002]
 * Flows and samples count from year 10 on. Prints one line a decade and a final `RESULT {json}` line.
 *
 * "Worked" soil is a cell the viewer draws as farmland or seeded: farmLevel >= cropRipenMinFarmLevel
 * (the golden-crop rule in Land.packOverlay) or seedLevel >= 1. "Golden" uses the packOverlay rule.
 * The settlement zone is every cell within 4 tiles (square) of a cell of a tracked settlement.
 *
 * Limit: people's grazing is one count. Land.graze is called both to eat and to gather food into the
 * carry (hoarding), and the probe cannot tell those two calls apart without touching the sim, so
 * `peopleLand*` is everything people took from plants, eaten on the spot or carried. `heapInStock` is every
 * non-wolf drop that is not a hunter's kill: carriers unloading, and the carry a fight loser drops.
 */
import { World } from '../src/sim/world';
import { Rules } from '../src/sim/rules';
import { Chronicle } from '../src/sim/chronicle';
import { type People } from '../src/sim/people';
import { FORM_GRANARY } from '../src/sim/land';
import { parseArgs } from './args';

const { named, overrides } = parseArgs(process.argv.slice(2), ['seed', 'years']);
const seed = parseInt(named.seed ?? '1', 10);
const years = parseInt(named.years ?? '50', 10);
const w = new World(overrides as never, seed);
const cfg = w.config;
const tpy = cfg.ticksPerYear || 360;
const maxE = cfg.maxEnergy ?? 100;
const hungryBelow = 0.35 * maxE;
const FROM = 10 * tpy;
const ZONE = 4;
const N = 65536;
const p = w.people;
const L = w.land;
const chronicle = new Chronicle();

const minFarm = cfg.cropRipenMinFarmLevel ?? 2;
const seedCap = cfg.seedCap ?? 10;
const ripen = cfg.cropRipenThreshold ?? 0.70;
const goldenOn = cfg.goldenCropsEnabled !== false;
const fertChange = cfg.fertilityChangeEnabled !== false;
const fertMax = cfg.fertilityMax ?? 1.5;
const fertCompost = cfg.fertilityCompostGain ?? 0.0005;
const baseFoodCap = (L as unknown as { baseFoodCap: number }).baseFoodCap;
const farmLevel = (i: number): number => Math.min(7, Math.round(Math.sqrt(Math.min(1, L.tilled[i])) * 7));
const seedLevel = (i: number): number => Math.min(3, Math.round((L.seeds[i] / seedCap) * 3));
const isWorked = (i: number): boolean => L.isWater[i] === 0 && (farmLevel(i) >= minFarm || seedLevel(i) >= 1);
const isGolden = (i: number): boolean => {
  if (!goldenOn || L.isWater[i] === 1 || farmLevel(i) < minFarm || seedLevel(i) !== 0) return false;
  const cap = L.capacityAt(i, cfg);
  return cap > 0 && L.food[i] >= cap * ripen;
};
const cellOf = (x: number, y: number): number => ((y & 255) << 8) | (x & 255);

// Context: who is calling a Land method. 0 people (LifeSystem, incl. Rules.touch), 1 herds, 2 wolves, 3 concede.
let ctx = 0;
let on = false;
const f = {
  peopleLandWorked: 0, peopleLandWild: 0, herdLandWorked: 0, herdLandWild: 0,
  peopleHeapTaken: 0, meatTaken: 0, meatCarried: 0, wolfHeapTaken: 0, concedeLand: 0, concedeHeap: 0,
  berries: 0, fish: 0, plantMeal: 0,
  heapInStock: 0, heapInMeat: 0, heapInWolf: 0, heapCapLoss: 0,
  spoiled: 0, spoiledGranary: 0, compostFert: 0,
};
type AnyFn = (...a: unknown[]) => unknown;
const hook = <T extends object>(obj: T, name: string, around: (orig: AnyFn, args: unknown[]) => unknown): void => {
  const o = obj as unknown as Record<string, AnyFn>;
  const orig = o[name].bind(obj);
  o[name] = (...args: unknown[]) => around(orig, args);
};
const inCtx = (c: number) => (orig: AnyFn, args: unknown[]) => {
  const prev = ctx; ctx = c;
  try { return orig(...args); } finally { ctx = prev; }
};
hook(w.herds, 'step', inCtx(1));
hook(w.wolves, 'step', inCtx(2));
hook(Rules, 'concede', inCtx(3));

// People's plant take by farmLevel pair (0-1 wild, 2-3, 4-5, 6-7), on seeded cells, and inside the settlement zone.
const landByFarm = [0, 0, 0, 0];
let landSeeded = 0, landZone = 0;
const zone = new Uint8Array(N); // rebuilt at each sample; graze reads the latest one
let meatBite = false;
let meatCell = -1, lastDropCell = -1, lastDropAdded = 0;
hook(L, 'graze', (orig, args) => {
  meatCell = -1;
  const i = cellOf(args[0] as number, args[1] as number);
  const worked = isWorked(i);
  const fl = farmLevel(i), sl = seedLevel(i);
  const got = orig(...args) as number;
  if (on && got > 0) {
    if (ctx === 1) { if (worked) f.herdLandWorked += got; else f.herdLandWild += got; }
    else if (ctx === 3) f.concedeLand += got;
    else if (ctx === 0) {
      if (worked) f.peopleLandWorked += got; else f.peopleLandWild += got;
      landByFarm[fl >> 1] += got;
      if (sl >= 1) landSeeded += got;
      if (zone[i] === 1) landZone += got;
    }
  }
  return got;
});
hook(L, 'takePile', (orig, args) => {
  const i = cellOf(args[0] as number, args[1] as number);
  const got = orig(...args) as number;
  if (on && got > 0) {
    if (ctx === 2) f.wolfHeapTaken += got;
    else if (ctx === 3) f.concedeHeap += got;
    else if (ctx === 0) {
      if (i === meatCell) { if (meatBite) f.meatTaken += got; else f.meatCarried += got; meatBite = false; }
      else f.peopleHeapTaken += got;
    }
  }
  return got;
});
hook(L, 'dropFood', (orig, args) => {
  meatCell = -1;
  const i = cellOf(args[0] as number, args[1] as number);
  const before = L.pile[i];
  const r = orig(...args);
  const added = L.pile[i] - before;
  lastDropCell = i; lastDropAdded = added;
  if (on && L.isWater[i] === 0) {
    f.heapCapLoss += Math.max(0, (args[2] as number) - added);
    if (ctx === 2) f.heapInWolf += added; else f.heapInStock += added;
  }
  return r;
});
// A hunter's kill drops the meat (dropFood) then removes the animal: move that drop from stock to meat.
hook(w.herds, 'kill', (orig, args) => {
  if (ctx === 0 && lastDropCell >= 0) {
    if (on) { f.heapInStock -= lastDropAdded; f.heapInMeat += lastDropAdded; }
    meatCell = lastDropCell;
    meatBite = true;
  }
  lastDropCell = -1;
  return orig(...args);
});
hook(L, 'pickBerries', (orig, args) => { meatCell = -1; const g = orig(...args) as number; if (on && ctx === 0) f.berries += g; return g; });
hook(L, 'catchFish', (orig, args) => { meatCell = -1; const g = orig(...args) as number; if (on && ctx === 0) f.fish += g; return g; });

// Spoilage and compost: snapshot heaps and fertility around Land.step, which is the only place heaps rot.
const prePile = new Float32Array(N), preFert = new Float32Array(N), preForm = new Uint8Array(N);
hook(L, 'step', (orig, args) => {
  if (!on) return orig(...args);
  prePile.set(L.pile); preFert.set(L.fertility); preForm.set(L.form);
  const r = orig(...args);
  for (let i = 0; i < N; i++) {
    const before = prePile[i];
    if (before <= 0) continue;
    const sp = before - L.pile[i];
    if (sp <= 0) continue;
    f.spoiled += sp;
    if (preForm[i] === FORM_GRANARY) f.spoiledGranary += sp;
    if (fertChange && L.isWater[i] === 0 && sp > 0.01 && preFert[i] < fertMax) {
      const g = Math.min(fertMax, preFert[i] + fertCompost * Math.min(1, sp / 5.0) * (1 - preFert[i] / fertMax)) - preFert[i];
      f.compostFert += g;
    }
  }
  return r;
});

let births = 0, ticked = false;
const origSpawn = p.spawn.bind(p);
p.spawn = ((...args: Parameters<People['spawn']>) => { if (ticked) births++; return origSpawn(...args); }) as People['spawn'];

// Samples (every 30 days from year 10).
const stamp = new Int32Array(N);
let stampN = 0;
const s = {
  n: 0, golden: 0, goldenZone: 0, worked: 0, workedZone: 0, zoneCells: 0, heap: 0, heapZone: 0,
  inPeople: 0, inHungry: 0, outPeople: 0, outHungry: 0, settlements: 0, residents: 0,
  zoneCap: 0, worldCap: 0, fertLand: 0, fertZone: 0,
};
let landCells = 0;
for (let i = 0; i < N; i++) if (L.isWater[i] === 0) landCells++;
const buildZone = (): void => {
  zone.fill(0);
  for (const r of chronicle.settlements.records.values()) {
    for (const c of r.cells) {
      const cx = c & 255, cy = c >> 8;
      for (let dy = -ZONE; dy <= ZONE; dy++) for (let dx = -ZONE; dx <= ZONE; dx++) zone[cellOf(cx + dx, cy + dy)] = 1;
    }
  }
};
/** Settlements with at least `min` golden cells within 4 tiles of their own cells. */
const ringed = (min: number): number => {
  let n = 0;
  for (const r of chronicle.settlements.records.values()) {
    stampN++;
    let g = 0;
    for (const c of r.cells) {
      const cx = c & 255, cy = c >> 8;
      for (let dy = -ZONE; dy <= ZONE; dy++) for (let dx = -ZONE; dx <= ZONE; dx++) {
        const k = cellOf(cx + dx, cy + dy);
        if (stamp[k] === stampN) continue;
        stamp[k] = stampN;
        if (isGolden(k)) g++;
      }
    }
    if (g >= min) n++;
  }
  return n;
};
const sample = (): void => {
  buildZone();
  s.n++;
  for (let i = 0; i < N; i++) {
    if (L.isWater[i] === 1) continue;
    const z = zone[i] === 1;
    const cap = L.maxFood[i];
    s.worldCap += cap; s.fertLand += L.fertility[i]; s.heap += L.pile[i];
    if (isWorked(i)) { s.worked++; if (z) s.workedZone++; }
    if (isGolden(i)) { s.golden++; if (z) s.goldenZone++; }
    if (z) { s.zoneCells++; s.zoneCap += cap; s.fertZone += L.fertility[i]; s.heapZone += L.pile[i]; }
  }
  for (let q = 0; q < p.capacity; q++) {
    if (p.alive[q] === 0) continue;
    const hungry = p.energy[q] < hungryBelow ? 1 : 0;
    if (zone[cellOf(p.x[q], p.y[q])] === 1) { s.inPeople++; s.inHungry += hungry; } else { s.outPeople++; s.outHungry += hungry; }
  }
  for (const r of chronicle.settlements.records.values()) { s.settlements++; s.residents += r.residents; }
};

let popSum = 0, popN = 0, died = false;
const goldenByYear: number[] = [], ringed5ByYear: number[] = [], pop: number[] = [];
let ringedY30 = -1;
const t0 = Date.now();
for (let t = 1; t <= years * tpy; t++) {
  ticked = true;
  on = t > FROM;
  if (t === FROM + 1) buildZone();
  const meal0 = w.ledger.plantMeal;
  w.step();
  // Every 10th tick World.step runs ledger.check, which clears the flows; read that tick from its report.
  if (on) f.plantMeal += (w.tick % 10 === 0 ? w.ledger.report()?.flows.plantMeal ?? 0 : w.ledger.plantMeal) - meal0;
  chronicle.record(w);
  if (w.population === 0) { died = true; break; }
  popSum += w.population; popN++;
  if (on && t % 30 === 0) sample();
  if (t % tpy === 0) {
    const y = t / tpy;
    pop.push(w.population);
    let g = 0;
    for (let i = 0; i < N; i++) if (isGolden(i)) g++;
    goldenByYear.push(g);
    const r5 = ringed(5);
    ringed5ByYear.push(r5);
    if (y === 30) ringedY30 = r5;
    if (y % 10 === 0) {
      console.log(`year ${y}: pop ${w.population}, golden ${g}, settlementsRinged(>=5 golden) ${r5}/${chronicle.settlements.records.size}, heap ${L.pile.reduce((a, b) => a + b, 0).toFixed(0)}, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    }
  }
}
const ts = chronicle.settlements;
const lives = ts.endedLifetimes.map((l) => l / tpy);
for (const r of ts.records.values()) lives.push((w.tick - r.foundedTick) / tpy);
const meanPop = popSum / Math.max(1, popN);
const flowYears = Math.max(1e-9, (Math.min(w.tick, years * tpy) - FROM) / tpy);
const r1 = (v: number): number => +v.toFixed(1);
const r3 = (v: number): number => +v.toFixed(3);
const perYear = (v: number): number => r1(v / flowYears);
const sn = Math.max(1, s.n);
const peopleLand = f.peopleLandWorked + f.peopleLandWild;
const heapIn = f.heapInStock + f.heapInMeat + f.heapInWolf;
const result = {
  seed, years, diedOut: died, popEnd: w.population, meanPop: Math.round(meanPop),
  birthsPerHeadYear: +(births / Math.max(1, meanPop) / (popN / tpy)).toFixed(4),
  settlements10y: lives.filter((l) => l >= 10).length, settlementsAll: lives.length,
  // Plants people took (eaten on the spot or carried), worked against wild soil.
  workedSharePct: r1(100 * f.peopleLandWorked / Math.max(1e-9, peopleLand)),
  landByFarmLevelPct: landByFarm.map((v) => r1(100 * v / Math.max(1e-9, peopleLand))),
  landSeededPct: r1(100 * landSeeded / Math.max(1e-9, peopleLand)), landZonePct: r1(100 * landZone / Math.max(1e-9, peopleLand)),
  peopleLandPerYear: perYear(peopleLand), herdWorkedSharePct: r1(100 * f.herdLandWorked / Math.max(1e-9, f.herdLandWorked + f.herdLandWild)),
  // What people ate (ledger plantMeal) and the parts the probe can name.
  mealsPerYear: perYear(f.plantMeal), heapMealSharePct: r1(100 * f.peopleHeapTaken / Math.max(1e-9, f.plantMeal)),
  meatSharePct: r1(100 * f.meatTaken / Math.max(1e-9, f.plantMeal)), berrySharePct: r1(100 * f.berries / Math.max(1e-9, f.plantMeal)),
  fishSharePct: r1(100 * f.fish / Math.max(1e-9, f.plantMeal)),
  // Heap budget, per year.
  heapInStockPerYear: perYear(f.heapInStock), heapInMeatPerYear: perYear(f.heapInMeat), heapInWolfPerYear: perYear(f.heapInWolf),
  heapCapLossPerYear: perYear(f.heapCapLoss), heapEatenByPeoplePerYear: perYear(f.peopleHeapTaken + f.meatTaken), meatCarriedPerYear: perYear(f.meatCarried),
  heapWolvesPerYear: perYear(f.wolfHeapTaken), heapConcedePerYear: perYear(f.concedeHeap),
  spoiledPerYear: perYear(f.spoiled), spoiledGranarySharePct: r1(100 * f.spoiledGranary / Math.max(1e-9, f.spoiled)), spoiledShareOfInPct: r1(100 * f.spoiled / Math.max(1e-9, heapIn)),
  // Share of food put on heaps that people ate from the heap (concede and carried meat leave in hands, not eaten).
  eatenShareOfInPct: r1(100 * (f.peopleHeapTaken + f.meatTaken) / Math.max(1e-9, heapIn)),
  compostFertPerYear: r3(f.compostFert / flowYears), compostCapPerYear: r1(f.compostFert * baseFoodCap / flowYears),
  meanHeap: r1(s.heap / sn), meanHeapZone: r1(s.heapZone / sn),
  // Fields and settlements (means over samples).
  meanGolden: r1(s.golden / sn), meanGoldenZone: r1(s.goldenZone / sn), meanWorked: r1(s.worked / sn), meanWorkedZone: r1(s.workedZone / sn),
  meanZoneCells: r1(s.zoneCells / sn), ringedY30, ringed5End: ringed5ByYear[ringed5ByYear.length - 1] ?? 0,
  meanSettlements: r1(s.settlements / sn), residentsPerSettlement: r1(s.residents / Math.max(1, s.settlements)),
  hungryInPct: r1(100 * s.inHungry / Math.max(1, s.inPeople)), hungryOutPct: r1(100 * s.outHungry / Math.max(1, s.outPeople)),
  peopleInZonePct: r1(100 * s.inPeople / Math.max(1, s.inPeople + s.outPeople)),
  peoplePer100CapZone: r3(100 * s.inPeople / Math.max(1e-9, s.zoneCap)), peoplePer100CapOut: r3(100 * s.outPeople / Math.max(1e-9, s.worldCap - s.zoneCap)),
  fertLand: r3(s.fertLand / sn / landCells), fertZone: r3(s.fertZone / Math.max(1, s.zoneCells)),
  goldenByYear, pop, hash: w.stateHash(),
};
console.log(`RESULT ${JSON.stringify(result)}`);
