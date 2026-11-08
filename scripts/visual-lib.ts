/**
 * Pixel checks for scripts/visual-check.ts: is a frame blank, and how far is it from its baseline.
 * Pure functions over RGBA buffers, so tests/visual-lib.test.ts can cover them without a browser.
 */

export interface Frame {
  readonly width: number;
  readonly height: number;
  /** RGBA, 4 bytes per pixel, row by row. */
  readonly rgba: Uint8Array;
}

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface FrameStats {
  /** Pixels looked at. */
  readonly pixels: number;
  /** Different colours (full 24-bit RGB). */
  readonly distinctColors: number;
  /** Share of pixels that have the single most common colour, 0..1. */
  readonly dominantFraction: number;
  /** The most common colour as #rrggbb. */
  readonly dominantColor: string;
  /** Share of pixels not within `quiet` of the most common colour: the "something is drawn" measure. */
  readonly drawnFraction: number;
}

export interface BlankLimits {
  /** A frame whose most common colour covers more than this is called blank. */
  readonly maxDominantFraction: number;
  /** Fewer different colours than this is called blank. */
  readonly minDistinctColors: number;
  /** Less drawn content than this (share of pixels away from the background colour) is called empty. */
  readonly minDrawnFraction: number;
}

export const DEFAULT_BLANK_LIMITS: BlankLimits = {
  maxDominantFraction: 0.9,
  minDistinctColors: 24,
  minDrawnFraction: 0.1,
};

const hex = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;

/** Colour statistics of a frame, optionally of one rectangle of it. */
export function frameStats(frame: Frame, crop?: Rect): FrameStats {
  const x0 = Math.max(0, crop?.x ?? 0);
  const y0 = Math.max(0, crop?.y ?? 0);
  const x1 = Math.min(frame.width, x0 + (crop?.width ?? frame.width));
  const y1 = Math.min(frame.height, y0 + (crop?.height ?? frame.height));
  const counts = new Map<number, number>();
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const o = (y * frame.width + x) * 4;
      const key = (frame.rgba[o] << 16) | (frame.rgba[o + 1] << 8) | frame.rgba[o + 2];
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const pixels = Math.max(0, x1 - x0) * Math.max(0, y1 - y0);
  let topKey = 0;
  let top = 0;
  for (const [k, n] of counts) {
    if (n > top || (n === top && k < topKey)) {
      top = n;
      topKey = k;
    }
  }
  // "Drawn" means clearly away from the background: a faint gradient or dither of the same colour
  // must not make an empty canvas look full.
  const QUIET = 12;
  const br = (topKey >> 16) & 255;
  const bg = (topKey >> 8) & 255;
  const bb = topKey & 255;
  let drawn = 0;
  for (const [k, n] of counts) {
    const d = Math.max(Math.abs(((k >> 16) & 255) - br), Math.abs(((k >> 8) & 255) - bg), Math.abs((k & 255) - bb));
    if (d > QUIET) drawn += n;
  }
  return {
    pixels,
    distinctColors: counts.size,
    dominantFraction: pixels > 0 ? top / pixels : 1,
    dominantColor: hex(topKey),
    drawnFraction: pixels > 0 ? drawn / pixels : 0,
  };
}

/** Why a frame counts as blank or empty; an empty list means it has content. */
export function blankProblems(stats: FrameStats, limits: BlankLimits = DEFAULT_BLANK_LIMITS): string[] {
  const problems: string[] = [];
  if (stats.pixels === 0) return ['the crop has no pixels'];
  if (stats.dominantFraction > limits.maxDominantFraction) {
    problems.push(`${(stats.dominantFraction * 100).toFixed(1)}% of pixels are ${stats.dominantColor} (limit ${(limits.maxDominantFraction * 100).toFixed(0)}%)`);
  }
  if (stats.distinctColors < limits.minDistinctColors) {
    problems.push(`only ${stats.distinctColors} distinct colours (need ${limits.minDistinctColors})`);
  }
  if (stats.drawnFraction < limits.minDrawnFraction) {
    problems.push(`only ${(stats.drawnFraction * 100).toFixed(1)}% of pixels differ from the background ${stats.dominantColor} (need ${(limits.minDrawnFraction * 100).toFixed(0)}%)`);
  }
  return problems;
}

export interface DiffOptions {
  /** A pixel differs when any colour channel moves by more than this (0..255). */
  readonly pixelThreshold: number;
  /** The frames match when no more than this share of pixels differ (0..1). */
  readonly tolerance: number;
}

export const DEFAULT_DIFF: DiffOptions = { pixelThreshold: 12, tolerance: 0.002 };

export interface DiffResult {
  readonly sizeMismatch: boolean;
  readonly differing: number;
  readonly total: number;
  readonly fraction: number;
  /** The largest channel change seen anywhere. */
  readonly maxDelta: number;
  readonly pass: boolean;
  /** Dimmed copy of the current frame with differing pixels in red; null when the sizes differ. */
  readonly image: Frame | null;
}

export function diffFrames(baseline: Frame, current: Frame, options: DiffOptions = DEFAULT_DIFF): DiffResult {
  if (baseline.width !== current.width || baseline.height !== current.height) {
    return { sizeMismatch: true, differing: current.width * current.height, total: current.width * current.height, fraction: 1, maxDelta: 255, pass: false, image: null };
  }
  const total = current.width * current.height;
  const out = new Uint8Array(total * 4);
  let differing = 0;
  let maxDelta = 0;
  for (let i = 0; i < total; i++) {
    const o = i * 4;
    const d = Math.max(
      Math.abs(baseline.rgba[o] - current.rgba[o]),
      Math.abs(baseline.rgba[o + 1] - current.rgba[o + 1]),
      Math.abs(baseline.rgba[o + 2] - current.rgba[o + 2])
    );
    if (d > maxDelta) maxDelta = d;
    if (d > options.pixelThreshold) {
      differing++;
      out[o] = 255;
      out[o + 1] = 0;
      out[o + 2] = 0;
    } else {
      out[o] = current.rgba[o] >> 2;
      out[o + 1] = current.rgba[o + 1] >> 2;
      out[o + 2] = current.rgba[o + 2] >> 2;
    }
    out[o + 3] = 255;
  }
  const fraction = total > 0 ? differing / total : 0;
  return { sizeMismatch: false, differing, total, fraction, maxDelta, pass: fraction <= options.tolerance, image: { width: current.width, height: current.height, rgba: out } };
}
