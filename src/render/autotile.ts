/**
 * src/render/autotile.ts
 * Procedural 47-tile (8-neighbor) bitmask atlas generator and neighbor bitmask math.
 */

import type { MaterialRamp } from './palette';

// 8-neighbor bit flags:
// NW=1,  N=2,  NE=4
// W=8,          E=16
// SW=32, S=64, SE=128
export const BIT_NW = 1;
export const BIT_N  = 2;
export const BIT_NE = 4;
export const BIT_W  = 8;
export const BIT_E  = 16;
export const BIT_SW = 32;
export const BIT_S  = 64;
export const BIT_SE = 128;

/**
 * 256-entry lookup mapping any 8-neighbor bitmask (0..255) to a canonical 47-tile index (0..46).
 * Diagonal bits are only considered valid when both adjacent orthogonal neighbors are present.
 */
export const BITMASK_47_LOOKUP = new Uint8Array(256);

function initBitmaskLookup(): void {
  const canonical47 = [
    0, 2, 8, 10, 11, 16, 18, 22, 24, 26, 27, 30, 31, 64, 66, 72, 74, 75, 80, 82, 86, 88, 90, 91, 94, 95,
    104, 106, 107, 120, 122, 123, 126, 127, 208, 210, 214, 216, 218, 219, 222, 223, 248, 250, 251, 254, 255
  ];
  const map = new Map<number, number>();
  canonical47.forEach((mask, idx) => map.set(mask, idx));

  for (let b = 0; b < 256; b++) {
    let clean = b;
    if (!(clean & BIT_N) || !(clean & BIT_W)) clean &= ~BIT_NW;
    if (!(clean & BIT_N) || !(clean & BIT_E)) clean &= ~BIT_NE;
    if (!(clean & BIT_S) || !(clean & BIT_W)) clean &= ~BIT_SW;
    if (!(clean & BIT_S) || !(clean & BIT_E)) clean &= ~BIT_SE;
    BITMASK_47_LOOKUP[b] = map.get(clean) ?? 0;
  }
}
initBitmaskLookup();

/**
 * Procedural 47-tile atlas generation via 8x8 quadrant decomposition.
 * Instead of drawing 47 bespoke configurations, each 16x16 tile is composed of 4 independent
 * 8x8 corner quadrants (NW, NE, SW, SE).
 */
export function generateAutotileAtlas(ramp: MaterialRamp, substrateRamp: MaterialRamp): HTMLCanvasElement {
  const TILE_SIZE = 16;
  const HALF = 8;
  const totalW = TILE_SIZE * 47;
  const totalH = TILE_SIZE;

  // Headless fallback for Node / Vitest testing environment
  if (typeof document === 'undefined') {
    return { width: totalW, height: totalH } as unknown as HTMLCanvasElement;
  }

  const canvas = document.createElement('canvas');
  canvas.width = totalW;
  canvas.height = totalH;
  const ctx = canvas.getContext('2d')!;

  const canonical47 = [
    0, 2, 8, 10, 11, 16, 18, 22, 24, 26, 27, 30, 31, 64, 66, 72, 74, 75, 80, 82, 86, 88, 90, 91, 94, 95,
    104, 106, 107, 120, 122, 123, 126, 127, 208, 210, 214, 216, 218, 219, 222, 223, 248, 250, 251, 254, 255
  ];

  for (let i = 0; i < 47; i++) {
    const mask = canonical47[i];
    const ox = i * TILE_SIZE;

    // Substrate base fill
    ctx.fillStyle = substrateRamp.baseHex;
    ctx.fillRect(ox, 0, TILE_SIZE, TILE_SIZE);

    // Deconstruct mask into 4 quadrants
    drawQuadrant(ctx, ox,        0,    (mask & BIT_W) !== 0, (mask & BIT_N) !== 0, (mask & BIT_NW) !== 0, ramp, 0); // NW
    drawQuadrant(ctx, ox + HALF, 0,    (mask & BIT_E) !== 0, (mask & BIT_N) !== 0, (mask & BIT_NE) !== 0, ramp, 1); // NE
    drawQuadrant(ctx, ox,        HALF, (mask & BIT_W) !== 0, (mask & BIT_S) !== 0, (mask & BIT_SW) !== 0, ramp, 2); // SW
    drawQuadrant(ctx, ox + HALF, HALF, (mask & BIT_E) !== 0, (mask & BIT_S) !== 0, (mask & BIT_SE) !== 0, ramp, 3); // SE
  }
  return canvas;
}

function drawQuadrant(
  ctx: CanvasRenderingContext2D,
  qx: number, qy: number,
  hEdge: boolean, vEdge: boolean, diag: boolean,
  ramp: MaterialRamp,
  quadrantIndex: number // 0=NW, 1=NE, 2=SW, 3=SE
): void {
  ctx.fillStyle = ramp.baseHex;
  ctx.strokeStyle = ramp.rimHex;

  if (hEdge && vEdge && diag) {
    // Solid fill
    ctx.fillRect(qx, qy, 8, 8);
  } else if (hEdge && vEdge && !diag) {
    // Inner concave corner: full with 1px notch on outer diagonal
    ctx.fillRect(qx, qy, 8, 8);
    ctx.fillStyle = ramp.rimHex;
    const nx = (quadrantIndex & 1) === 0 ? qx : qx + 7;
    const ny = (quadrantIndex & 2) === 0 ? qy : qy + 7;
    ctx.fillRect(nx, ny, 1, 1);
  } else if (!hEdge && !vEdge) {
    // Empty: no material
  } else {
    // Orthogonal edge or outer convex corner
    ctx.fillRect(qx + 1, qy + 1, 6, 6);
    ctx.strokeRect(qx + 0.5, qy + 0.5, 7, 7);
  }
}

/**
 * Computes the 8-neighbor bitmask for cell (x, y) on a toroidal 256x256 grid.
 */
export function getToroidal8NeighborBitmask(
  grid: Uint8Array,
  x: number,
  y: number,
  targetValue: number
): number {
  const xM = (x - 1) & 255, xP = (x + 1) & 255;
  const yM = (y - 1) & 255, yP = (y + 1) & 255;
  const y0 = y << 8, ym0 = yM << 8, yp0 = yP << 8;

  let mask = 0;
  if (grid[ym0 + xM] === targetValue) mask |= BIT_NW;
  if (grid[ym0 + x]  === targetValue) mask |= BIT_N;
  if (grid[ym0 + xP] === targetValue) mask |= BIT_NE;
  if (grid[y0  + xM] === targetValue) mask |= BIT_W;
  if (grid[y0  + xP] === targetValue) mask |= BIT_E;
  if (grid[yp0 + xM] === targetValue) mask |= BIT_SW;
  if (grid[yp0 + x]  === targetValue) mask |= BIT_S;
  if (grid[yp0 + xP] === targetValue) mask |= BIT_SE;
  return mask;
}
