import { describe, expect, it } from 'vitest';
import { panToAnchor, pinchZoomIndex, worldAt } from '../src/render/zoom';

const STEPS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32];

describe('zoom about a point (viewer camera maths)', () => {
  it('keeps the world point under the anchor through every zoom step, within half a pixel', () => {
    const panX = -1234, panY = 517;
    for (const [sx, sy] of [[37, 611], [300.5, 12.25], [0, 0]]) {
      const at = worldAt(sx, sy, panX, panY, 8);
      for (const cs of STEPS) {
        const pan = panToAnchor(sx, sy, at.x, at.y, cs);
        expect(Number.isInteger(pan.panX) && Number.isInteger(pan.panY)).toBe(true);
        const back = worldAt(sx, sy, pan.panX, pan.panY, cs);
        expect(Math.abs((back.x - at.x) * cs)).toBeLessThanOrEqual(0.5 + 1e-9);
        expect(Math.abs((back.y - at.y) * cs)).toBeLessThanOrEqual(0.5 + 1e-9);
      }
    }
  });

  it('moving the anchor pans by the same amount at a fixed zoom', () => {
    const at = worldAt(100, 100, 0, 0, 10);
    const a = panToAnchor(100, 100, at.x, at.y, 10);
    const b = panToAnchor(140, 70, at.x, at.y, 10);
    expect([b.panX - a.panX, b.panY - a.panY]).toEqual([40, -30]);
  });

  it('picks the step the finger spread asks for', () => {
    expect(pinchZoomIndex(STEPS, 6, 100, 100)).toBe(6); // no change in spread: same step (8)
    expect(STEPS[pinchZoomIndex(STEPS, 6, 100, 200)]).toBe(16); // twice as far: twice the size
    expect(STEPS[pinchZoomIndex(STEPS, 6, 200, 100)]).toBe(4);
    expect(pinchZoomIndex(STEPS, 6, 100, 10000)).toBe(STEPS.length - 1); // clamps at the ends
    expect(pinchZoomIndex(STEPS, 6, 100, 0.01)).toBe(0);
    expect(pinchZoomIndex(STEPS, 6, 0, 50)).toBe(6); // a degenerate start changes nothing
  });
});
