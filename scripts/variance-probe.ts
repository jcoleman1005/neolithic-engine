/**
 * Watchability diagnosis: how erratic is the land, and do places vary together? Read only.
 * For each 16 x 16 block it adds up the growth multiplier its land tiles get each tick (the season
 * factor times the 6b-1 moisture factor, the same formula as Land.step), and reports, over the
 * years measured: the year-to-year spread of a block's growth (coefficient of variation), the
 * spread between blocks, and the mean correlation between pairs of blocks' yearly series
 * (1 = every place has its good and bad years together; 0 = independent).
 *   npx vite-node scripts/variance-probe.ts -- --seed 1 --years 30 [--weatherEnabled true]
 */
import { World } from '../src/sim/world';
import { seasonGrowthFactor } from '../src/sim/seasons';
import { parseArgs } from './args';

const { named, overrides } = parseArgs(process.argv.slice(2), ['seed', 'years']);
const seed = parseInt(named.seed ?? '1', 10);
const years = parseInt(named.years ?? '30', 10);
const w = new World(overrides as never, seed);
const cfg = w.config;
const L = w.land;
const tpy = cfg.ticksPerYear || 360;
const FROM_YEAR = 5;
const weatherOn = cfg.weatherEnabled === true;
const mDry = cfg.moistureDryPoint ?? 40, mWet = cfg.moistureWetPoint ?? 150, gMax = cfg.weatherGrowthMax ?? 1.25;
const blockTiles = new Float64Array(256);
for (let i = 0; i < 65536; i++) if (L.maxFood[i] > 0) blockTiles[((i >> 12) << 4) | ((i & 255) >> 4)]++;
const acc = new Float64Array(256);
const series: Float64Array[] = []; // one array of 256 block means per measured year
const seasonSeries: number[][] = []; // growth by quarter, land-wide, per year
let quarter = [0, 0, 0, 0];
for (let t = 1; t <= years * tpy; t++) {
  w.step();
  if (w.population === 0) break;
  if (t % 10 === 0) {
    const season = seasonGrowthFactor(w.tick, cfg);
    let all = 0, n = 0;
    for (let i = 0; i < 65536; i++) {
      if (L.maxFood[i] <= 0) continue;
      let wet = 1;
      if (weatherOn) { const m = L.moisture[i]; wet = m <= mDry ? 0 : m >= mWet ? gMax : gMax * (m - mDry) / (mWet - mDry); }
      acc[((i >> 12) << 4) | ((i & 255) >> 4)] += season * wet;
      all += season * wet; n++;
    }
    quarter[Math.min(3, Math.floor(((t - 1) % tpy) / (tpy / 4)))] += all / Math.max(1, n);
  }
  if (t % tpy === 0) {
    if (t / tpy > FROM_YEAR) {
      series.push(Float64Array.from(acc, (v, b) => (blockTiles[b] > 0 ? v / (blockTiles[b] * (tpy / 10)) : 0)));
      seasonSeries.push(quarter.map((v) => +(v / (tpy / 40)).toFixed(3)));
    }
    acc.fill(0); quarter = [0, 0, 0, 0];
  }
}
const Y = series.length;
const blocks: number[] = [];
for (let b = 0; b < 256; b++) if (blockTiles[b] >= 32) blocks.push(b);
const mean = new Float64Array(256), sd = new Float64Array(256);
for (const b of blocks) {
  let m = 0; for (let y = 0; y < Y; y++) m += series[y][b]; m /= Y;
  let v = 0; for (let y = 0; y < Y; y++) v += (series[y][b] - m) ** 2;
  mean[b] = m; sd[b] = Math.sqrt(v / Math.max(1, Y - 1));
}
let cvSum = 0, grand = 0;
for (const b of blocks) { cvSum += mean[b] > 0 ? sd[b] / mean[b] : 0; grand += mean[b]; }
grand /= blocks.length;
let between = 0; for (const b of blocks) between += (mean[b] - grand) ** 2;
let corrSum = 0, corrN = 0;
for (let a = 0; a < blocks.length; a++) for (let c = a + 1; c < blocks.length; c++) {
  const p = blocks[a], q = blocks[c];
  if (sd[p] === 0 || sd[q] === 0) continue;
  let cov = 0; for (let y = 0; y < Y; y++) cov += (series[y][p] - mean[p]) * (series[y][q] - mean[q]);
  corrSum += cov / (Y - 1) / (sd[p] * sd[q]); corrN++;
}
// Land-wide yearly mean, for the spread of the whole map's year.
const worldYear = series.map((s) => { let v = 0; for (const b of blocks) v += s[b]; return v / blocks.length; });
const wm = worldYear.reduce((a, b) => a + b, 0) / Math.max(1, Y);
const wsd = Math.sqrt(worldYear.reduce((a, b) => a + (b - wm) ** 2, 0) / Math.max(1, Y - 1));
const qm = [0, 1, 2, 3].map((k) => +(seasonSeries.reduce((a, s) => a + s[k], 0) / Math.max(1, Y)).toFixed(3));
console.log(`RESULT ${JSON.stringify({
  seed, years, weatherOn, yearsMeasured: Y, blocks: blocks.length,
  meanGrowth: +grand.toFixed(3),
  blockYearToYearCV: +(cvSum / blocks.length).toFixed(4),
  betweenBlocksCV: +(Math.sqrt(between / Math.max(1, blocks.length - 1)) / Math.max(1e-9, grand)).toFixed(4),
  wholeMapYearToYearCV: +(wsd / Math.max(1e-9, wm)).toFixed(4),
  meanCorrelationBetweenBlocks: corrN > 0 ? +(corrSum / corrN).toFixed(3) : null,
  growthByQuarter: qm, hash: w.stateHash(),
})}`);
