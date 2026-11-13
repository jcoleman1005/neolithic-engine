/**
 * The limited palette (user choice, 2026-11-13): a GBA-inspired set of 34 colours, and every colour
 * the world view draws comes from it, unless the viewer picks "Original" in the pill menu (stored in
 * localStorage; also `?palette=original` in the URL). Viewer only: nothing here touches the simulation.
 *
 * The palette follows Game Boy Advance rules without copying any game: every channel is a multiple of
 * 8 (the GBA's 15-bit colour), colours are bright and saturated (made for an unlit screen), ramps shift
 * hue (shadows lean blue or purple, highlights lean yellow), and outlines are a dark navy, not black.
 * Two muted sand tones (#d8c088, #b89860) were added at the user's request to tone the sand down.
 *
 * How colours get here:
 * - The terrain ramps and the people's colours are picked by hand (palette.ts, OVERRIDES below).
 * - Every other colour written in the code is mapped to its nearest palette colour by perceived
 *   difference (OKLab), when it is turned into a number (hexToABGR) or set on the canvas (paletteCss).
 * - Pixels written straight into image data (the terrain cache, tile and storm sprites) are snapped
 *   with quantizeImage, and the see-through overlay is made solid with quantizeOver.
 * Translucent drawing (shadows, glows, fades) still blends palette colours with what is under them.
 */

export const LIMITED_PALETTE: readonly string[] = [
  '#101828', '#f8f8f8', // navy outline, white
  '#104830', '#207840', '#40a048', '#78c850', '#b8e870', // greens: dark teal-green to yellow-green
  '#182868', '#2850a8', '#3880d0', '#60b0f0', '#a8e0f8', // blues: navy to sky
  '#a85828', '#d08838', '#e8b850', '#f8e090', '#f8f8d0', // yellows: orange shadow to cream
  '#482018', '#703020', '#985038', // earth
  '#882030', '#d03838', '#f87058', // reds
  '#f8b888', '#d08860', // skin and its shade
  '#503078', '#8850b0', '#f888c8', // purples and pink
  '#303048', '#586078', '#8890a8', '#c0c8d8', // cool greys
  '#d8c088', '#b89860', // muted sand
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
 * swaddle, the fire, the pops and the darkest outlines. Keys are the original colours in the code,
 * lower case.
 */
const OVERRIDES: Readonly<Record<string, string>> = {
  // People (sprites.ts): skin, hair, tunics by who they are, legs, outline.
  '#f5c69b': '#f8b888', '#fde2c7': '#f8f8d0', '#fef08a': '#f8e090', '#d9a578': '#d08860',
  '#3b2314': '#703020', '#1c1917': '#101828', '#e2e8f0': '#f8f8f8',
  '#2563eb': '#3880d0', '#1d4ed8': '#2850a8', // man
  '#e11d48': '#d03838', '#be123c': '#882030', // woman
  '#f43f5e': '#f888c8', '#fda4af': '#f8f8d0', // pregnant
  '#f59e0b': '#e8b850', '#d97706': '#d08838', // child
  '#64748b': '#8890a8', '#475569': '#586078', // elder
  '#991b1b': '#8850b0', '#7f1d1d': '#503078', // starving
  '#1e293b': '#303048', '#3b2a1c': '#482018', '#141824': '#101828', '#3a2414': '#703020', '#d4af37': '#e8b850',
  '#6b4423': '#985038', '#cbd5e1': '#c0c8d8', '#efe3c8': '#f8f8d0',
  // Trees: broadleaf, pine, fruit, bark.
  '#1b4332': '#104830', '#2d6a4f': '#207840', '#40916c': '#40a048', '#74c69d': '#78c850',
  '#064e3b': '#104830', '#047857': '#207840', '#10b981': '#40a048', '#34d399': '#b8e870',
  '#ef4444': '#d03838', '#facc15': '#f8e090', '#78350f': '#703020', '#451a03': '#482018', '#9a5a22': '#985038',
  // Fire.
  '#ffe066': '#f8e090', '#f59f00': '#d08838', '#d9480f': '#d03838', '#3b0d0c': '#482018',
  // Far-zoom people (one dot each), light enough to read on grass and sand.
  '#38bdf8': '#60b0f0', '#fb7185': '#f888c8', '#888888': '#8890a8',
  // Event pops: a pink heart, red meat with a pale bone, a yellow and orange flame, a clay hut.
  '#f472b6': '#f888c8', '#dc2626': '#d03838', '#b91c1c': '#882030', '#f8fafc': '#f8f8f8', '#fbbf24': '#f8e090',
  '#f97316': '#f87058', '#a16207': '#a85828', '#d6b48a': '#e8b850',
  // Pure black and the page background.
  '#000000': '#101828', '#0b0f19': '#101828',
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

/** Index of the palette colour nearest (r, g, b), skipping any indices in `avoid`. */
export function nearestIndex(r: number, g: number, b: number, avoid?: ReadonlySet<number>): number {
  const [L, A, B] = oklab(r, g, b);
  let best = 0, bestD = Infinity;
  for (let i = 0; i < PAL_LAB.length; i++) {
    if (avoid && avoid.has(i)) continue;
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
/**
 * Colours overlay mixes never land on: the two brightest greens (crops would read as lime) and the two
 * muted sand tones (faint tilled-soil tints on grass would turn into a tan checkerboard).
 */
const OVERLAY_AVOID: ReadonlySet<number> = new Set(
  ['#b8e870', '#78c850', '#d8c088', '#b89860'].map((h) => LIMITED_PALETTE.indexOf(h))
);
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
      const key = gi === undefined ? -1 : (c >>> 0) * LIMITED_PALETTE.length + gi;
      if (key >= 0) {
        const hit = overMemo.get(key);
        if (hit !== undefined) { data[i] = hit; continue; }
      }
      const t = a / 255;
      const r = Math.round((c & 0xff) * t + (g & 0xff) * (1 - t));
      const gg = Math.round(((c >> 8) & 0xff) * t + ((g >> 8) & 0xff) * (1 - t));
      const b = Math.round(((c >> 16) & 0xff) * t + ((g >> 16) & 0xff) * (1 - t));
      const q = ((0xff << 24) | PAL_ABGR[nearestIndex(r, gg, b, OVERLAY_AVOID)]) >>> 0;
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
  '#d03838', '#e8b850', '#3880d0', '#60b0f0', '#8850b0', '#f8e090', '#f888c8', '#f87058',
  '#78c850', '#a8e0f8', '#d08838', '#503078',
];
