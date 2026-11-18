/**
 * WorldBox-style procedural sprite atlas generator.
 *
 * Generates all stick figures, tree variants, and visual indicators directly in code
 * onto an offscreen canvas at startup. Avoids external image assets and keeps pixel
 * art 100% crisp and reproducible.
 */

import { paletteHex } from './limited-palette';
import { createPersonSpritePalette, PERSON_SPRITE_MAPS } from './person-sprites';

export interface SpriteRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly anchorX: number; // Pivot offset from top-left (e.g. feet center)
  readonly anchorY: number;
}

export type SpriteKey =
  | `person_${'male' | 'female' | 'pregnant' | 'child' | 'elder' | 'starving'}_${(typeof PERSON_FRAMES)[number]}`
  | 'person_male_idle'
  | 'person_male_walk_0'
  | 'person_male_walk_1'
  | 'person_female_idle'
  | 'person_female_walk_0'
  | 'person_female_walk_1'
  | 'person_pregnant_idle'
  | 'person_pregnant_walk_0'
  | 'person_pregnant_walk_1'
  | 'person_child_idle'
  | 'person_child_walk_0'
  | 'person_child_walk_1'
  | 'person_elder_idle'
  | 'person_elder_walk_0'
  | 'person_elder_walk_1'
  | 'person_starving_idle'
  | 'person_starving_walk_0'
  | 'person_starving_walk_1'
  | 'tree_oak'
  | 'tree_pine'
  | 'tree_fruit'
  | 'selector_chevron'
  | 'selector_ring'
  | 'star_leader';

export interface SpriteAtlas {
  readonly canvas: HTMLCanvasElement;
  readonly sprites: Record<string, SpriteRect>;
  readonly buffer: PixelBuffer;
  getSprite(key: SpriteKey): SpriteRect;
}

/**
 * Procedural pixel painter writing directly into an ImageData buffer.
 */
export class PixelBuffer {
  public readonly width: number;
  public readonly height: number;
  public readonly data: Uint32Array;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.data = new Uint32Array(width * height);
  }

  public setPixel(x: number, y: number, colorABGR: number): void {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      this.data[y * this.width + x] = colorABGR;
    }
  }

  public fillRect(rx: number, ry: number, rw: number, rh: number, colorABGR: number): void {
    for (let y = ry; y < ry + rh; y++) {
      for (let x = rx; x < rx + rw; x++) {
        this.setPixel(x, y, colorABGR);
      }
    }
  }
}

// Convert CSS Hex '#RRGGBB' to 32-bit ABGR uint for little-endian pixel buffers
/** A `#rrggbb` colour as 0xAABBGGRR, moved into the limited palette when it is on (limited-palette.ts). */
export function hexToABGR(hex: string, alpha = 255): number {
  const clean = paletteHex(hex.startsWith('#') ? hex : `#${hex}`).replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return ((alpha & 0xff) << 24) | ((b & 0xff) << 16) | ((g & 0xff) << 8) | (r & 0xff);
}

// Foliage & Bark Palette
const BARK_OAK = hexToABGR('#78350f');
const BARK_OAK_DARK = hexToABGR('#451a03');

const LEAF_DARK = hexToABGR('#1b4332');
const LEAF_MID = hexToABGR('#2d6a4f');
const LEAF_LIGHT = hexToABGR('#40916c');
const LEAF_HIGHLIGHT = hexToABGR('#74c69d');

const PINE_DARK = hexToABGR('#064e3b');
const PINE_MID = hexToABGR('#047857');
const PINE_LIGHT = hexToABGR('#10b981');

const FRUIT_RED = hexToABGR('#ef4444');
const GOLD_ACCENT = hexToABGR('#facc15');

// Oblique (3/4 top-down) painting: light from the north-west, so highlights sit on upper-left
// faces, shade on right and bottom faces, and a soft shadow falls south-east on the ground.
const GROUND_SHADOW = hexToABGR('#1a1208', 72);
const BARK_LIGHT = hexToABGR('#9a5a22');
const LEAF_HI_PINE = hexToABGR('#34d399');
const OUTLINE = hexToABGR('#141824');

/** Paints a character map (one char per art pixel, '.' is transparent) through a palette. */
function paintMap(
  buf: PixelBuffer,
  ox: number,
  oy: number,
  rows: readonly string[],
  palette: Readonly<Record<string, number>>
): void {
  for (let y = 0; y < rows.length; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const c = palette[row[x]];
      if (c !== undefined) buf.setPixel(ox + x, oy + y, c);
    }
  }
}

/**
 * Person frames in the atlas, per type. 0 to 2 are standing and walking; 3 to 7 are the activity
 * poses (Watchability #3b), all drawn facing right (the renderer mirrors them for facing left).
 */
export const PERSON_FRAMES = ['idle', 'walk_0', 'walk_1', 'bend', 'kneel', 'strike', 'sit', 'hold'] as const;
export type PersonFrame = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
export const POSE_BEND = 3; // grazing, gathering, tending a heap, building
export const POSE_KNEEL = 4; // drinking, fishing
export const POSE_STRIKE = 5; // hunting, fighting
export const POSE_SIT = 6; // resting in shelter
export const POSE_HOLD = 7; // nursing: a swaddled baby at the chest

/** Trunk and ground shadow shared by the tree sprites (12x14, base on row 13). */
const TREE_PALETTE_BASE = {
  k: BARK_LIGHT,
  T: BARK_OAK,
  t: BARK_OAK_DARK,
  o: OUTLINE,
};

/** Front view of a broadleaf tree: round canopy lit top-left and shaded bottom-right, trunk below. */
function drawOakTree(buf: PixelBuffer, ox: number, oy: number): void {
  // Soft shadow on the ground to the south-east of the trunk
  buf.fillRect(ox + 4, oy + 12, 7, 1, GROUND_SHADOW);
  buf.fillRect(ox + 3, oy + 13, 9, 1, GROUND_SHADOW);
  buf.fillRect(ox + 6, oy + 14, 5, 1, GROUND_SHADOW);
  paintMap(
    buf, ox, oy,
    [
      '...HLLLL....',
      '..HHLLLLMM..',
      '.HHLLLLLMMM.',
      '.HLLLLLMMMMD',
      'HLLLLLMMMMDo',
      'LLLLMMMMMDDo',
      'LLLMMMMMMDDo',
      '.LMMMMMMDDDo',
      '.MMMMDDDDDo.',
      '..oooooooo..',
      '....okTo....',
      '....okTo....',
      '...okkTto...',
      '...ooTTto...',
    ],
    { ...TREE_PALETTE_BASE, H: LEAF_HIGHLIGHT, L: LEAF_LIGHT, M: LEAF_MID, D: LEAF_DARK }
  );
  // A few leaf flecks so the canopy is not flat
  buf.setPixel(ox + 5, oy + 3, LEAF_HIGHLIGHT);
  buf.setPixel(ox + 8, oy + 5, LEAF_LIGHT);
  buf.setPixel(ox + 3, oy + 7, LEAF_MID);
}

/** Front view of a conifer: stacked tiers, lit on the left, shaded on the right. */
function drawPineTree(buf: PixelBuffer, ox: number, oy: number): void {
  buf.fillRect(ox + 4, oy + 12, 7, 1, GROUND_SHADOW);
  buf.fillRect(ox + 3, oy + 13, 9, 1, GROUND_SHADOW);
  buf.fillRect(ox + 6, oy + 14, 5, 1, GROUND_SHADOW);
  paintMap(
    buf, ox, oy,
    [
      '.....HL.....',
      '....HLLM....',
      '...HLLMMo...',
      '....LLMMD...',
      '...HLLMMMo..',
      '..HLLMMMMDo.',
      '....LLMMMD..',
      '..HLLMMMMDo.',
      '.HLLLMMMMDDo',
      'HLLLMMMMMMDo',
      '..oooooooo..',
      '....okTo....',
      '...okkTto...',
      '...ooTTto...',
    ],
    { ...TREE_PALETTE_BASE, H: LEAF_HI_PINE, L: PINE_LIGHT, M: PINE_MID, D: PINE_DARK }
  );
}

function drawFruitTree(buf: PixelBuffer, ox: number, oy: number): void {
  drawOakTree(buf, ox, oy);
  buf.setPixel(ox + 3, oy + 4, FRUIT_RED);
  buf.setPixel(ox + 7, oy + 3, FRUIT_RED);
  buf.setPixel(ox + 5, oy + 6, FRUIT_RED);
  buf.setPixel(ox + 8, oy + 6, FRUIT_RED);
  buf.setPixel(ox + 7, oy + 7, hexToABGR('#b02a2a')); // one in the shade
}

/**
 * Draws selection indicators (golden chevron and ring).
 */
function drawSelector(buf: PixelBuffer, ox: number, oy: number): void {
  // 8x8 Chevron
  buf.setPixel(ox + 4, oy + 6, GOLD_ACCENT);
  buf.fillRect(ox + 3, oy + 5, 3, 1, GOLD_ACCENT);
  buf.fillRect(ox + 2, oy + 4, 5, 1, GOLD_ACCENT);
  buf.fillRect(ox + 1, oy + 3, 2, 1, GOLD_ACCENT);
  buf.fillRect(ox + 6, oy + 3, 2, 1, GOLD_ACCENT);
  buf.fillRect(ox + 0, oy + 2, 2, 1, GOLD_ACCENT);
  buf.fillRect(ox + 7, oy + 2, 2, 1, GOLD_ACCENT);
}

/**
 * 7x7 Golden Star for band leaders.
 */
function drawLeaderStar(buf: PixelBuffer, ox: number, oy: number): void {
  const core = hexToABGR('#fffbeb'); // brilliant yellow-white center highlight
  const gold = hexToABGR('#facc15'); // vibrant gold body
  const edge = hexToABGR('#b45309'); // warm amber edge/shadow

  // Row 0: Top point
  buf.setPixel(ox + 3, oy + 0, edge);
  // Row 1: Top taper
  buf.setPixel(ox + 3, oy + 1, gold);
  // Row 2: Horizontal arms
  buf.setPixel(ox + 0, oy + 2, edge);
  buf.fillRect(ox + 1, oy + 2, 5, 1, gold);
  buf.setPixel(ox + 6, oy + 2, edge);
  // Row 3: Star waist and shining center
  buf.setPixel(ox + 1, oy + 3, edge);
  buf.setPixel(ox + 2, oy + 3, gold);
  buf.setPixel(ox + 3, oy + 3, core);
  buf.setPixel(ox + 4, oy + 3, gold);
  buf.setPixel(ox + 5, oy + 3, edge);
  // Row 4: Star belly
  buf.fillRect(ox + 2, oy + 4, 3, 1, gold);
  // Row 5: Lower legs
  buf.setPixel(ox + 1, oy + 5, gold);
  buf.setPixel(ox + 2, oy + 5, edge);
  buf.setPixel(ox + 4, oy + 5, edge);
  buf.setPixel(ox + 5, oy + 5, gold);
  // Row 6: Feet tips
  buf.setPixel(ox + 0, oy + 6, edge);
  buf.setPixel(ox + 1, oy + 6, edge);
  buf.setPixel(ox + 5, oy + 6, edge);
  buf.setPixel(ox + 6, oy + 6, edge);
}

/**
 * Factory to generate the WorldBox procedural SpriteAtlas.
 */
export function createWorldBoxSpriteAtlas(): SpriteAtlas {
  const atlasWidth = 128;
  const atlasHeight = 128;
  const pBuf = new PixelBuffer(atlasWidth, atlasHeight);
  const sprites: Record<string, SpriteRect> = {};

  const personTypes = ['male', 'female', 'pregnant', 'child', 'elder', 'starving'] as const;
  const personPalette = createPersonSpritePalette(hexToABGR);

  // Grid layout: 8x10 person sprites spaced by 12x12 slots
  let curX = 0;
  let curY = 0;

  for (let t = 0; t < personTypes.length; t++) {
    const pType = personTypes[t];
    for (let f = 0; f < PERSON_FRAMES.length; f++) {
      const key = `person_${pType}_${PERSON_FRAMES[f]}` as SpriteKey;
      paintMap(pBuf, curX, curY, PERSON_SPRITE_MAPS[key], personPalette);

      sprites[key] = {
        x: curX,
        y: curY,
        w: 12,
        h: 12,
        anchorX: 6,
        anchorY: 10,
      };

      curX += 12;
      if (curX + 12 > atlasWidth) {
        curX = 0;
        curY += 12;
      }
    }
  }

  // Next row for trees (16x16 slots)
  curX = 0;
  curY = Math.ceil(curY / 16) * 16 + 16;

  // Tree: Oak
  drawOakTree(pBuf, curX + 2, curY + 1);
  sprites['tree_oak'] = {
    x: curX,
    y: curY,
    w: 16,
    h: 16,
    anchorX: 8,
    anchorY: 15,
  };
  curX += 16;

  // Tree: Pine
  drawPineTree(pBuf, curX + 2, curY + 1);
  sprites['tree_pine'] = {
    x: curX,
    y: curY,
    w: 16,
    h: 16,
    anchorX: 8,
    anchorY: 15,
  };
  curX += 16;

  // Tree: Fruit
  drawFruitTree(pBuf, curX + 2, curY + 1);
  sprites['tree_fruit'] = {
    x: curX,
    y: curY,
    w: 16,
    h: 16,
    anchorX: 8,
    anchorY: 15,
  };
  curX += 16;

  // Selector Chevron
  drawSelector(pBuf, curX + 4, curY + 4);
  sprites['selector_chevron'] = {
    x: curX,
    y: curY,
    w: 16,
    h: 16,
    anchorX: 8,
    anchorY: 8,
  };
  curX += 16;

  // Leader Star
  drawLeaderStar(pBuf, curX + 4, curY + 4);
  sprites['star_leader'] = {
    x: curX,
    y: curY,
    w: 16,
    h: 16,
    anchorX: 8,
    anchorY: 8,
  };

  // Convert PixelBuffer to an HTMLCanvasElement
  let canvas: HTMLCanvasElement;
  if (typeof document !== 'undefined') {
    canvas = document.createElement('canvas');
    canvas.width = atlasWidth;
    canvas.height = atlasHeight;
    const ctx = canvas.getContext('2d')!;
    const imgData = ctx.createImageData(atlasWidth, atlasHeight);
    const data32 = new Uint32Array(imgData.data.buffer);
    data32.set(pBuf.data);
    ctx.putImageData(imgData, 0, 0);
  } else {
    // Headless / mock fallback for server/testing environments
    canvas = {
      width: atlasWidth,
      height: atlasHeight,
    } as any;
  }

  return {
    canvas,
    sprites,
    buffer: pBuf,
    getSprite(k: SpriteKey): SpriteRect {
      return sprites[k] ?? sprites['person_male_idle'];
    },
  };
}
