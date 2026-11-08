import { describe, expect, it } from 'vitest';
import { decodePng, encodePng, encodePngRgba } from '../scripts/png';
import { blankProblems, diffFrames, frameStats, type Frame } from '../scripts/visual-lib';

function solid(w: number, h: number, r: number, g: number, b: number): Frame {
  const rgba = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    rgba[i * 4] = r;
    rgba[i * 4 + 1] = g;
    rgba[i * 4 + 2] = b;
    rgba[i * 4 + 3] = 255;
  }
  return { width: w, height: h, rgba };
}

/** A busy frame: a smooth-ish colour field with many distinct colours, like a drawn map. */
function busy(w: number, h: number): Frame {
  const f = solid(w, h, 0, 0, 0);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      f.rgba[o] = (x * 7 + y * 3) & 255;
      f.rgba[o + 1] = (x * 5 + y * 11) & 255;
      f.rgba[o + 2] = (x * 13 + y * 2) & 255;
    }
  }
  return f;
}

describe('png round trip', () => {
  it('decodes what encodePng wrote', () => {
    const f = busy(37, 21);
    const rgb = new Uint8Array(37 * 21 * 3);
    for (let i = 0; i < 37 * 21; i++) {
      rgb[i * 3] = f.rgba[i * 4];
      rgb[i * 3 + 1] = f.rgba[i * 4 + 1];
      rgb[i * 3 + 2] = f.rgba[i * 4 + 2];
    }
    const back = decodePng(encodePng(37, 21, rgb));
    expect(back.width).toBe(37);
    expect(back.height).toBe(21);
    expect(Array.from(back.rgba)).toEqual(Array.from(f.rgba));
  });

  it('writes RGBA frames as opaque PNGs', () => {
    const f = busy(8, 8);
    const back = decodePng(encodePngRgba(8, 8, f.rgba));
    expect(Array.from(back.rgba)).toEqual(Array.from(f.rgba));
  });

  it('refuses things that are not PNGs', () => {
    expect(() => decodePng(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]))).toThrow(/Not a PNG/);
  });
});

describe('blank frames', () => {
  it('flags a single-colour frame', () => {
    const problems = blankProblems(frameStats(solid(100, 80, 10, 20, 30)));
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.join(' ')).toMatch(/100\.0% of pixels are #0a141e/);
  });

  it('flags a frame that is mostly background with a few marks', () => {
    const f = solid(100, 100, 5, 5, 5);
    for (let i = 0; i < 30; i++) f.rgba[i * 4] = 200 + i; // 30 off-colour pixels of 10,000
    expect(blankProblems(frameStats(f)).length).toBeGreaterThan(0);
  });

  it('flags a frame whose only variation is a faint gradient', () => {
    const f = solid(100, 100, 40, 40, 40);
    for (let i = 0; i < 10000; i++) f.rgba[i * 4] = 40 + (i % 6); // 6 shades within 5 of the background
    const problems = blankProblems(frameStats(f));
    expect(problems.join(' ')).toMatch(/differ from the background|of pixels are/);
  });

  it('passes a busy frame', () => {
    expect(blankProblems(frameStats(busy(120, 90)))).toEqual([]);
  });

  it('judges only the crop when given one', () => {
    const f = busy(100, 100);
    for (let y = 0; y < 50; y++) for (let x = 0; x < 100; x++) f.rgba.set([9, 9, 9, 255], (y * 100 + x) * 4);
    expect(blankProblems(frameStats(f))).toEqual([]); // half the frame is flat, half is busy: 50% dominant is fine
    expect(blankProblems(frameStats(f, { x: 0, y: 0, width: 100, height: 50 })).length).toBeGreaterThan(0); // the flat top half alone is blank
    expect(blankProblems(frameStats(f, { x: 0, y: 50, width: 100, height: 50 }))).toEqual([]);
  });

  it('reports an empty crop', () => {
    expect(blankProblems(frameStats(busy(10, 10), { x: 20, y: 20, width: 5, height: 5 }))).toEqual(['the crop has no pixels']);
  });
});

describe('pixel diff', () => {
  it('matches identical frames', () => {
    const a = busy(64, 48);
    const d = diffFrames(a, busy(64, 48));
    expect(d.pass).toBe(true);
    expect(d.differing).toBe(0);
  });

  it('ignores changes below the pixel threshold', () => {
    const a = busy(64, 48);
    const b = busy(64, 48);
    for (let i = 0; i < 64 * 48; i++) b.rgba[i * 4] = Math.min(255, b.rgba[i * 4] + 5);
    expect(diffFrames(a, b, { pixelThreshold: 12, tolerance: 0 }).pass).toBe(true);
  });

  it('fails when more than the tolerated share of pixels changed, and passes under it', () => {
    const a = busy(100, 100);
    const b = busy(100, 100);
    for (let i = 0; i < 50; i++) b.rgba[i * 4 + 1] = (b.rgba[i * 4 + 1] + 128) & 255; // 50 of 10,000 = 0.5%
    expect(diffFrames(a, b, { pixelThreshold: 12, tolerance: 0.001 }).pass).toBe(false);
    const ok = diffFrames(a, b, { pixelThreshold: 12, tolerance: 0.01 });
    expect(ok.pass).toBe(true);
    expect(ok.differing).toBe(50);
    expect(ok.fraction).toBeCloseTo(0.005, 6);
    expect(ok.image).not.toBeNull();
  });

  it('fails on a size change', () => {
    const d = diffFrames(busy(64, 48), busy(64, 49));
    expect(d.sizeMismatch).toBe(true);
    expect(d.pass).toBe(false);
  });
});
