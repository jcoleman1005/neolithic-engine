// Pure zoom maths for the viewer camera: pan is in CSS pixels, a world cell spans `cellSize` of them,
// so a cell (wx, wy) sits on screen at (wx * cellSize + panX, wy * cellSize + panY).

/** The world point (in cells, fractional) under a screen point, in CSS pixels from the canvas corner. */
export function worldAt(sx: number, sy: number, panX: number, panY: number, cellSize: number): { x: number; y: number } {
  return { x: (sx - panX) / cellSize, y: (sy - panY) / cellSize };
}

/**
 * The pan that puts world point (wx, wy) under screen point (sx, sy) at `cellSize`, in whole pixels so the
 * art stays crisp (the anchor then drifts by under half a pixel, never more).
 */
export function panToAnchor(sx: number, sy: number, wx: number, wy: number, cellSize: number): { panX: number; panY: number } {
  return { panX: Math.round(sx - wx * cellSize), panY: Math.round(sy - wy * cellSize) };
}

/**
 * Pinch zoom: the zoom step the spread of the fingers asks for, from where the pinch started.
 * The ratio is compared in log space, so spreading twice as far always means about twice the size.
 */
export function pinchZoomIndex(steps: readonly number[], startIndex: number, startDist: number, dist: number): number {
  if (!(startDist > 0) || !(dist > 0)) return startIndex;
  const want = Math.log(steps[startIndex] * (dist / startDist));
  let best = 0;
  for (let i = 1; i < steps.length; i++) {
    if (Math.abs(Math.log(steps[i]) - want) < Math.abs(Math.log(steps[best]) - want)) best = i;
  }
  return best;
}
