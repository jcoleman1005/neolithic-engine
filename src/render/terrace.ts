/**
 * src/render/terrace.ts
 * Quantizes continuous elevation into discrete topological tiers and generates 1-2px bluff drop shadows.
 */

export const TERRACE_TIER_COUNT = 6;

// Normalized elevation thresholds for the 6 tiers (0..1)
export const TERRACE_THRESHOLDS = new Float32Array([
  0.27, // Tier 0: Deep Water
  0.39, // Tier 1: Shore / Sand
  0.59, // Tier 2: Lowland Meadow
  0.73, // Tier 3: Highland Steppe
  0.87, // Tier 4: Bare Rock Crags
  1.00, // Tier 5: Glacial Snow
]);

export function quantizeElevation01(elev01: number): number {
  for (let t = 0; t < TERRACE_TIER_COUNT; t++) {
    if (elev01 <= TERRACE_THRESHOLDS[t]) return t;
  }
  return TERRACE_TIER_COUNT - 1;
}

export interface TerraceData {
  readonly tiers: Uint8Array;       // 65536 bytes: discrete tier (0..5) per cell
  readonly shadowMask: Uint8Array;  // 65536 bytes: bitflags (1 = South shadow, 2 = East shadow, 4 = Crest rim)
}

export function createTerraceData(): TerraceData {
  return {
    tiers: new Uint8Array(65536),
    shadowMask: new Uint8Array(65536),
  };
}

/**
 * Recomputes terrace tiers and hard bluff drop-shadow edges from raw elevation.
 * Runs once at world load or when terrain re-generates.
 */
export function buildTerraces(rawElevation: Uint16Array, out: TerraceData): void {
  const { tiers, shadowMask } = out;
  shadowMask.fill(0);

  // 1. Quantize each cell
  for (let i = 0; i < 65536; i++) {
    tiers[i] = quantizeElevation01(rawElevation[i] / 65535);
  }

  // 2. Identify South and East bluff drop shadows and North/West rims
  for (let y = 0; y < 256; y++) {
    const yPrev = (y - 1) & 255;
    const yNext = (y + 1) & 255;
    const r0 = y << 8;
    const rPrev = yPrev << 8;
    const rNext = yNext << 8;

    for (let x = 0; x < 256; x++) {
      const xPrev = (x - 1) & 255;
      const xNext = (x + 1) & 255;
      const idx = r0 + x;
      const myTier = tiers[idx];

      // A higher tier to the North or West casts a drop shadow onto this lower cell
      let flags = 0;
      if (tiers[rPrev + x] > myTier) flags |= 1; // South-facing drop shadow falling from above
      if (tiers[r0 + xPrev] > myTier) flags |= 2; // East-facing drop shadow falling from left
      if (tiers[rNext + x] < myTier || tiers[r0 + xNext] < myTier) flags |= 4; // Sharp crest rim

      shadowMask[idx] = flags;
    }
  }
}
