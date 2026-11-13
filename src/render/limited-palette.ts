/**
 * The limited palette (user choice, 2026-11-13): every colour the world view draws comes from these
 * 30, unless the viewer picks "Original colours" in the pill menu (stored in localStorage; also
 * `?palette=original` in the URL). Viewer only: nothing here touches the simulation.
 *
 * How colours get here:
 * - The terrain ramps and the people's colours are picked by hand (palette.ts, OVERRIDES below).
 * - Every other colour written in the code is mapped to its nearest palette colour by perceived
 *   difference (OKLab), when it is turned into a number (hexToABGR) or set on the canvas (paletteCss).
 * - Pixels written straight into image data (the terrain cache, the overlay, far-zoom people, sprite
 *   atlases) are snapped with quantizeImage before they are put on a canvas.
 * Translucent drawing (shadows, glows, fades) still blends palette colours with what is under them.
 */

export const LIMITED_PALETTE: readonly string[] = [
  '#636663', '#87857c', '#bcad9f', '#f2b888', '#eb9661', '#b55945', '#734c44', '#3d3333', '#593e47', '#7a5859',
  '#a57855', '#de9f47', '#fdd179', '#fee1b8', '#d4c692', '#a6b04f', '#819447', '#44702d', '#2f4d2f', '#546756',
  '#89a477', '#a4c5af', '#cae6d9', '#f1f6f0', '#d5d6db', '#bbc3d0', '#96a9c1', '#6c81a1', '#405273', '#303843',
];

function readMode(): boolean {
  try {
    if (typeof location !== 'undefined' && /[?&]palette=original\b/.test(location.search)) return false;
    if (typeof localStorage !== 'undefined' && localStorage.getItem(PALETTE_STORAGE_KEY) === 'original') return false;
  } catch {
    // Storage blocked: fall through to the default.
  }
  return true;
}

export const PALETTE_STORAGE_KEY = 'neolithic.palette';
/** True when the world is drawn in the limited palette (the default). */
export const LIMITED = readMode();

/** Saves the choice; the page reloads to apply it, since colours are computed when modules load. */
export function setLimitedPalette(on: boolean): void {
  try {
    localStorage.setItem(PALETTE_STORAGE_KEY, on ? 'limited' : 'original');
  } catch {
    // Storage blocked: the choice lasts only for this load.
  }
}

/**
 * Hand picks for colours that matter more than their nearest match: people, trees, the spear and the
 * swaddle, the fire, crops and the darkest outlines (the palette has no black; its darkest are
 * #303843 and #3d3333). Keys are the original colours in the code, lower case.
 */
const OVERRIDES: Readonly<Record<string, string>> = {
  // People (sprites.ts): skin, hair, tunics by who they are, legs, outline.
  '#f5c69b': '#f2b888', '#fde2c7': '#fee1b8', '#fef08a': '#d4c692', '#d9a578': '#eb9661',
  '#3b2314': '#734c44', '#1c1917': '#3d3333', '#e2e8f0': '#d5d6db',
  '#2563eb': '#96a9c1', '#1d4ed8': '#6c81a1', // man
  '#e11d48': '#b55945', '#be123c': '#7a5859', // woman
  '#f43f5e': '#eb9661', '#fda4af': '#fee1b8', // pregnant
  '#f59e0b': '#fdd179', '#d97706': '#de9f47', // child
  '#64748b': '#87857c', '#475569': '#636663', // elder
  '#991b1b': '#7a5859', '#7f1d1d': '#593e47', // starving
  '#1e293b': '#303843', '#3b2a1c': '#3d3333', '#141824': '#303843', '#3a2414': '#593e47', '#d4af37': '#de9f47',
  '#6b4423': '#a57855', '#cbd5e1': '#d5d6db', '#efe3c8': '#fee1b8',
  // Trees: broadleaf, pine, fruit, bark.
  '#1b4332': '#2f4d2f', '#2d6a4f': '#44702d', '#40916c': '#819447', '#74c69d': '#a6b04f',
  '#064e3b': '#2f4d2f', '#047857': '#546756', '#10b981': '#89a477', '#34d399': '#a4c5af',
  '#ef4444': '#b55945', '#facc15': '#fdd179', '#78350f': '#734c44', '#451a03': '#593e47', '#9a5a22': '#a57855',
  // Fire and crops.
  '#ffe066': '#fdd179', '#f59f00': '#de9f47', '#d9480f': '#b55945', '#3b0d0c': '#3d3333',
  // Far-zoom people (one dot each): light enough to read on grass and on sand.
  // (#f43f5e pregnant and #cbd5e1 elder share the sprite picks above.)
  '#38bdf8': '#96a9c1', '#fb7185': '#eb9661', '#888888': '#bcad9f',
  // Event pops (renderer.ts): a red heart, red meat with a pale bone, a yellow and orange flame, a clay hut.
  '#f472b6': '#b55945', '#dc2626': '#b55945', '#b91c1c': '#7a5859', '#f8fafc': '#f1f6f0', '#fbbf24': '#fdd179',
  '#f97316': '#de9f47', '#a16207': '#a57855', '#d6b48a': '#d4c692',
  // Pure black and the page background.
  '#000000': '#303843', '#0b0f19': '#303843',
};

// --- Perceived colour (OKLab) and nearest match ---

function srgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function oklab(r: number, g: number, b: number): [number, number, number] {
  const lr = srgbToLinear(r), lg = srgbToLinear(g), lb = srgbToLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

const PAL_RGB: readonly (readonly [number, number, number])[] = LIMITED_PALETTE.map((h) => [
  parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16),
]);
const PAL_LAB = PAL_RGB.map(([r, g, b]) => oklab(r, g, b));

/** Index of the palette colour nearest (r, g, b). */
export function nearestIndex(r: number, g: number, b: number): number {
  const [L, A, B] = oklab(r, g, b);
  let best = 0, bestD = Infinity;
  for (let i = 0; i < PAL_LAB.length; i++) {
    const p = PAL_LAB[i];
    const d = (L - p[0]) ** 2 + (A - p[1]) ** 2 + (B - p[2]) ** 2;
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

/** The palette colour for a `#rrggbb` colour: a hand pick if there is one, else the nearest. Unchanged when off. */
export function paletteHex(hex: string): string {
  if (!LIMITED) return hex;
  const h = hex.toLowerCase();
  const o = OVERRIDES[h];
  if (o) return o;
  return LIMITED_PALETTE[nearestIndex(parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16))];
}

// --- CSS colours set on the world canvas ---

const cssCache = new Map<string, string>();
const CSS_CACHE_MAX = 4096;

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number): number => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return [f(0), f(8), f(4)];
}

/**
 * A canvas colour string with its colour moved into the palette and its alpha kept: `#rgb`,
 * `#rrggbb`, `rgb()`, `rgba()` and `hsl()`/`hsla()`. Anything else (gradients, names) passes through.
 */
export function paletteCss(css: string): string {
  if (!LIMITED) return css;
  const hit = cssCache.get(css);
  if (hit !== undefined) return hit;
  let out = css;
  const s = css.trim().toLowerCase();
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^#([0-9a-f]{6})$/))) out = paletteHex(s);
  else if ((m = s.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/))) out = paletteHex(`#${m[1]}${m[1]}${m[2]}${m[2]}${m[3]}${m[3]}`);
  else if ((m = s.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/))) {
    const p = PAL_RGB[nearestIndex(+m[1], +m[2], +m[3])];
    out = m[4] !== undefined ? `rgba(${p[0]}, ${p[1]}, ${p[2]}, ${m[4]})` : `rgb(${p[0]}, ${p[1]}, ${p[2]})`;
  } else if ((m = s.match(/^hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*(?:,\s*([\d.]+)\s*)?\)$/))) {
    const [r, g, b] = hslToRgb(+m[1], +m[2] / 100, +m[3] / 100);
    const p = PAL_RGB[nearestIndex(r, g, b)];
    out = m[4] !== undefined ? `rgba(${p[0]}, ${p[1]}, ${p[2]}, ${m[4]})` : `rgb(${p[0]}, ${p[1]}, ${p[2]})`;
  }
  if (cssCache.size >= CSS_CACHE_MAX) cssCache.clear();
  cssCache.set(css, out);
  return out;
}

/**
 * Makes every fillStyle, strokeStyle and shadowColor set on this context go through paletteCss,
 * so colours written anywhere in the drawing code (and computed ones, like band hues) land in the
 * palette. Gradients and patterns pass through. No effect when the palette is off.
 */
export function limitCanvasColours(ctx: CanvasRenderingContext2D): void {
  if (!LIMITED) return;
  const proto = Object.getPrototypeOf(ctx) as object;
  for (const key of ['fillStyle', 'strokeStyle', 'shadowColor'] as const) {
    const desc = Object.getOwnPropertyDescriptor(proto, key);
    if (!desc || !desc.set || !desc.get) continue;
    const set = desc.set, get = desc.get;
    Object.defineProperty(ctx, key, {
      configurable: true,
      get() { return get.call(this); },
      set(v: unknown) { set.call(this, typeof v === 'string' ? paletteCss(v) : v); },
    });
  }
}

// --- Image data ---

/** Palette index by 5-bit-per-channel colour, built on first use. */
let lut: Uint8Array | null = null;
const PAL_ABGR = new Uint32Array(PAL_RGB.map(([r, g, b]) => ((b << 16) | (g << 8) | r) >>> 0));
const exact = new Map<number, number>(Array.from(PAL_ABGR, (v, i) => [v, i]));

function buildLut(): Uint8Array {
  const t = new Uint8Array(32768);
  for (let r = 0; r < 32; r++) {
    for (let g = 0; g < 32; g++) {
      for (let b = 0; b < 32; b++) t[(r << 10) | (g << 5) | b] = nearestIndex(r * 8 + 4, g * 8 + 4, b * 8 + 4);
    }
  }
  return t;
}

/** One 0xAABBGGRR colour moved into the palette, alpha kept. Unchanged when off. */
export function quantizeABGR(c: number): number {
  if (!LIMITED) return c >>> 0;
  const a = c >>> 24;
  if (a === 0) return c >>> 0;
  const rgb = c & 0xffffff;
  let idx = exact.get(rgb);
  if (idx === undefined) {
    if (!lut) lut = buildLut();
    idx = lut[(((c & 0xff) >> 3) << 10) | ((((c >> 8) & 0xff) >> 3) << 5) | (((c >> 16) & 0xff) >> 3)];
  }
  return ((a << 24) | PAL_ABGR[idx]) >>> 0;
}

/** Snaps image data (as 0xAABBGGRR words) into the palette in place, optionally only the rectangle given. */
export function quantizeImage(data: Uint32Array, width: number, x0 = 0, y0 = 0, w = width, h = data.length / width): void {
  if (!LIMITED) return;
  for (let y = y0; y < y0 + h; y++) {
    let i = y * width + x0;
    for (let x = 0; x < w; x++, i++) {
      const c = data[i];
      if (c >>> 24 !== 0) data[i] = quantizeABGR(c);
    }
  }
}

const overMemo = new Map<number, number>();
const OVER_MEMO_MAX = 65536;

/** How much nearer (squared OKLab distance) an overlay mix must be to its new colour than to the ground. */
const OVERLAY_BIAS = 2.5;

function labDist2(r: number, g: number, b: number, abgr: number): number {
  const [L, A, B] = oklab(r, g, b);
  const [L2, A2, B2] = oklab(abgr & 0xff, (abgr >> 8) & 0xff, (abgr >> 16) & 0xff);
  return (L - L2) ** 2 + (A - A2) ** 2 + (B - B2) ** 2;
}

/**
 * A see-through overlay (crops, worked soil, dry grass, paths) made solid in the palette: each cell's
 * colour is mixed with the ground colour under it (`ground`, opaque 0xAABBGGRR) by its alpha and the mix
 * snapped to the nearest palette colour, then drawn opaque. Where the mix snaps back to the ground's own
 * colour the cell is left clear, so the ground texture shows at close zoom. Works in place.
 */
export function quantizeOver(
  data: Uint32Array, ground: Uint32Array, width: number, x0 = 0, y0 = 0, w = width, h = data.length / width
): void {
  if (!LIMITED) return;
  for (let y = y0; y < y0 + h; y++) {
    let i = y * width + x0;
    for (let x = 0; x < w; x++, i++) {
      const c = data[i];
      const a = c >>> 24;
      if (a === 0) continue;
      const g = ground[i];
      // Few overlay colours and alpha steps meet few ground colours: remember each answer.
      const gi = exact.get(g & 0xffffff);
      const key = gi === undefined ? -1 : (c >>> 0) * 32 + gi;
      if (key >= 0) {
        const hit = overMemo.get(key);
        if (hit !== undefined) { data[i] = hit; continue; }
      }
      const t = a / 255;
      const r = Math.round((c & 0xff) * t + (g & 0xff) * (1 - t));
      const gg = Math.round(((c >> 8) & 0xff) * t + ((g >> 8) & 0xff) * (1 - t));
      const b = Math.round(((c >> 16) & 0xff) * t + ((g >> 16) & 0xff) * (1 - t));
      const q = quantizeABGR(((0xff << 24) | (b << 16) | (gg << 8) | r) >>> 0);
      // A faint tint stays the ground: the mix must sit clearly nearer the new colour than the ground.
      const out = (q & 0xffffff) === (g & 0xffffff) || labDist2(r, gg, b, g) <= OVERLAY_BIAS * labDist2(r, gg, b, q) ? 0 : q;
      data[i] = out;
      if (key >= 0) {
        if (overMemo.size >= OVER_MEMO_MAX) overMemo.clear();
        overMemo.set(key, out);
      }
    }
  }
}

/** Band colours: well-separated palette colours that read on grass and sand. */
export const BAND_COLOURS: readonly string[] = [
  '#b55945', '#de9f47', '#6c81a1', '#a4c5af', '#eb9661', '#405273', '#fdd179', '#7a5859',
  '#cae6d9', '#a6b04f', '#f2b888', '#96a9c1',
];
