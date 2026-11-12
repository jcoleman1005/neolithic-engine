/**
 * Phase 6b-1 probe: what the climate does, year by year. Observer only (reads the world, draws nothing).
 *   npx vite-node scripts/weather-probe.ts -- --seed 1 --years 30 [--weatherEnabled true] [--png out.png]
 * Prints one line a year and a final `RESULT {json}` line. --png writes the climate (mean rain) beside
 * the year-end soil moisture.
 */
import { writeFileSync } from 'node:fs';
import { World } from '../src/sim/world';
import { BLOCK_COUNT, YEAR_DROUGHT, YEAR_WET } from '../src/sim/weather';
import { encodePng } from './png';
import { parseArgs } from './args';

const { named, overrides } = parseArgs(process.argv.slice(2), ['seed', 'years', 'png']);
const seed = Number(named.seed ?? 1);
const years = Number(named.years ?? 30);
const w = new World(overrides, seed);
const tpy = w.config.ticksPerYear ?? 360;
const dryPoint = w.config.moistureDryPoint ?? 40;
const witherBelow = w.config.moistureWitherBelow ?? 25;
const L = w.land;
const kinds = ['normal', 'drought', 'wet'];

let landTiles = 0;
for (let i = 0; i < 65536; i++) if (L.isWater[i] === 0) landTiles++;

let droughtYears = 0, wetYears = 0, stormDays = 0, maxStorms = 0, msSum = 0, msN = 0;
// 6b-2 wildfire counts (zero while wildfire is off).
let tilesCaught = 0, tilesBurned = 0, maxBurning = 0, personDaysInFire = 0, fireDays = 0, yearCaught = 0, yearBurned = 0;
const wasBurning = new Uint8Array(65536);
const scorchFull = w.config.scorchDays ?? 360;
const perYear: Array<Record<string, number | string>> = [];
let dryShareSum = 0, dryShareMax = 0, witherShareMax = 0, popMin = Infinity;
const t0 = Date.now();
let sumMoist = 0, sumDry = 0, sumWither = 0, samples = 0;
for (let y = 1; y <= years; y++) {
  sumMoist = 0; sumDry = 0; sumWither = 0; samples = 0;
  while (w.tick < y * tpy) {
    w.step();
    stormDays += L.weather.storms.length > 0 ? 1 : 0;
    if (w.config.wildfireEnabled === true) {
      let burningNow = 0;
      for (let i = 0; i < 65536; i++) {
        const b = L.burning[i] > 0 ? 1 : 0;
        if (b && !wasBurning[i]) { tilesCaught++; yearCaught++; }
        if (L.scorch[i] === scorchFull) { tilesBurned++; yearBurned++; }
        wasBurning[i] = b; burningNow += b;
      }
      if (burningNow > 0) fireDays++;
      if (burningNow > maxBurning) maxBurning = burningNow;
      for (let s = 0; s < w.people.capacity; s++) if (w.people.alive[s] === 1 && L.burning[(w.people.y[s] << 8) | w.people.x[s]] > 0) personDaysInFire++;
    }
    if (L.weather.storms.length > maxStorms) maxStorms = L.weather.storms.length;
    if (w.tick % 30 === 0) {
      let m = 0, dry = 0, wither = 0;
      for (let i = 0; i < 65536; i++) {
        if (L.isWater[i] === 1) continue;
        const v = L.moisture[i];
        m += v; if (v < dryPoint) dry++; if (v < witherBelow) wither++;
      }
      sumMoist += m / landTiles; sumDry += dry / landTiles; sumWither += wither / landTiles; samples++;
      if (dry / landTiles > dryShareMax) dryShareMax = dry / landTiles;
      if (wither / landTiles > witherShareMax) witherShareMax = wither / landTiles;
    }
  }
  if (w.population < popMin) popMin = w.population;
  const kind = L.weather.yearKind;
  if (kind === YEAR_DROUGHT) droughtYears++;
  if (kind === YEAR_WET) wetYears++;
  const meanM = sumMoist / Math.max(1, samples), dryS = sumDry / Math.max(1, samples), witherS = sumWither / Math.max(1, samples);
  dryShareSum += dryS; msSum += meanM; msN++;
  perYear.push({ year: y, kind: kinds[kind], moisture: +meanM.toFixed(1), dryPct: +(100 * dryS).toFixed(1), witherPct: +(100 * witherS).toFixed(1), pop: w.population, caught: yearCaught, burned: yearBurned });
  const fireNote = w.config.wildfireEnabled === true ? `, fire: ${yearCaught} tiles caught, ${yearBurned} burned out` : '';
  yearCaught = 0; yearBurned = 0;
  console.log(`year ${y}: ${kinds[kind].padEnd(7)} moisture ${meanM.toFixed(1)}, dry ${(100 * dryS).toFixed(1)}%, withering ${(100 * witherS).toFixed(1)}%, storms now ${L.weather.storms.length}, pop ${w.population}${fireNote}, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  if (w.population === 0) break;
}

// Climate spread: how different the wettest and driest blocks are (a desert / rainforest contrast).
const rn = Array.from(L.weather.rainNormal).sort((a, b) => a - b);
const pct = (p: number): number => rn[Math.min(BLOCK_COUNT - 1, Math.floor(p * BLOCK_COUNT))];
const result = {
  seed, years, weather: w.config.weatherEnabled === true, popEnd: w.population, popMin,
  droughtYears, wetYears, meanMoisture: +(msSum / Math.max(1, msN)).toFixed(1),
  meanDryPct: +(100 * dryShareSum / Math.max(1, msN)).toFixed(1), maxDryPct: +(100 * dryShareMax).toFixed(1), maxWitherPct: +(100 * witherShareMax).toFixed(1),
  stormDaysPct: +(100 * stormDays / Math.max(1, w.tick)).toFixed(1), maxStorms,
  tilesCaught, tilesBurned, maxBurning, fireDaysPct: +(100 * fireDays / Math.max(1, w.tick)).toFixed(1), personDaysInFire,
  rainNormalP10: +pct(0.1).toFixed(4), rainNormalP50: +pct(0.5).toFixed(4), rainNormalP90: +pct(0.9).toFixed(4),
  perYear, hash: w.stateHash(),
};
console.log(`RESULT ${JSON.stringify(result)}`);

if (named.png) {
  // Left: climate (mean rain), brown dry to green wet. Right: soil moisture now. Water in blue.
  const S = 2, W = 256 * S * 2, H = 256 * S, img = new Uint8Array(W * H * 3);
  const maxR = Math.max(1e-6, pct(0.98));
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const i = (y << 8) | x;
    const water = L.isWater[i] === 1;
    const b = (((y / 16) | 0) * 16) + ((x / 16) | 0);
    const r = Math.min(1, L.weather.rainNormal[b] / maxR);
    const m = L.moisture[i] / 255;
    const c1 = water ? [40, 70, 120] : [170 - 120 * r, 130 + 40 * r, 60];
    const c2 = water ? [40, 70, 120] : [170 - 120 * m, 130 + 40 * m, 60];
    for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) {
      const o1 = ((y * S + dy) * W + x * S + dx) * 3, o2 = o1 + 256 * S * 3;
      img[o1] = c1[0]; img[o1 + 1] = c1[1]; img[o1 + 2] = c1[2];
      img[o2] = c2[0]; img[o2 + 1] = c2[1]; img[o2 + 2] = c2[2];
    }
  }
  writeFileSync(String(named.png), encodePng(W, H, img));
  console.log(`climate and moisture -> ${named.png}`);
}
