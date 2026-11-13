/**
 * Watchability W0: the measuring part of the watch probe (docs/WATCHABILITY.md, section 3).
 * Observer only: it wraps Land.graze, Land.step and Herds.step to count plant food flows, reads
 * people, land and the chronicle, and makes no random draws. The only thing it writes in the world
 * is the event bits of `People.activity`, which it clears after reading the way
 * `World.packPeopleFrame` does; that byte is not saved, hashed or read by the simulation.
 *
 * Use: `const probe = attachWatchProbe(world)`, then `world.step(); probe.afterStep();` every tick,
 * and `probe.result()` whenever a summary is wanted (it does not reset anything).
 */
import { type World } from '../src/sim/world';
import { Chronicle } from '../src/sim/chronicle';
import { ACT_MASK, ACTIVITY_NAMES, EV_BIRTH, EV_BUILT, EV_FIRE, EV_KILL } from '../src/sim/activity';
import { seasonGrowthFactor } from '../src/sim/seasons';

export interface WatchProbeOptions {
  /** Sample interval in ticks (default 30). */
  readonly every?: number;
  /** Measuring starts after this many years, so the founders' scatter has settled (default 5). */
  readonly fromYear?: number;
}

export interface WatchResult {
  readonly [key: string]: number | boolean | string | number[] | Record<string, number>;
}

export interface WatchProbe {
  afterStep(): void;
  result(): WatchResult;
}

const N = 65536;
const RING = 12; // snapshots a year apart at the default interval: 12 x 30 = 360 ticks
const STAY_RADIUS = 3;
const BAND_MIN = 5;

type AnyFn = (...a: unknown[]) => unknown;
const hook = <T extends object>(obj: T, name: string, around: (orig: AnyFn, args: unknown[]) => unknown): void => {
  const o = obj as unknown as Record<string, AnyFn>;
  const orig = o[name].bind(obj);
  o[name] = (...args: unknown[]) => around(orig, args);
};
/** Shortest distance along one axis of the wrapping 256 grid. */
const wrapD = (d: number): number => {
  const a = Math.abs(d) & 255;
  return a > 128 ? 256 - a : a;
};
const r1 = (v: number): number => +v.toFixed(1);
const r3 = (v: number): number => +v.toFixed(3);

export function attachWatchProbe(w: World, options: WatchProbeOptions = {}): WatchProbe {
  const cfg = w.config;
  const tpy = cfg.ticksPerYear || 360;
  const every = Math.max(1, options.every ?? 30);
  const FROM = (options.fromYear ?? 5) * tpy;
  const lag = Math.max(1, Math.round(tpy / every)); // samples in a year
  const ringN = Math.max(RING, lag);
  const adultAge = cfg.adultAge ?? 5760;
  const hungryBelow = (cfg.hungerDriveThreshold ?? 0.35) * (cfg.maxEnergy ?? 100);
  const L = w.land;
  const chronicle = new Chronicle();
  const startTick = w.tick;

  // ---- plant food flows (land-wide) ----
  let on = false;
  let inHerds = false;
  let grazedPeople = 0, grazedHerds = 0, regrown = 0, withered = 0;
  hook(w.herds, 'step', (orig, args) => {
    inHerds = true;
    try { return orig(...args); } finally { inHerds = false; }
  });
  hook(L, 'graze', (orig, args) => {
    const got = orig(...args) as number;
    if (on && got > 0) { if (inHerds) grazedHerds += got; else grazedPeople += got; }
    return got;
  });
  const preFood = new Float32Array(N);
  hook(L, 'step', (orig, args) => {
    if (!on) return orig(...args);
    preFood.set(L.food);
    const r = orig(...args);
    const food = L.food;
    for (let i = 0; i < N; i++) {
      const d = food[i] - preFood[i];
      if (d > 0) regrown += d; else withered -= d;
    }
    return r;
  });

  // ---- per-slot scratch (regrown when People grows) ----
  let cap = 0;
  let prevX = new Uint8Array(0), prevY = new Uint8Array(0), prevGen = new Int32Array(0);
  let stayX = new Uint8Array(0), stayY = new Uint8Array(0), stayGen = new Int32Array(0), stayStart = new Int32Array(0);
  let stayGrowing = new Uint8Array(0);
  let ringX = new Uint8Array(0), ringY = new Uint8Array(0), ringGen = new Int32Array(0);
  const ensure = (need: number): void => {
    if (need <= cap) return;
    const g8 = (a: Uint8Array, k = 1): Uint8Array => { const n = new Uint8Array(need * k); n.set(a); return n; };
    const g32 = (a: Int32Array, k = 1): Int32Array => { const n = new Int32Array(need * k).fill(-1); n.set(a); return n; };
    // The ring is laid out [snapshot][slot], so it is rebuilt slot by slot.
    const nx = new Uint8Array(need * ringN), ny = new Uint8Array(need * ringN), ng = new Int32Array(need * ringN).fill(-1);
    for (let k = 0; k < ringN; k++) {
      nx.set(ringX.subarray(k * cap, (k + 1) * cap), k * need);
      ny.set(ringY.subarray(k * cap, (k + 1) * cap), k * need);
      ng.set(ringGen.subarray(k * cap, (k + 1) * cap), k * need);
    }
    ringX = nx; ringY = ny; ringGen = ng;
    prevX = g8(prevX); prevY = g8(prevY); prevGen = g32(prevGen);
    stayX = g8(stayX); stayY = g8(stayY); stayGen = g32(stayGen); stayStart = g32(stayStart);
    stayGrowing = g8(stayGrowing);
    cap = need;
  };

  // ---- counters ----
  let adultTicks = 0, adultMoves = 0;
  let personTicks = 0;
  const actTicks = new Float64Array(16);
  let kills = 0, births = 0, fires = 0, huts = 0;
  // Completed stays by length in ticks (the last bin holds anything longer).
  const STAY_BINS = 36001;
  const stayHist = new Uint32Array(STAY_BINS);
  const stayHistGrowing = new Uint32Array(STAY_BINS);
  let stays = 0, staysGrowing = 0;
  let samples = 0, sampleNo = 0;
  let dispSum = 0, dispN = 0;
  let adultsSeen = 0, nearWater = 0, peopleSeen = 0, hungry = 0;
  let fullSum = 0, nearFullSum = 0, tilesPerPersonSum = 0, foodPerTileSum = 0, maxYieldSum = 0;
  const baseRate = cfg.landRegrowthRate ?? 0.05;
  let popSum = 0, popN = 0, flowTicks = 0;
  let died = false;
  const popAtYear: Record<string, number> = {};
  const herdsAtYear: Record<string, number> = {};
  const wolvesAtYear: Record<string, number> = {};
  // Bands: centre a year ago, by band id.
  let bandMarks = new Map<number, { x: number; y: number; travelled: number }>();
  let bandNetSum = 0, bandPathSum = 0, bandYears = 0;
  let migrationsFrom = 0;

  const endStay = (q: number, tick: number): void => {
    const len = Math.min(STAY_BINS - 1, tick - stayStart[q]);
    stayHist[len]++; stays++;
    if (stayGrowing[q] === 1) { stayHistGrowing[len]++; staysGrowing++; }
  };
  const quantile = (hist: Uint32Array, total: number, q: number): number => {
    if (total === 0) return -1;
    const want = q * total;
    let acc = 0;
    for (let i = 0; i < hist.length; i++) { acc += hist[i]; if (acc >= want) return i; }
    return hist.length - 1;
  };

  const sample = (): void => {
    const p = w.people;
    const n = p.capacity;
    const alive = p.alive, x = p.x, y = p.y, age = p.age, gen = p.slotGenerations, energy = p.energy;
    const cur = sampleNo % ringN;
    const old = (sampleNo + ringN - lag) % ringN;
    const haveOld = sampleNo >= lag;
    for (let q = 0; q < n; q++) {
      const o = cur * cap + q;
      if (alive[q] === 0) { ringGen[o] = -1; continue; }
      peopleSeen++;
      if (energy[q] < hungryBelow) hungry++;
      if (age[q] < adultAge) { ringGen[o] = -1; continue; }
      adultsSeen++;
      if (L.waterDist[(y[q] << 8) | x[q]] <= 2) nearWater++;
      if (haveOld) {
        const k = old * cap + q;
        if (ringGen[k] === gen[q]) {
          dispSum += Math.hypot(wrapD(x[q] - ringX[k]), wrapD(y[q] - ringY[k]));
          dispN++;
        }
      }
      ringX[o] = x[q]; ringY[o] = y[q]; ringGen[o] = gen[q];
    }
    sampleNo++;
    let tiles = 0, full = 0, nearFull = 0, food = 0, capSum = 0;
    for (let i = 0; i < N; i++) {
      const c = L.capacityAt(i, cfg);
      if (c <= 0) continue;
      tiles++; capSum += c;
      const f = Math.min(1, L.food[i] / c);
      full += f; food += L.food[i];
      if (f > 0.9) nearFull++;
    }
    samples++;
    fullSum += full / Math.max(1, tiles);
    nearFullSum += nearFull / Math.max(1, tiles);
    foodPerTileSum += food / Math.max(1, tiles);
    maxYieldSum += baseRate * capSum / 4;
    tilesPerPersonSum += tiles / Math.max(1, w.population);
  };

  const yearly = (year: number): void => {
    popAtYear[year] = w.population;
    herdsAtYear[year] = w.herds.count;
    wolvesAtYear[year] = w.wolves.count;
    if (year * tpy < FROM) return;
    const next = new Map<number, { x: number; y: number; travelled: number }>();
    for (const b of chronicle.tracker.bands.values()) {
      if (b.size < BAND_MIN) continue;
      next.set(b.id, { x: b.cx, y: b.cy, travelled: b.travelled });
      const m = bandMarks.get(b.id);
      if (!m) continue;
      let dx = Math.abs(b.cx - m.x), dy = Math.abs(b.cy - m.y);
      if (dx > 128) dx = 256 - dx;
      if (dy > 128) dy = 256 - dy;
      bandNetSum += Math.hypot(dx, dy);
      bandPathSum += b.travelled - m.travelled;
      bandYears++;
    }
    bandMarks = next;
  };

  const afterStep = (): void => {
    if (died) return;
    const t = w.tick - startTick; // ticks run so far
    chronicle.record(w);
    if (w.population === 0) { died = true; return; }
    popSum += w.population; popN++;
    const p = w.people;
    const n = p.capacity;
    ensure(n);
    const alive = p.alive, x = p.x, y = p.y, age = p.age, gen = p.slotGenerations, activity = p.activity;
    const measuring = t > FROM;
    if (t === FROM) migrationsFrom = chronicle.counts.migration;
    const growing = seasonGrowthFactor(w.tick, cfg) >= 1 ? 1 : 0;
    for (let q = 0; q < n; q++) {
      if (alive[q] === 0) { prevGen[q] = -1; stayGen[q] = -1; continue; }
      const a = activity[q];
      if ((a & ~ACT_MASK) !== 0) activity[q] = a & ACT_MASK; // events are read once, as the viewer does
      const g = gen[q];
      if (measuring) {
        personTicks++;
        actTicks[a & ACT_MASK]++;
        if (a & EV_KILL) kills++;
        if (a & EV_BIRTH) births++;
        if (a & EV_FIRE) fires++;
        if (a & EV_BUILT) huts++;
      }
      if (age[q] < adultAge) { prevGen[q] = -1; stayGen[q] = -1; continue; }
      const px = x[q], py = y[q];
      if (measuring) {
        if (prevGen[q] === g) {
          adultTicks++;
          if (prevX[q] !== px || prevY[q] !== py) adultMoves++;
        }
        if (stayGen[q] !== g) {
          stayGen[q] = g; stayX[q] = px; stayY[q] = py; stayStart[q] = t; stayGrowing[q] = growing;
        } else if (wrapD(px - stayX[q]) > STAY_RADIUS || wrapD(py - stayY[q]) > STAY_RADIUS) {
          endStay(q, t);
          stayX[q] = px; stayY[q] = py; stayStart[q] = t; stayGrowing[q] = growing;
        }
      }
      prevX[q] = px; prevY[q] = py; prevGen[q] = g;
    }
    if (measuring) flowTicks++;
    if (measuring && t % every === 0) sample();
    if (t % tpy === 0) yearly(t / tpy);
    on = t >= FROM; // flows count from the next tick on
  };

  const result = (): WatchResult => {
    const t = w.tick - startTick;
    const years = Math.max(1e-9, flowTicks / tpy);
    const sn = Math.max(1, samples);
    // Person-time view of stays: completed stays plus the ones still open now, weighted by length.
    const weighted = new Float64Array(STAY_BINS);
    let wTotal = 0, open = 0, openYearPlus = 0;
    for (let i = 1; i < STAY_BINS; i++) { weighted[i] = stayHist[i] * i; wTotal += weighted[i]; }
    const p = w.people;
    for (let q = 0; q < Math.min(cap, p.capacity); q++) {
      if (p.alive[q] === 0 || stayGen[q] !== p.slotGenerations[q]) continue;
      const len = Math.min(STAY_BINS - 1, t - stayStart[q]);
      weighted[len] += len; wTotal += len; open++;
      if (len >= tpy) openYearPlus++;
    }
    let acc = 0, timeMedian = -1;
    for (let i = 0; i < STAY_BINS && wTotal > 0; i++) { acc += weighted[i]; if (acc >= wTotal / 2) { timeMedian = i; break; } }
    const activityPct: Record<string, number> = {};
    for (let c = 0; c < ACTIVITY_NAMES.length; c++) activityPct[ACTIVITY_NAMES[c]] = +(100 * actTicks[c] / Math.max(1, personTicks)).toFixed(2);
    return {
      seed: w.seed, years: +(t / tpy).toFixed(2), fromYear: FROM / tpy, every, diedOut: died,
      popEnd: w.population, meanPop: Math.round(popSum / Math.max(1, popN)),
      popAtYear, herdsAtYear, wolvesAtYear,
      // Movement (adults, from year 5).
      stepsPerAdultYear: r1(tpy * adultMoves / Math.max(1, adultTicks)),
      netDisplacePerAdultYear: r1(dispSum / Math.max(1, dispN)),
      nearWaterPct: r1(100 * nearWater / Math.max(1, adultsSeen)),
      // Camp stays (adults): ticks within 3 tiles of where the stay began.
      campStayMedian: quantile(stayHist, stays, 0.5), campStayP90: quantile(stayHist, stays, 0.9),
      campStayMedianGrowing: quantile(stayHistGrowing, staysGrowing, 0.5),
      campStays: stays, campStaysOpen: open,
      // Half of adult time is spent in stays at least this long (open stays count at their length so far).
      campStayTimeMedian: timeMedian,
      openStaysYearPlusPct: r1(100 * openYearPlus / Math.max(1, open)),
      // Land.
      landFullPct: r3(fullSum / sn), landNearFullPct: r3(nearFullSum / sn),
      foodPerTile: r3(foodPerTileSum / sn), tilesPerPerson: r1(tilesPerPersonSum / sn),
      harvestShare: r3((grazedPeople + grazedHerds) / Math.max(1e-9, regrown)),
      harvestSharePeople: r3(grazedPeople / Math.max(1e-9, regrown)),
      harvestShareHerds: r3(grazedHerds / Math.max(1e-9, regrown)),
      // Grazing against the most the land could regrow: every tile held at half capacity, where logistic
      // regrowth peaks at rate x capacity / 4 (base rate; the seasons average 1, farming boosts left out).
      harvestOfMaxYield: r3((grazedPeople + grazedHerds) / Math.max(1, flowTicks) / Math.max(1e-9, maxYieldSum / sn)),
      maxYieldPerTick: r1(maxYieldSum / sn),
      regrownPerTick: r1(regrown / Math.max(1, flowTicks)), grazedPerTick: r1((grazedPeople + grazedHerds) / Math.max(1, flowTicks)),
      witheredPerTick: r1(withered / Math.max(1, flowTicks)),
      // People.
      hungryPct: r1(100 * hungry / Math.max(1, peopleSeen)),
      activityPct,
      eventsPerYear: { kills: r1(kills / years), births: r1(births / years), fires: r1(fires / years), huts: r1(huts / years) },
      // Bands (5 or more people): centre movement over a year, straight line and along its path.
      migrationsPer10y: r1(10 * (chronicle.counts.migration - migrationsFrom) / years),
      bandDisplacePerYear: r1(bandNetSum / Math.max(1, bandYears)),
      bandPathPerYear: r1(bandPathSum / Math.max(1, bandYears)),
      bandYears,
      hash: w.stateHash(),
    };
  };

  return { afterStep, result };
}
