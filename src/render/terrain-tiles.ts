/**
 * src/render/terrain-tiles.ts
 * Dwarf Fortress Steam-Style 8x8 Pixel-Art Terrain Tileset.
 * Generates an 8x8 procedural tile atlas containing 4 organic variants for every biome,
 * stepped z-level cliff strata faces, and shore foam fringes.
 */

import { PixelBuffer, hexToABGR } from './sprites';
import {
  type TerrainTheme,
  type MaterialRamp,
  getPaletteForTheme,
} from './palette';

export const T_GRASS = 0;
export const T_DIRT = 1;
export const T_SAND = 2;
export const T_SHALLOWS = 3;
export const T_OCEAN = 4;
export const T_ROCK = 5;
export const T_SNOW = 6;

export const CLIFF_S = 0;
export const CLIFF_E = 1;
export const CLIFF_W = 2;
export const CLIFF_SE = 3;
export const CLIFF_SW = 4;

export const FOAM_N = 0;
export const FOAM_S = 1;
export const FOAM_W = 2;
export const FOAM_E = 3;

export interface TerrainAtlas {
  readonly canvas: HTMLCanvasElement;
  readonly theme: TerrainTheme;
  getTileX(kind: number, variant?: number): number;
  getTileY(kind: number, variant?: number): number;
  getCliffX(cliffKind: number): number;
  getCliffY(cliffKind?: number): number;
  getFoamX(edge: number): number;
  getFoamY(edge?: number): number;
  /** 6b-1: transparent dry-ground marks drawn over grass: dryness 2 (straw stubble) or 3 (withered, cracked). */
  getDryX(dryness: number, variant: number): number;
  getDryY(): number;
}

const TILE_SIZE = 8;
const ATLAS_W = 64; // 8 tiles across
const ATLAS_H = 64; // 8 rows down

// Accent colors
const COL_FLOWER_YELLOW = hexToABGR('#facc15');
const COL_FLOWER_GOLD   = hexToABGR('#eab308');
const COL_FLOWER_WHITE  = hexToABGR('#f8fafc');
const COL_QUARTZ        = hexToABGR('#f1f5f9');
const COL_FOAM          = hexToABGR('#dbeafe', 220);
const COL_FOAM_SPARKLE  = hexToABGR('#ffffff', 240);
const COL_SHADOW_DEEP   = hexToABGR('#141824', 160);

export function createTerrainAtlas(theme: TerrainTheme = 'classic'): TerrainAtlas {
  const pal = getPaletteForTheme(theme);
  const buf = new PixelBuffer(ATLAS_W, ATLAS_H);

  // Helper to draw an 8x8 tile into the buffer
  const at = (col: number, row: number) => ({ ox: col * TILE_SIZE, oy: row * TILE_SIZE });

  // 1. GRASS TILES (Row 0: 4 variants)
  drawGrassVariants(buf, at(0, 0).ox, at(0, 0).oy, pal.grass, pal.soil);

  // 2. DIRT / LOAM TILES (Row 0, cols 4-7: 4 variants)
  drawDirtVariants(buf, at(4, 0).ox, at(4, 0).oy, pal.soil, pal.rock);

  // 3. SAND TILES (Row 1, cols 0-3: 4 variants)
  drawSandVariants(buf, at(0, 1).ox, at(0, 1).oy, pal.sand);

  // 4. SHALLOW WATER TILES (Row 1, cols 4-7: 4 variants)
  drawShallowsVariants(buf, at(4, 1).ox, at(4, 1).oy, pal.shallowWater, pal.sand);

  // 5. OCEAN TILES (Row 2, cols 0-3: 4 variants)
  drawOceanVariants(buf, at(0, 2).ox, at(0, 2).oy, pal.deepWater);

  // 6. ROCK / MOUNTAIN TILES (Row 2, cols 4-7: 4 variants)
  drawRockVariants(buf, at(4, 2).ox, at(4, 2).oy, pal.rock);

  // 7. SNOW TILES (Row 3, cols 0-3: 4 variants)
  drawSnowVariants(buf, at(0, 3).ox, at(0, 3).oy, pal.snow, pal.rock);

  // 8. CLIFF FACES (Row 4: S, E, W, SE, SW)
  drawCliffFaces(buf, at(0, 4).ox, at(0, 4).oy, pal.rock);

  // 9. SHORE FOAM (Row 5: N, S, W, E)
  drawShoreFoams(buf, at(0, 5).ox, at(0, 5).oy);

  // 10. DRY GROUND MARKS (Row 6: stubble x2, cracked dead grass x2), transparent elsewhere
  drawDryMarks(buf, at(0, 6).ox, at(0, 6).oy);

  let canvas: HTMLCanvasElement;
  if (typeof document !== 'undefined') {
    canvas = document.createElement('canvas');
    canvas.width = ATLAS_W;
    canvas.height = ATLAS_H;
    const ctx = canvas.getContext('2d')!;
    const imgData = ctx.createImageData(ATLAS_W, ATLAS_H);
    const data32 = new Uint32Array(imgData.data.buffer);
    data32.set(buf.data);
    ctx.putImageData(imgData, 0, 0);
  } else {
    canvas = { width: ATLAS_W, height: ATLAS_H } as unknown as HTMLCanvasElement;
  }

  return {
    canvas,
    theme,
    getTileX(kind: number, variant: number): number {
      const v = variant & 3;
      switch (kind) {
        case T_GRASS:    return v * TILE_SIZE;
        case T_DIRT:     return (4 + v) * TILE_SIZE;
        case T_SAND:     return v * TILE_SIZE;
        case T_SHALLOWS: return (4 + v) * TILE_SIZE;
        case T_OCEAN:    return v * TILE_SIZE;
        case T_ROCK:     return (4 + v) * TILE_SIZE;
        case T_SNOW:     return v * TILE_SIZE;
        default:         return 0;
      }
    },
    getTileY(kind: number): number {
      switch (kind) {
        case T_GRASS:
        case T_DIRT:     return 0;
        case T_SAND:
        case T_SHALLOWS: return TILE_SIZE;
        case T_OCEAN:
        case T_ROCK:     return TILE_SIZE * 2;
        case T_SNOW:     return TILE_SIZE * 3;
        default:         return 0;
      }
    },
    getCliffX(cliffKind: number): number {
      return (cliffKind % 8) * TILE_SIZE;
    },
    getCliffY(): number {
      return TILE_SIZE * 4;
    },
    getFoamX(edge: number): number {
      return (edge % 8) * TILE_SIZE;
    },
    getFoamY(): number {
      return TILE_SIZE * 5;
    },
    getDryX(dryness: number, variant: number): number {
      return ((dryness >= 3 ? 2 : 0) + (variant & 1)) * TILE_SIZE;
    },
    getDryY(): number {
      return TILE_SIZE * 6;
    },
  };
}

// -------------------------------------------------------------
// BIOME DRAW ROUTINES (4 organic variants per biome)
// -------------------------------------------------------------

function drawGrassVariants(buf: PixelBuffer, startX: number, startY: number, g: MaterialRamp, soil: MaterialRamp): void {
  // Variant 0: Completely flat, tranquil base turf for maximum figure readability
  let ox = startX;
  buf.fillRect(ox, startY, 8, 8, g.base);

  // Variant 1: Rare meadow with subtle wildflower accent
  ox = startX + TILE_SIZE;
  buf.fillRect(ox, startY, 8, 8, g.base);
  buf.setPixel(ox + 3, startY + 3, COL_FLOWER_GOLD);
  buf.setPixel(ox + 4, startY + 3, COL_FLOWER_YELLOW);
  buf.setPixel(ox + 3, startY + 4, g.shadow);

  // Variant 2: Rare natural earth clod peeking through turf
  ox = startX + TILE_SIZE * 2;
  buf.fillRect(ox, startY, 8, 8, g.base);
  buf.fillRect(ox + 3, startY + 3, 2, 2, soil.base);
  buf.setPixel(ox + 4, startY + 4, soil.shadow);

  // Variant 3: Rare subtle blade tuft clump
  ox = startX + TILE_SIZE * 3;
  buf.fillRect(ox, startY, 8, 8, g.base);
  buf.fillRect(ox + 3, startY + 3, 1, 2, g.highlight);
  buf.fillRect(ox + 4, startY + 4, 1, 1, g.shadow);
}

function drawDirtVariants(buf: PixelBuffer, startX: number, startY: number, s: MaterialRamp, rock: MaterialRamp): void {
  // Variant 0: Crumb loam texture
  let ox = startX;
  buf.fillRect(ox, startY, 8, 8, s.base);
  buf.fillRect(ox + 2, startY + 2, 2, 1, s.highlight);
  buf.fillRect(ox + 4, startY + 5, 2, 1, s.shadow);

  // Variant 1: Embedded pebbles
  ox = startX + TILE_SIZE;
  buf.fillRect(ox, startY, 8, 8, s.base);
  buf.fillRect(ox + 3, startY + 3, 2, 1, rock.highlight);
  buf.setPixel(ox + 4, startY + 4, rock.shadow);

  // Variant 2: Dry earth settling fissure
  ox = startX + TILE_SIZE * 2;
  buf.fillRect(ox, startY, 8, 8, s.base);
  buf.fillRect(ox + 2, startY + 3, 4, 1, s.shadow);
  buf.fillRect(ox + 3, startY + 4, 3, 1, s.rim);

  // Variant 3: Trodden path sod
  ox = startX + TILE_SIZE * 3;
  buf.fillRect(ox, startY, 8, 8, s.base);
  buf.fillRect(ox + 1, startY + 2, 6, 4, s.shadow);
  buf.fillRect(ox + 2, startY + 3, 4, 2, s.rim);
}

function drawSandVariants(buf: PixelBuffer, startX: number, startY: number, s: MaterialRamp): void {
  // Variant 0: Fine warm dune sand with soft cohesive wind-drift band
  let ox = startX;
  buf.fillRect(ox, startY, 8, 8, s.base);
  buf.fillRect(ox + 2, startY + 3, 3, 1, s.highlight);
  buf.fillRect(ox + 3, startY + 4, 3, 1, s.shadow);

  // Variant 1: Soft shell / pebble accent
  ox = startX + TILE_SIZE;
  buf.fillRect(ox, startY, 8, 8, s.base);
  buf.fillRect(ox + 3, startY + 3, 2, 1, s.highlight);
  buf.setPixel(ox + 4, startY + 4, s.shadow);

  // Variant 2: Wind ripple dunes
  ox = startX + TILE_SIZE * 2;
  buf.fillRect(ox, startY, 8, 8, s.base);
  buf.fillRect(ox + 1, startY + 2, 5, 1, s.highlight);
  buf.fillRect(ox + 2, startY + 3, 5, 1, s.shadow);

  // Variant 3: Damp darker shoreline sand
  ox = startX + TILE_SIZE * 3;
  buf.fillRect(ox, startY, 8, 8, s.shadow);
  buf.fillRect(ox + 2, startY + 2, 4, 3, s.base);
}

function drawShallowsVariants(buf: PixelBuffer, startX: number, startY: number, w: MaterialRamp, sand: MaterialRamp): void {
  // Variant 0: Clean tranquil shallows (dominant 94%)
  let ox = startX;
  buf.fillRect(ox, startY, 8, 8, w.base);

  // Variant 1: Gentle calm swell ripple (rare accent)
  ox = startX + TILE_SIZE;
  buf.fillRect(ox, startY, 8, 8, w.base);
  buf.fillRect(ox + 2, startY + 3, 4, 1, w.highlight);
  buf.fillRect(ox + 2, startY + 4, 4, 1, w.shadow);

  // Variant 2: Clear water over subtle shallow bed (rare accent)
  ox = startX + TILE_SIZE * 2;
  buf.fillRect(ox, startY, 8, 8, w.base);
  buf.fillRect(ox + 2, startY + 3, 3, 1, sand.shadow);

  // Variant 3: Soft horizontal water shimmer (rare accent)
  ox = startX + TILE_SIZE * 3;
  buf.fillRect(ox, startY, 8, 8, w.base);
  buf.fillRect(ox + 1, startY + 2, 3, 1, w.highlight);
  buf.fillRect(ox + 4, startY + 5, 3, 1, w.highlight);
}

function drawOceanVariants(buf: PixelBuffer, startX: number, startY: number, d: MaterialRamp): void {
  // Variant 0: Clean deep tranquil ocean (dominant 94%)
  let ox = startX;
  buf.fillRect(ox, startY, 8, 8, d.base);

  // Variant 1: Soft oceanic swell (rare accent)
  ox = startX + TILE_SIZE;
  buf.fillRect(ox, startY, 8, 8, d.base);
  buf.fillRect(ox + 1, startY + 3, 5, 1, d.highlight);
  buf.fillRect(ox + 1, startY + 4, 5, 1, d.shadow);

  // Variant 2: Subtle swell contour (rare accent)
  ox = startX + TILE_SIZE * 2;
  buf.fillRect(ox, startY, 8, 8, d.base);
  buf.fillRect(ox + 2, startY + 4, 4, 1, d.highlight);
  buf.fillRect(ox + 2, startY + 5, 4, 1, d.shadow);

  // Variant 3: Deep calm abyss (rare accent)
  ox = startX + TILE_SIZE * 3;
  buf.fillRect(ox, startY, 8, 8, d.shadow);
  buf.fillRect(ox + 2, startY + 2, 4, 4, d.base);
}

function drawRockVariants(buf: PixelBuffer, startX: number, startY: number, r: MaterialRamp): void {
  // Variant 0: Solid unbroken stone floor (dominant 94% - restful, clean hill tops)
  let ox = startX;
  buf.fillRect(ox, startY, 8, 8, r.base);

  // Variant 1: Subtle chiseled joint (rare accent)
  ox = startX + TILE_SIZE;
  buf.fillRect(ox, startY, 8, 8, r.base);
  buf.fillRect(ox + 3, startY + 2, 1, 4, r.shadow);
  buf.setPixel(ox + 2, startY + 2, r.highlight);

  // Variant 2: Subtle vein (rare accent)
  ox = startX + TILE_SIZE * 2;
  buf.fillRect(ox, startY, 8, 8, r.base);
  buf.fillRect(ox + 3, startY + 3, 2, 1, COL_QUARTZ);
  buf.setPixel(ox + 3, startY + 4, r.shadow);

  // Variant 3: Soft stone ledge (rare accent)
  ox = startX + TILE_SIZE * 3;
  buf.fillRect(ox, startY, 8, 8, r.base);
  buf.fillRect(ox + 2, startY + 2, 3, 3, r.highlight);
  buf.fillRect(ox + 4, startY + 4, 2, 2, r.shadow);
}

function drawSnowVariants(buf: PixelBuffer, startX: number, startY: number, s: MaterialRamp, rock: MaterialRamp): void {
  // Variant 0: Soft powdery snow drift
  let ox = startX;
  buf.fillRect(ox, startY, 8, 8, s.base);
  buf.setPixel(ox + 2, startY + 1, s.highlight);
  buf.setPixel(ox + 6, startY + 3, s.highlight);
  buf.setPixel(ox + 3, startY + 6, s.shadow);

  // Variant 1: Wind-carved sastrugi ridge
  ox = startX + TILE_SIZE;
  buf.fillRect(ox, startY, 8, 8, s.base);
  buf.fillRect(ox + 1, startY + 3, 6, 1, s.highlight);
  buf.fillRect(ox + 1, startY + 4, 6, 1, s.shadow);

  // Variant 2: Glacial ice crystal glint
  ox = startX + TILE_SIZE * 2;
  buf.fillRect(ox, startY, 8, 8, s.base);
  buf.setPixel(ox + 3, startY + 2, COL_FLOWER_WHITE);
  buf.setPixel(ox + 4, startY + 3, s.highlight);
  buf.setPixel(ox + 5, startY + 6, s.shadow);

  // Variant 3: Exposed frozen rock rim
  ox = startX + TILE_SIZE * 3;
  buf.fillRect(ox, startY, 8, 8, s.base);
  buf.fillRect(ox + 3, startY + 3, 2, 2, rock.base);
  buf.setPixel(ox + 3, startY + 2, s.highlight);
  buf.setPixel(ox + 4, startY + 5, s.shadow);
}

// -------------------------------------------------------------
// STEPPED Z-LEVEL CLIFF STRATA FACES
// -------------------------------------------------------------

function drawCliffFaces(buf: PixelBuffer, startX: number, startY: number, r: MaterialRamp): void {
  // CLIFF_S: South-facing cliff (horizontal strata with vertical fissures and drop shadow)
  let ox = startX;
  // Lit top lip
  buf.fillRect(ox, startY, 8, 1, r.highlight);
  // Strata body
  buf.fillRect(ox, startY + 1, 8, 1, r.base);
  buf.fillRect(ox, startY + 2, 8, 1, r.shadow);
  buf.fillRect(ox, startY + 3, 8, 1, r.base);
  buf.fillRect(ox, startY + 4, 8, 1, r.shadow);
  buf.fillRect(ox, startY + 5, 8, 1, r.rim);
  // Vertical rock fissures
  buf.setPixel(ox + 2, startY + 2, r.rim);
  buf.setPixel(ox + 2, startY + 3, r.rim);
  buf.setPixel(ox + 5, startY + 3, r.rim);
  buf.setPixel(ox + 5, startY + 4, r.rim);
  // Bottom drop shadow & talus rubble
  buf.fillRect(ox, startY + 6, 8, 2, COL_SHADOW_DEEP);
  buf.setPixel(ox + 2, startY + 6, r.highlight); // talus stone
  buf.setPixel(ox + 6, startY + 7, r.base);

  // CLIFF_E: East-facing cliff (shaded right wall)
  ox = startX + TILE_SIZE;
  buf.fillRect(ox + 5, startY, 3, 8, r.shadow);
  buf.fillRect(ox + 7, startY, 1, 8, r.rim);
  buf.fillRect(ox + 4, startY, 1, 8, r.highlight);
  buf.fillRect(ox + 6, startY + 2, 1, 4, COL_SHADOW_DEEP);

  // CLIFF_W: West-facing cliff (lit left wall)
  ox = startX + TILE_SIZE * 2;
  buf.fillRect(ox, startY, 3, 8, r.base);
  buf.fillRect(ox, startY, 1, 8, r.highlight);
  buf.fillRect(ox + 2, startY, 1, 8, r.shadow);

  // CLIFF_SE: Outer South-East corner junction
  ox = startX + TILE_SIZE * 3;
  buf.fillRect(ox, startY, 8, 8, r.base);
  buf.fillRect(ox, startY, 8, 1, r.highlight);
  buf.fillRect(ox, startY + 1, 8, 5, r.shadow);
  buf.fillRect(ox + 5, startY, 3, 8, r.rim);
  buf.fillRect(ox, startY + 6, 8, 2, COL_SHADOW_DEEP);

  // CLIFF_SW: Outer South-West corner junction
  ox = startX + TILE_SIZE * 4;
  buf.fillRect(ox, startY, 8, 8, r.base);
  buf.fillRect(ox, startY, 8, 1, r.highlight);
  buf.fillRect(ox, startY + 1, 8, 5, r.shadow);
  buf.fillRect(ox, startY, 2, 8, r.highlight);
  buf.fillRect(ox, startY + 6, 8, 2, COL_SHADOW_DEEP);
}

// -------------------------------------------------------------
// SHORELINE FOAM
// -------------------------------------------------------------

function drawShoreFoams(buf: PixelBuffer, startX: number, startY: number): void {
  // FOAM_N: Foam along North shore edge
  let ox = startX;
  buf.fillRect(ox, startY, 8, 2, COL_FOAM);
  buf.setPixel(ox + 1, startY, COL_FOAM_SPARKLE);
  buf.setPixel(ox + 4, startY + 1, COL_FOAM_SPARKLE);
  buf.setPixel(ox + 7, startY, COL_FOAM_SPARKLE);

  // FOAM_S: Foam along South shore edge
  ox = startX + TILE_SIZE;
  buf.fillRect(ox, startY + 6, 8, 2, COL_FOAM);
  buf.setPixel(ox + 2, startY + 7, COL_FOAM_SPARKLE);
  buf.setPixel(ox + 5, startY + 6, COL_FOAM_SPARKLE);

  // FOAM_W: Foam along West shore edge
  ox = startX + TILE_SIZE * 2;
  buf.fillRect(ox, startY, 2, 8, COL_FOAM);
  buf.setPixel(ox, startY + 2, COL_FOAM_SPARKLE);
  buf.setPixel(ox + 1, startY + 5, COL_FOAM_SPARKLE);

  // FOAM_E: Foam along East shore edge
  ox = startX + TILE_SIZE * 3;
  buf.fillRect(ox + 6, startY, 2, 8, COL_FOAM);
  buf.setPixel(ox + 7, startY + 3, COL_FOAM_SPARKLE);
  buf.setPixel(ox + 6, startY + 6, COL_FOAM_SPARKLE);
}

const COL_STRAW_LIGHT = hexToABGR('#e2cf86');
const COL_STRAW_DARK = hexToABGR('#8a7238');
const COL_CRACK = hexToABGR('#4e3720');
const COL_DUST = hexToABGR('#c9a66c');

/** 6b-1: marks for dry ground, lit from the north-west like the rest. Transparent where unmarked. */
function drawDryMarks(buf: PixelBuffer, startX: number, startY: number): void {
  // Stubble A and B: short pale straw strokes with a dark foot, sparse so the tint still reads.
  const stubble = [
    [[1, 1], [5, 2], [2, 5], [6, 6]],
    [[3, 1], [0, 4], [5, 4], [3, 6]],
  ];
  for (let v = 0; v < 2; v++) {
    const ox = startX + v * TILE_SIZE;
    for (const [x, y] of stubble[v]) {
      buf.setPixel(ox + x, startY + y, COL_STRAW_LIGHT);
      buf.setPixel(ox + x, startY + y + 1, COL_STRAW_DARK);
    }
  }
  // Cracked dead ground A and B: a broken dark line across the tile and a fleck of pale dust.
  const cracks = [
    [[0, 2], [1, 2], [2, 3], [3, 3], [4, 3], [4, 4], [5, 5], [6, 5], [4, 6]],
    [[1, 6], [2, 5], [3, 5], [3, 4], [4, 3], [5, 3], [6, 2], [3, 6], [7, 3]],
  ];
  const dust = [[[6, 1]], [[1, 1]]];
  for (let v = 0; v < 2; v++) {
    const ox = startX + (2 + v) * TILE_SIZE;
    for (const [x, y] of cracks[v]) buf.setPixel(ox + x, startY + y, COL_CRACK);
    for (const [x, y] of dust[v]) buf.setPixel(ox + x, startY + y, COL_DUST);
  }
}
