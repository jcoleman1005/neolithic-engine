import { World } from '../../src/sim/world';
const seed = +process.argv[2];
const w = new World({ jitterEnabled: false }, seed);
for (let t = 0; t < 1800; t++) w.step();
const p = w.people, land = w.land, cfg = w.config;
const adultAge = cfg.adultAge ?? 5760;
const cap = p.capacity;
const lastCell = new Int32Array(cap).fill(-1), lastId = new Float64Array(cap), run = new Int32Array(cap);
const runs: number[] = []; let leaveRich = 0, leaveDepleted = 0, leaveNoCap = 0;
let stayTicks = 0, moveTicks = 0, stayFrac = 0, moveFrac = 0, stayBelowThresh = 0, stayNoCap = 0;
let dFoodSum = 0, dFoodN = 0, grazeCells = 0;
let occFrac = 0, occN = 0, unoccFrac = 0, unoccN = 0;
const thresh = cfg.stayFoodFraction ?? 0.5;
const frac = (c: number) => { const m = land.capacityAt(c, cfg); return m > 0 ? land.food[c] / m : -1; };
for (let t = 0; t < 300; t++) {
  const before = new Map<number, number>();
  for (let s = 0; s < cap; s++) if (p.alive[s] && p.age[s] >= adultAge) { const c = (p.y[s] << 8) | p.x[s]; if (!before.has(c)) before.set(c, land.food[c]); }
  w.step();
  const occ = new Set<number>();
  for (let s = 0; s < cap; s++) {
    if (!p.alive[s] || p.age[s] < adultAge) { lastCell[s] = -1; continue; }
    const c = (p.y[s] << 8) | p.x[s]; const id = p.idOf(s); occ.add(c);
    if (lastCell[s] >= 0 && lastId[s] === id) {
      const f = frac(lastCell[s]);
      if (c === lastCell[s]) {
        stayTicks++; run[s]++;
        if (f < 0) stayNoCap++; else { stayFrac += f; if (f < thresh) stayBelowThresh++; }
        if (before.has(c)) { dFoodSum += land.food[c] - before.get(c)!; dFoodN++; }
      } else {
        moveTicks++; if (f >= 0) moveFrac += f;
        if (run[s] > 0) { runs.push(run[s]); if (f < 0) leaveNoCap++; else if (f < thresh) leaveDepleted++; else leaveRich++; }
        run[s] = 0;
      }
    } else run[s] = 0;
    lastCell[s] = c; lastId[s] = id;
  }
  if (t % 30 === 0) for (let c = 0; c < 65536; c++) { const f = frac(c); if (f < 0) continue; if (occ.has(c)) { occFrac += f; occN++; } else { unoccFrac += f; unoccN++; } }
}
runs.sort((a, b) => a - b); const q = (x: number) => runs.length ? runs[Math.floor(runs.length * x)] : 0;
const stayCap = stayTicks - stayNoCap;
console.log(JSON.stringify({
  seed, stayPct: (100 * stayTicks / (stayTicks + moveTicks)).toFixed(1),
  stayTileFrac: (stayFrac / stayCap).toFixed(2), moveFromTileFrac: (moveFrac / moveTicks).toFixed(2),
  stayBelowThreshPct: (100 * stayBelowThresh / stayCap).toFixed(1), stayOnNoCapPct: (100 * stayNoCap / stayTicks).toFixed(1),
  foodDeltaPerStayTick: (dFoodSum / dFoodN).toFixed(3),
  runMedian: q(0.5), runP90: q(0.9), runs: runs.length,
  leaveRichPct: (100 * leaveRich / runs.length).toFixed(1), leaveDepletedPct: (100 * leaveDepleted / runs.length).toFixed(1), leaveNoCapPct: (100 * leaveNoCap / runs.length).toFixed(1),
  occupiedTileFrac: (occFrac / occN).toFixed(2), unoccupiedTileFrac: (unoccFrac / unoccN).toFixed(2), pop: w.population,
}));
