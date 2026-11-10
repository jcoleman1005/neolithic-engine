import { PRNG } from './prng';
import type { SimulationConfig } from './types';

/**
 * Phase 6b-1: climate and moisture (switch `weatherEnabled`).
 *
 * Humid air sits on a coarse grid of 16 x 16-tile blocks (BLOCKS x BLOCKS = 256 cells) and drifts
 * downwind with the seasonal wind. It gains water over water (more when warm), rains out where it is
 * forced uphill (so windward slopes are wet and the lee lies in a rain shadow), is recycled by
 * forest, and rains a little more in a wet latitude band. Each year a separate weather PRNG draws the
 * year's character (normal, drought, wet), which scales the supply of moisture: the environment may
 * be scripted, people may not (docs/decisions.md, 2026-11-10). Heavy warm-season rain hosts
 * thunderstorm cells that drift with the wind (the only source of lightning, 6b-2).
 *
 * The weather never touches people. Land reads `rainAt` to wet its per-tile `moisture`, and moisture
 * sets plant growth.
 */

export const BLOCK = 16;
export const BLOCKS = 256 / BLOCK; // 16
export const BLOCK_COUNT = BLOCKS * BLOCKS; // 256
export const YEAR_NORMAL = 0;
export const YEAR_DROUGHT = 1;
export const YEAR_WET = 2;
export const MAX_STORMS = 8;

export interface StormCell {
  x: number; // block coordinates, fractional
  y: number;
  life: number; // ticks left
  strength: number; // rain it carries, in block rain units
}

export interface WeatherState {
  readonly humidity: readonly number[];
  readonly rainNormal: readonly number[];
  readonly storms: readonly StormCell[];
  readonly yearKind: number;
  readonly yearRun: number;
  readonly prngState: number;
  /** Per-block wood share at the last refresh (saved by Land, which owns the ground). */
  readonly woodShare?: readonly number[];
}

/** What the land around each block offers the air, recomputed from the map now and then. */
export interface BlockGround {
  waterShare: Float32Array; // share of the block's tiles that are water
  meanUp: Float32Array; // mean upland 0..1
  woodShare: Float32Array; // share of wooded tiles
}

export class Weather {
  public readonly humidity = new Float32Array(BLOCK_COUNT);
  /** This tick's rain per block (derived each step; not saved). */
  public readonly rain = new Float32Array(BLOCK_COUNT);
  /** Long-run mean rain per block: the block's climate (saved). */
  public readonly rainNormal = new Float32Array(BLOCK_COUNT);
  public storms: StormCell[] = [];
  public yearKind = YEAR_NORMAL;
  /** Consecutive years of the current kind. */
  public yearRun = 0;
  public readonly prng: PRNG;
  private readonly next = new Float32Array(BLOCK_COUNT);
  private normalWarm = 0; // whether rainNormal has had a value yet

  constructor(seed: number) {
    // Its own stream, so switching weather on never shifts anyone else's random draws.
    this.prng = new PRNG(((seed >>> 0) ^ 0x9e3779b9) >>> 0 || 1);
  }

  /** Index of the block holding tile (x, y). */
  public static blockOf(x: number, y: number): number {
    return (((y & 255) / BLOCK) | 0) * BLOCKS + (((x & 255) / BLOCK) | 0);
  }

  /**
   * One day of weather. `windX`, `windY` point to where the wind comes from (Land.setWind), so air
   * moves the other way. `warm` is the season's warmth, 0 in winter to 1 in summer.
   */
  public step(ground: BlockGround, windX: number, windY: number, warm: number, yearStart: boolean, config: Readonly<SimulationConfig>): void {
    if (yearStart) this.drawYear(config);
    const supply = this.yearKind === YEAR_DROUGHT ? config.weatherDroughtSupply ?? 0.55
      : this.yearKind === YEAR_WET ? config.weatherWetSupply ?? 1.4 : 1;
    const speed = config.weatherAirSpeed ?? 0.4; // blocks a day
    const vx = -windX * speed, vy = -windY * speed;
    const evap = (config.weatherEvaporation ?? 0.06) * (0.5 + warm) * supply;
    const base = config.weatherBaseRain ?? 0.04;
    const oro = config.weatherUplift ?? 6.0;
    const recycle = config.weatherForestRecycle ?? 0.5;
    const latAmp = config.weatherLatitudeAmp ?? 0.5;
    const hMax = config.weatherHumidityMax ?? 4;
    const h = this.humidity, nx = this.next, rain = this.rain;

    // 1. Advect: each block takes the air that was upwind of it (bilinear, wrapped).
    for (let by = 0; by < BLOCKS; by++) {
      for (let bx = 0; bx < BLOCKS; bx++) {
        const sx = bx - vx, sy = by - vy;
        const x0 = Math.floor(sx), y0 = Math.floor(sy);
        const fx = sx - x0, fy = sy - y0;
        const a = h[Weather.wrapIdx(x0, y0)], b = h[Weather.wrapIdx(x0 + 1, y0)];
        const c = h[Weather.wrapIdx(x0, y0 + 1)], d = h[Weather.wrapIdx(x0 + 1, y0 + 1)];
        nx[by * BLOCKS + bx] = (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
      }
    }
    // 2. Gain over water, rain out where the air rises, forest gives part of it back.
    const sgnX = vx > 0 ? 1 : vx < 0 ? -1 : 0, sgnY = vy > 0 ? 1 : vy < 0 ? -1 : 0;
    const tauN = 1 / ((config.weatherNormalYears ?? 2) * (config.ticksPerYear ?? 360));
    for (let by = 0; by < BLOCKS; by++) {
      // A smooth band over the map's height that still joins where the map wraps.
      const band = 1 + latAmp * Math.cos((2 * Math.PI * (by + 0.5)) / BLOCKS);
      for (let bx = 0; bx < BLOCKS; bx++) {
        const i = by * BLOCKS + bx;
        let air = nx[i] + evap * ground.waterShare[i];
        // Rise against the block the air just came from.
        const up = Weather.wrapIdx(bx - sgnX, by - sgnY);
        const rise = ground.meanUp[i] - ground.meanUp[up];
        const frac = Math.min(0.9, (base + oro * (rise > 0 ? rise : 0)) * band);
        const r = air * frac;
        air -= r;
        air += recycle * ground.woodShare[i] * r;
        h[i] = air > hMax ? hMax : air;
        rain[i] = r;
        this.rainNormal[i] = this.normalWarm ? this.rainNormal[i] + (r - this.rainNormal[i]) * tauN : r;
      }
    }
    this.normalWarm = 1;
    this.stepStorms(warm, vx, vy, config);
  }

  /** Rain at a tile, bilinear between block centres (so edges are not blocky), plus any storm overhead. */
  public rainAt(x: number, y: number): number {
    const sx = x / BLOCK - 0.5, sy = y / BLOCK - 0.5;
    const x0 = Math.floor(sx), y0 = Math.floor(sy);
    const fx = sx - x0, fy = sy - y0;
    const r = this.rain;
    let v = (r[Weather.wrapIdx(x0, y0)] * (1 - fx) + r[Weather.wrapIdx(x0 + 1, y0)] * fx) * (1 - fy)
      + (r[Weather.wrapIdx(x0, y0 + 1)] * (1 - fx) + r[Weather.wrapIdx(x0 + 1, y0 + 1)] * fx) * fy;
    for (let k = 0; k < this.storms.length; k++) {
      const s = this.storms[k];
      const dx = Weather.wrapD(sx + 0.5 - s.x), dy = Weather.wrapD(sy + 0.5 - s.y);
      if (dx * dx + dy * dy < 1) v += s.strength;
    }
    return v;
  }

  private stepStorms(warm: number, vx: number, vy: number, config: Readonly<SimulationConfig>): void {
    // Move and age the cells it already has.
    for (let k = this.storms.length - 1; k >= 0; k--) {
      const s = this.storms[k];
      s.x = Weather.wrapF(s.x + vx);
      s.y = Weather.wrapF(s.y + vy);
      s.life--;
      if (s.life <= 0) this.storms.splice(k, 1);
    }
    // Heavy rain in the warm season can grow a thunderstorm (one draw a day, only when it can).
    const heavy = config.weatherStormRain ?? 0.25;
    if (warm < (config.weatherStormWarm ?? 0.5) || this.storms.length >= MAX_STORMS) return;
    let best = -1, bestRain = heavy;
    for (let i = 0; i < BLOCK_COUNT; i++) if (this.rain[i] > bestRain) { bestRain = this.rain[i]; best = i; }
    if (best < 0) return;
    if (this.prng.next() >= (config.weatherStormChance ?? 0.3)) return;
    const life = 3 + this.prng.nextInt(0, 8);
    this.storms.push({ x: (best % BLOCKS) + 0.5, y: ((best / BLOCKS) | 0) + 0.5, life, strength: bestRain * (config.weatherStormBoost ?? 1.0) });
  }

  private drawYear(config: Readonly<SimulationConfig>): void {
    const pD = config.weatherDroughtChance ?? 0.15;
    const pW = config.weatherWetChance ?? 0.15;
    const pStay = config.weatherDroughtPersist ?? 0.35;
    const u = this.prng.next();
    let kind: number;
    if (this.yearKind === YEAR_DROUGHT && u < pStay) kind = YEAR_DROUGHT;
    else {
      const v = this.prng.next();
      kind = v < pD ? YEAR_DROUGHT : v > 1 - pW ? YEAR_WET : YEAR_NORMAL;
    }
    this.yearRun = kind === this.yearKind ? this.yearRun + 1 : 1;
    this.yearKind = kind;
  }

  public static wrapIdx(bx: number, by: number): number {
    return (((by % BLOCKS) + BLOCKS) % BLOCKS) * BLOCKS + (((bx % BLOCKS) + BLOCKS) % BLOCKS);
  }

  private static wrapF(v: number): number {
    return ((v % BLOCKS) + BLOCKS) % BLOCKS;
  }

  private static wrapD(d: number): number {
    return d > BLOCKS / 2 ? d - BLOCKS : d < -BLOCKS / 2 ? d + BLOCKS : d;
  }

  public exportState(): WeatherState {
    return {
      humidity: Array.from(this.humidity),
      rainNormal: Array.from(this.rainNormal),
      storms: this.storms.map((s) => ({ ...s })),
      yearKind: this.yearKind,
      yearRun: this.yearRun,
      prngState: this.prng.getState(),
    };
  }

  public importState(s: WeatherState): void {
    for (let i = 0; i < BLOCK_COUNT; i++) {
      this.humidity[i] = s.humidity[i] ?? 0;
      this.rainNormal[i] = s.rainNormal[i] ?? 0;
    }
    this.normalWarm = 1;
    this.storms = s.storms.map((c) => ({ ...c }));
    this.yearKind = s.yearKind;
    this.yearRun = s.yearRun;
    this.prng.setState(s.prngState);
  }
}
