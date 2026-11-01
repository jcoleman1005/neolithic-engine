/**
 * WorldBox-style procedural sprite atlas generator.
 *
 * Generates all stick figures, tree variants, and visual indicators directly in code
 * onto an offscreen canvas at startup. Avoids external image assets and keeps pixel
 * art 100% crisp and reproducible.
 */

export interface SpriteRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly anchorX: number; // Pivot offset from top-left (e.g. feet center)
  readonly anchorY: number;
}

export type SpriteKey =
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
  | 'selector_ring';

export interface SpriteAtlas {
  readonly canvas: HTMLCanvasElement;
  readonly sprites: Record<string, SpriteRect>;
  getSprite(key: SpriteKey): SpriteRect;
}

/**
 * Procedural pixel painter writing directly into an ImageData buffer.
 */
class PixelBuffer {
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
export function hexToABGR(hex: string, alpha = 255): number {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return ((alpha & 0xff) << 24) | ((b & 0xff) << 16) | ((g & 0xff) << 8) | (r & 0xff);
}

// Color Palette Constants (WorldBox aesthetic)
const SKIN = hexToABGR('#f5c69b');
const SKIN_ELDER = hexToABGR('#fde2c7');
const SKIN_PALE = hexToABGR('#fef08a');

const HAIR_BROWN = hexToABGR('#3b2314');
const HAIR_DARK = hexToABGR('#1c1917');
const HAIR_ELDER = hexToABGR('#e2e8f0');

const TUNIC_MALE = hexToABGR('#2563eb');
const TUNIC_MALE_DARK = hexToABGR('#1d4ed8');

const TUNIC_FEMALE = hexToABGR('#e11d48');
const TUNIC_FEMALE_DARK = hexToABGR('#be123c');

const TUNIC_PREGNANT = hexToABGR('#f43f5e');
const BELLY_HIGHLIGHT = hexToABGR('#fda4af');

const TUNIC_CHILD = hexToABGR('#f59e0b');
const TUNIC_CHILD_DARK = hexToABGR('#d97706');

const TUNIC_ELDER = hexToABGR('#64748b');
const TUNIC_ELDER_DARK = hexToABGR('#475569');

const TUNIC_STARVING = hexToABGR('#991b1b');
const TUNIC_STARVING_DARK = hexToABGR('#7f1d1d');

const LEGS_DARK = hexToABGR('#1e293b');

// Foliage & Bark Palette
const BARK_OAK = hexToABGR('#78350f');
const BARK_OAK_DARK = hexToABGR('#451a03');
const BARK_PINE = hexToABGR('#3e2723');

const LEAF_DARK = hexToABGR('#1b4332');
const LEAF_MID = hexToABGR('#2d6a4f');
const LEAF_LIGHT = hexToABGR('#40916c');
const LEAF_HIGHLIGHT = hexToABGR('#74c69d');

const PINE_DARK = hexToABGR('#064e3b');
const PINE_MID = hexToABGR('#047857');
const PINE_LIGHT = hexToABGR('#10b981');

const FRUIT_RED = hexToABGR('#ef4444');
const GOLD_ACCENT = hexToABGR('#facc15');

/**
 * Draws an 8x10 stick figure into the pixel buffer at (ox, oy).
 */
function drawPerson(
  buf: PixelBuffer,
  ox: number,
  oy: number,
  type: 'male' | 'female' | 'pregnant' | 'child' | 'elder' | 'starving',
  walkFrame: 0 | 1 | 2 // 0 = idle, 1 = walk left fwd, 2 = walk right fwd
): void {
  const isChild = type === 'child';
  const isElder = type === 'elder';
  const isPregnant = type === 'pregnant';
  const isStarving = type === 'starving';

  // Skin tone
  const skin = isElder ? SKIN_ELDER : isStarving ? SKIN_PALE : SKIN;

  // Hair color
  const hair = isElder ? HAIR_ELDER : HAIR_BROWN;

  // Tunic colors
  let tunic = TUNIC_MALE;
  let tunicDark = TUNIC_MALE_DARK;
  if (type === 'female') {
    tunic = TUNIC_FEMALE;
    tunicDark = TUNIC_FEMALE_DARK;
  } else if (isPregnant) {
    tunic = TUNIC_PREGNANT;
    tunicDark = TUNIC_FEMALE_DARK;
  } else if (isChild) {
    tunic = TUNIC_CHILD;
    tunicDark = TUNIC_CHILD_DARK;
  } else if (isElder) {
    tunic = TUNIC_ELDER;
    tunicDark = TUNIC_ELDER_DARK;
  } else if (isStarving) {
    tunic = TUNIC_STARVING;
    tunicDark = TUNIC_STARVING_DARK;
  }

  // Children are smaller (offset down 2 pixels)
  const yOff = isChild ? 2 : 0;

  // 1. Head (Hair & Face)
  // Hair cap
  buf.fillRect(ox + 2, oy + yOff + 0, 4, 1, hair);
  buf.setPixel(ox + 2, oy + yOff + 1, hair);
  buf.setPixel(ox + 5, oy + yOff + 1, hair);
  if (type === 'female' || isPregnant) {
    // Longer side locks
    buf.setPixel(ox + 1, oy + yOff + 1, hair);
    buf.setPixel(ox + 1, oy + yOff + 2, hair);
    buf.setPixel(ox + 6, oy + yOff + 1, hair);
    buf.setPixel(ox + 6, oy + yOff + 2, hair);
  }

  // Face
  buf.fillRect(ox + 3, oy + yOff + 1, 2, 2, skin);
  // Eye dot
  buf.setPixel(ox + 4, oy + yOff + 1, HAIR_DARK);

  if (isElder) {
    // Beard
    buf.fillRect(ox + 3, oy + yOff + 3, 2, 1, HAIR_ELDER);
  }

  // 2. Torso (Tunic)
  const torsoY = oy + yOff + 3;
  buf.fillRect(ox + 2, torsoY, 4, 3, tunic);
  // Tunic shadow/belt
  buf.fillRect(ox + 2, torsoY + 2, 4, 1, tunicDark);

  // Arms
  buf.setPixel(ox + 1, torsoY + 1, skin);
  buf.setPixel(ox + 6, torsoY + 1, skin);

  // Pregnant belly bump
  if (isPregnant) {
    buf.fillRect(ox + 5, torsoY + 1, 2, 2, BELLY_HIGHLIGHT);
  }

  // 3. Legs & Walking Animation
  const legY = torsoY + 3;
  if (isChild) {
    // Tiny legs
    buf.setPixel(ox + 3, legY, LEGS_DARK);
    buf.setPixel(ox + 4, legY, LEGS_DARK);
  } else if (walkFrame === 0) {
    // Idle stance
    buf.fillRect(ox + 2, legY, 1, 2, LEGS_DARK);
    buf.fillRect(ox + 5, legY, 1, 2, LEGS_DARK);
  } else if (walkFrame === 1) {
    // Step forward with left leg
    buf.fillRect(ox + 2, legY, 1, 2, LEGS_DARK);
    buf.setPixel(ox + 1, legY + 1, LEGS_DARK);
    buf.fillRect(ox + 5, legY, 1, 1, LEGS_DARK);
  } else {
    // Step forward with right leg
    buf.fillRect(ox + 2, legY, 1, 1, LEGS_DARK);
    buf.fillRect(ox + 5, legY, 1, 2, LEGS_DARK);
    buf.setPixel(ox + 6, legY + 1, LEGS_DARK);
  }
}

/**
 * Draws tree variants into the pixel buffer.
 */
function drawOakTree(buf: PixelBuffer, ox: number, oy: number): void {
  // 12x14 Oak Tree
  // Trunk: rows 8..12
  buf.fillRect(ox + 5, oy + 8, 2, 5, BARK_OAK);
  buf.setPixel(ox + 6, oy + 8, BARK_OAK_DARK);
  buf.setPixel(ox + 6, oy + 10, BARK_OAK_DARK);
  buf.setPixel(ox + 4, oy + 12, BARK_OAK); // root flare
  buf.setPixel(ox + 7, oy + 12, BARK_OAK);

  // Layered foliage (rows 1..8)
  // Base shadow
  buf.fillRect(ox + 2, oy + 6, 8, 3, LEAF_DARK);
  buf.fillRect(ox + 1, oy + 4, 10, 3, LEAF_MID);
  buf.fillRect(ox + 2, oy + 2, 8, 3, LEAF_LIGHT);
  buf.fillRect(ox + 4, oy + 1, 4, 2, LEAF_HIGHLIGHT);

  // Highlights & texture
  buf.setPixel(ox + 3, oy + 2, LEAF_HIGHLIGHT);
  buf.setPixel(ox + 5, oy + 3, LEAF_HIGHLIGHT);
  buf.setPixel(ox + 8, oy + 3, LEAF_LIGHT);
  buf.setPixel(ox + 2, oy + 7, LEAF_DARK);
  buf.setPixel(ox + 9, oy + 7, LEAF_DARK);
}

function drawPineTree(buf: PixelBuffer, ox: number, oy: number): void {
  // 12x14 Pine Tree
  // Trunk: rows 10..12
  buf.fillRect(ox + 5, oy + 10, 2, 3, BARK_PINE);

  // Bottom tier (rows 7..9)
  buf.fillRect(ox + 2, oy + 9, 8, 1, PINE_DARK);
  buf.fillRect(ox + 3, oy + 8, 6, 1, PINE_MID);
  buf.fillRect(ox + 4, oy + 7, 4, 1, PINE_LIGHT);

  // Middle tier (rows 4..6)
  buf.fillRect(ox + 3, oy + 6, 6, 1, PINE_DARK);
  buf.fillRect(ox + 4, oy + 5, 4, 1, PINE_MID);
  buf.fillRect(ox + 5, oy + 4, 2, 1, PINE_LIGHT);

  // Top tier (rows 1..3)
  buf.fillRect(ox + 4, oy + 3, 4, 1, PINE_MID);
  buf.fillRect(ox + 5, oy + 2, 2, 1, PINE_LIGHT);
  buf.setPixel(ox + 5, oy + 1, PINE_LIGHT); // top tip
}

function drawFruitTree(buf: PixelBuffer, ox: number, oy: number): void {
  // Draw base oak
  drawOakTree(buf, ox, oy);

  // Sprinkle red fruit apples
  buf.setPixel(ox + 3, oy + 4, FRUIT_RED);
  buf.setPixel(ox + 7, oy + 3, FRUIT_RED);
  buf.setPixel(ox + 5, oy + 6, FRUIT_RED);
  buf.setPixel(ox + 8, oy + 6, FRUIT_RED);
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
 * Factory to generate the WorldBox procedural SpriteAtlas.
 */
export function createWorldBoxSpriteAtlas(): SpriteAtlas {
  const atlasWidth = 128;
  const atlasHeight = 128;
  const pBuf = new PixelBuffer(atlasWidth, atlasHeight);
  const sprites: Record<string, SpriteRect> = {};

  const personTypes = ['male', 'female', 'pregnant', 'child', 'elder', 'starving'] as const;
  const walkFrames = [0, 1, 2] as const;
  const frameNames = ['idle', 'walk_0', 'walk_1'] as const;

  // Grid layout: 8x10 person sprites spaced by 12x12 slots
  let curX = 0;
  let curY = 0;

  for (let t = 0; t < personTypes.length; t++) {
    const pType = personTypes[t];
    for (let f = 0; f < walkFrames.length; f++) {
      const frame = walkFrames[f];
      const name = frameNames[f];
      const key: SpriteKey = `person_${pType}_${name}` as SpriteKey;

      drawPerson(pBuf, curX + 2, curY + 1, pType, frame);

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
    anchorY: 14,
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
    anchorY: 14,
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
    anchorY: 14,
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
    getSprite(k: SpriteKey): SpriteRect {
      return sprites[k] ?? sprites['person_male_idle'];
    },
  };
}
