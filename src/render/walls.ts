/**
 * src/render/walls.ts
 * Architectural blueprint cutaway rendering for Phase 5f stone huts and closed rooms.
 */

import { PALETTE } from './palette';

// NESW Cardinal Neighbor bits for 16-tile wall connection
export const WALL_N = 1;
export const WALL_E = 2;
export const WALL_S = 4;
export const WALL_W = 8;

export function getWallBitmask(structure: Uint8Array, x: number, y: number): number {
  const xM = (x - 1) & 255, xP = (x + 1) & 255;
  const yM = (y - 1) & 255, yP = (y + 1) & 255;
  let mask = 0;
  if (structure[(yM << 8) | x] > 0) mask |= WALL_N;
  if (structure[(y  << 8) | xP] > 0) mask |= WALL_E;
  if (structure[(yP << 8) | x] > 0) mask |= WALL_S;
  if (structure[(y  << 8) | xM] > 0) mask |= WALL_W;
  return mask;
}

/**
 * Builds a fast spatial occupancy mask from world feature positions (kind 8..11 = stone huts/walls).
 * Reuses a single preallocated Uint8Array to avoid per-frame GC.
 */
export function populateWallSpatialMask(
  featurePositions: Uint8Array | undefined,
  outMask: Uint8Array
): void {
  outMask.fill(0);
  if (!featurePositions) return;
  for (let i = 0; i + 2 < featurePositions.length; i += 3) {
    const kind = featurePositions[i + 2];
    if (kind >= 8 && kind < 12) {
      const x = featurePositions[i];
      const y = featurePositions[i + 1];
      outMask[(y << 8) | x] = 1;
    }
  }
}

/**
 * Draws a 1-cell thick top-down architectural stone wall with interior floor drop shadow.
 */
export function drawCutawayWall(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  cs: number,
  mask: number
): void {
  const p = PALETTE.stoneWall;

  // 1. Solid wall core filling the 16x16 cell
  ctx.fillStyle = p.baseHex;
  ctx.fillRect(px, py, cs, cs);

  // 2. Chiseled block seams & North/West highlight rim
  ctx.strokeStyle = p.highlightHex;
  ctx.lineWidth = 1;
  ctx.strokeRect(px + 0.5, py + 0.5, cs - 1, cs - 1);

  // 3. 1px Cast shadow on South and East boundaries into interior floor
  ctx.fillStyle = p.rimHex;
  if (!(mask & WALL_S)) ctx.fillRect(px, py + cs - 2, cs, 2);
  if (!(mask & WALL_E)) ctx.fillRect(px + cs - 2, py, 2, cs);
}
