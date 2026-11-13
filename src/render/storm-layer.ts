/**
 * 6b-1 thunderstorms in the viewer: each storm is a soft rain-cloud shadow on the ground with slanted
 * rain falling inside it, gliding with the wind between payloads.
 *
 * Viewer only. The sim sends storm centres (tile x, y pairs) with each overlay, about every 2 s. Storms in
 * the sim all move with the wind, so the drift seen between payloads gives the wind direction and the
 * speed in wall-clock terms; nothing else is needed from the sim. Storms carry no id, so they are matched
 * payload to payload by nearest predicted position; a storm's look (cloud shape, rain drops) is hashed
 * from where it was first seen, so it stays stable for its whole life.
 */
import { quantizeImage } from './limited-palette';

const WORLD = 256; // tiles, the map wraps
/** Cloud sprite half-size in tiles; the sim rains within 16 tiles of a storm centre. */
const CLOUD_R = 20;
const CLOUD_SIZE = CLOUD_R * 2;
/** Strongest shadow alpha at the cloud core (people stay readable on top). */
const SHADOW_ALPHA = 0.25;
const SHADOW_RGB = [26, 34, 52];
/** Alpha steps in the shadow; the edge is ordered-dithered between them so it reads as pixel art. */
const SHADOW_LEVELS = 4;
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
/** Shadow drawn up to this cell size; above it only the rain is drawn. */
export const STORM_SHADOW_MAX_CELL = 10;
const RAIN_DROPS = 96;
const RAIN_COLOUR = 'rgba(206, 220, 238, 0.6)';
const RAIN_PERIOD_MS = 700;
const FADE_IN_MS = 900;
const FADE_OUT_MS = 1200;
/** How far a matched storm may be from where it was predicted, tiles, on top of how far it can move. */
const MATCH_TILES = 24;
/** Fastest a storm moves, tiles a tick (the default weatherAirSpeed, 0.4 blocks a day, at one day a tick). */
const STORM_TILES_PER_TICK = 6.4;
const MATCH_TILES_MAX = 112;
const DEFAULT_INTERVAL_MS = 2000;

interface TrackedStorm {
  key: number;
  fromX: number; fromY: number;
  toX: number; toY: number;
  /** Shown position at the last draw (tiles, unwrapped). */
  x: number; y: number;
  born: number;
  /** Wall-clock ms it vanished from the payload, or 0 while alive. */
  gone: number;
  sprite: HTMLCanvasElement | null;
  /** Rain drop offsets from the centre in tiles, x, y pairs, plus a phase each. */
  drops: Float32Array;
  phases: Float32Array;
}

function hash32(a: number, b: number, c: number): number {
  let h = (a * 374761393 + b * 668265263 + c * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return h >>> 0;
}
function hashUnit(a: number, b: number, c: number): number {
  return hash32(a, b, c) / 4294967296;
}
function wrapD(d: number): number {
  return d - Math.round(d / WORLD) * WORLD;
}
function smooth(t: number): number {
  return t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
}

/** Cloud density 0..1 at offset (dx, dy) tiles from the centre, from 5 overlapping soft circles. */
function makeDensity(key: number): (dx: number, dy: number) => number {
  const n = 5;
  const cx = new Float32Array(n), cy = new Float32Array(n), cr = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const ang = hashUnit(key, i, 1) * Math.PI * 2;
    const dist = i === 0 ? 0 : 4 + hashUnit(key, i, 2) * 5;
    cx[i] = Math.cos(ang) * dist;
    cy[i] = Math.sin(ang) * dist * 0.8;
    cr[i] = (i === 0 ? 10 : 6.5) + hashUnit(key, i, 3) * 4;
  }
  return (dx, dy) => {
    let d = 0;
    for (let i = 0; i < n; i++) {
      const ex = dx - cx[i], ey = dy - cy[i];
      const v = smooth(1.15 - Math.sqrt(ex * ex + ey * ey) / cr[i]);
      d = d + v - d * v; // soft union
    }
    return d;
  };
}

/** The cloud shadow, one texel a tile, built once per storm on first draw. */
function buildSprite(key: number): HTMLCanvasElement {
  const density = makeDensity(key);
  const sprite = document.createElement('canvas');
  sprite.width = CLOUD_SIZE;
  sprite.height = CLOUD_SIZE;
  const sctx = sprite.getContext('2d')!;
  const img = sctx.createImageData(CLOUD_SIZE, CLOUD_SIZE);
  const px = img.data;
  for (let j = 0; j < CLOUD_SIZE; j++) {
    for (let i = 0; i < CLOUD_SIZE; i++) {
      const d = density(i + 0.5 - CLOUD_R, j + 0.5 - CLOUD_R);
      // Quantise to a few steps, ordered-dithered between them: a crisp pixel-art soft edge.
      const lv = d * SHADOW_LEVELS + (BAYER4[(j & 3) * 4 + (i & 3)] + 0.5) / 16 - 0.5;
      const step = Math.max(0, Math.min(SHADOW_LEVELS, Math.round(lv)));
      const o = (j * CLOUD_SIZE + i) * 4;
      px[o] = SHADOW_RGB[0]; px[o + 1] = SHADOW_RGB[1]; px[o + 2] = SHADOW_RGB[2];
      px[o + 3] = Math.round((step / SHADOW_LEVELS) * SHADOW_ALPHA * 255);
    }
  }
  quantizeImage(new Uint32Array(px.buffer), CLOUD_SIZE); // limited palette
  sctx.putImageData(img, 0, 0);
  return sprite;
}

function buildStorm(key: number, x: number, y: number, now: number): TrackedStorm {
  const density = makeDensity(key);
  // Rain drops: hashed points where the cloud is thick.
  const drops = new Float32Array(RAIN_DROPS * 2);
  const phases = new Float32Array(RAIN_DROPS);
  let n = 0;
  for (let tries = 0; n < RAIN_DROPS && tries < RAIN_DROPS * 12; tries++) {
    const ox = (hashUnit(key, tries, 11) * 2 - 1) * 16;
    const oy = (hashUnit(key, tries, 12) * 2 - 1) * 16;
    if (density(ox, oy) < 0.45) continue;
    drops[n * 2] = ox;
    drops[n * 2 + 1] = oy;
    phases[n] = hashUnit(key, tries, 13);
    n++;
  }
  return {
    key, fromX: x, fromY: y, toX: x, toY: y, x, y, born: now, gone: 0, sprite: null,
    drops: n === RAIN_DROPS ? drops : drops.subarray(0, n * 2), phases: n === RAIN_DROPS ? phases : phases.subarray(0, n),
  };
}

export class StormLayer {
  private tracked: TrackedStorm[] = [];
  private lastPayload: readonly number[] | null = null;
  private lastArrive = 0;
  private lastTick = -1;
  private interval = DEFAULT_INTERVAL_MS;
  /** Drift a sim tick in tiles (downwind), estimated from matched storms (hasDrift once known). */
  private driftX = 0;
  private driftY = 0;
  private hasDrift = false;
  /** Drift over the last payload gap, for a storm fading out after it left the payload. */
  private stepX = 0;
  private stepY = 0;
  /** Normalised downwind direction for the rain slant. */
  private windX = 0.35;
  private windY = 0;
  private readonly reducedMotion: MediaQueryList | null =
    typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

  public reset(): void {
    this.tracked = [];
    this.lastPayload = null;
    this.lastArrive = 0;
    this.lastTick = -1;
    this.driftX = this.driftY = this.stepX = this.stepY = 0;
    this.hasDrift = false;
  }

  /** For tests: each storm shown, its key, where it is heading (tiles) and whether it is fading out. */
  public snapshot(): { key: number; x: number; y: number; gone: boolean }[] {
    return this.tracked.map((s) => ({ key: s.key, x: s.toX, y: s.toY, gone: s.gone > 0 }));
  }

  /** True while anything is on screen or fading. */
  public get active(): boolean {
    return this.tracked.length > 0;
  }

  /**
   * Takes in a new storms payload once (by array identity) and matches it to the storms already shown,
   * predicting each one's move from the drift a tick times the ticks since the last payload (none while
   * paused). `tick` is the sim tick the payload belongs to.
   */
  public update(storms: readonly number[] | undefined, now: number, tick: number): void {
    const list = storms ?? EMPTY;
    if (list === this.lastPayload) return;
    this.lastPayload = list;
    const dt = now - this.lastArrive;
    if (this.lastArrive > 0 && dt > 200 && dt < 10000) this.interval = this.interval * 0.7 + dt * 0.3;
    this.lastArrive = now;
    const ticks = this.lastTick >= 0 && tick > this.lastTick ? Math.min(tick - this.lastTick, 1000) : 0;
    this.lastTick = tick;
    const predX = this.driftX * ticks, predY = this.driftY * ticks;
    // Exact while the wind holds; it turns slowly over the year, so allow a share of the most a storm can
    // move, or all of it before the first drift is known.
    const canMove = STORM_TILES_PER_TICK * ticks * (this.hasDrift ? 0.25 : 1);
    const reach = Math.min(MATCH_TILES_MAX, MATCH_TILES + canMove);

    const alive = this.tracked.filter((s) => s.gone === 0);
    const used = new Uint8Array(alive.length);
    let sumX = 0, sumY = 0, matched = 0;
    for (let k = 0; k + 1 < list.length; k += 2) {
      const nx = list[k], ny = list[k + 1];
      let best = -1, bestD = reach * reach;
      for (let i = 0; i < alive.length; i++) {
        if (used[i]) continue;
        const s = alive[i];
        const ex = wrapD(nx - (s.toX + predX)), ey = wrapD(ny - (s.toY + predY));
        const d = ex * ex + ey * ey;
        if (d < bestD) { bestD = d; best = i; }
      }
      if (best >= 0) {
        used[best] = 1;
        const s = alive[best];
        const mx = wrapD(nx - s.toX), my = wrapD(ny - s.toY);
        sumX += mx; sumY += my; matched++;
        // Glide from where it is shown now to the new position over the next payload interval.
        s.fromX = s.x; s.fromY = s.y;
        s.toX = s.toX + mx; s.toY = s.toY + my;
      } else {
        const key = hash32(Math.round(nx), Math.round(ny), 0x5707);
        this.tracked.push(buildStorm(key, nx, ny, now));
      }
    }
    for (let i = 0; i < alive.length; i++) {
      if (!used[i]) {
        const s = alive[i];
        s.gone = now;
        s.fromX = s.x; s.fromY = s.y;
        s.toX = s.x + this.stepX; s.toY = s.y + this.stepY;
      }
    }
    if (matched > 0 && ticks > 0) {
      this.stepX = sumX / matched;
      this.stepY = sumY / matched;
      this.driftX = this.stepX / ticks;
      this.driftY = this.stepY / ticks;
      this.hasDrift = true;
      const len = Math.hypot(this.stepX, this.stepY);
      if (len > 0.05) { this.windX = this.stepX / len; this.windY = this.stepY / len; }
    } else if (ticks === 0) {
      this.stepX = this.stepY = 0;
    }
  }

  /**
   * Cloud shadows (cell size up to STORM_SHADOW_MAX_CELL) and rain (all zooms), clipped to the world rect,
   * with the map's wrapped copies. Ground layer: drawn before anyone standing.
   */
  public draw(ctx: CanvasRenderingContext2D, panX: number, panY: number, cs: number,
    worldPxW: number, worldPxH: number, screenW: number, screenH: number, now: number): void {
    if (this.tracked.length === 0) return;
    const still = this.reducedMotion?.matches === true;
    // Drop the storms that have faded out.
    for (let i = this.tracked.length - 1; i >= 0; i--) {
      const s = this.tracked[i];
      if (s.gone > 0 && now - s.gone >= FADE_OUT_MS) this.tracked.splice(i, 1);
    }
    const t = Math.max(0, Math.min(1, (now - this.lastArrive) / this.interval));
    const drawShadow = cs <= STORM_SHADOW_MAX_CELL;
    const half = CLOUD_R * cs;
    const x0 = Math.max(0, panX), y0 = Math.max(0, panY);
    const x1 = Math.min(screenW, panX + worldPxW), y1 = Math.min(screenH, panY + worldPxH);
    if (x1 <= x0 || y1 <= y0) return;

    // Rain streak: falls down the screen, slanted downwind; a little longer up close.
    const len = Math.max(4, Math.min(14, cs * 1.4));
    const sx = Math.round(this.windX * 0.6 * len), sy = Math.round((0.75 + this.windY * 0.25) * len);
    const travel = 1.6;
    const dropCount = cs <= 4 ? 36 : cs <= 8 ? 64 : RAIN_DROPS;

    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0, x1 - x0, y1 - y0);
    ctx.clip();
    ctx.strokeStyle = RAIN_COLOUR;
    ctx.lineWidth = cs >= 8 ? 1.5 : 1;
    for (let i = 0; i < this.tracked.length; i++) {
      const s = this.tracked[i];
      const ts = s.gone > 0 ? Math.min(1, (now - s.gone) / this.interval) : t;
      s.x = s.fromX + (s.toX - s.fromX) * ts;
      s.y = s.fromY + (s.toY - s.fromY) * ts;
      const fade = s.gone > 0 ? 1 - (now - s.gone) / FADE_OUT_MS : Math.min(1, (now - s.born) / FADE_IN_MS);
      if (fade <= 0) continue;
      const wx = ((s.x % WORLD) + WORLD) % WORLD, wy = ((s.y % WORLD) + WORLD) % WORLD;
      for (let dy = -1; dy <= 1; dy++) {
        const cy = panY + (wy + dy * WORLD) * cs;
        if (cy + half < y0 || cy - half > y1) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const cx = panX + (wx + dx * WORLD) * cs;
          if (cx + half < x0 || cx - half > x1) continue;
          ctx.globalAlpha = fade;
          if (drawShadow) {
            s.sprite ??= buildSprite(s.key);
            ctx.drawImage(s.sprite, Math.round(cx - half), Math.round(cy - half), CLOUD_SIZE * cs, CLOUD_SIZE * cs);
          }
          ctx.beginPath();
          const n = Math.min(dropCount, s.phases.length);
          for (let k = 0; k < n; k++) {
            const p = still ? s.phases[k] : (now / RAIN_PERIOD_MS + s.phases[k]) % 1;
            const bx = cx + s.drops[k * 2] * cs + sx * travel * (p - 0.5);
            const by = cy + s.drops[k * 2 + 1] * cs + sy * travel * (p - 0.5);
            const ax = Math.round(bx) + 0.5, ay = Math.round(by);
            ctx.moveTo(ax, ay);
            ctx.lineTo(ax + sx, ay + sy);
          }
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }
}

const EMPTY: readonly number[] = [];
