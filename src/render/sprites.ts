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
const SKIN_SHADE = hexToABGR('#d9a578');
const FEET = hexToABGR('#3b2a1c');
const GROUND_SHADOW = hexToABGR('#1a1208', 72);
const BARK_LIGHT = hexToABGR('#9a5a22');
const LEAF_HI_PINE = hexToABGR('#34d399');
const OUTLINE = hexToABGR('#141824');
const BELT = hexToABGR('#3a2414');
const BUCKLE = hexToABGR('#d4af37');

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

const SPEAR = hexToABGR('#6b4423');
const SPEAR_TIP = hexToABGR('#cbd5e1');
const SWADDLE = hexToABGR('#efe3c8');

/**
 * Draws an 8x10 front-facing figure (seen from a little above) into the pixel buffer at (ox, oy).
 * The feet end on row 7 and a soft shadow sits on row 8, offset one pixel to the south-east.
 * Frames 0 to 2 are standing and walking; 3 to 7 are poses (see PERSON_FRAMES): bending and
 * kneeling lower and lean the body forward (to the right), sitting lowers it with the legs out in
 * front, striking raises the front arm with a spear, and holding puts a bundle at the chest.
 */
function drawPerson(
  buf: PixelBuffer,
  ox: number,
  oy: number,
  type: 'male' | 'female' | 'pregnant' | 'child' | 'elder' | 'starving',
  frame: PersonFrame
): void {
  const isChild = type === 'child';
  const isElder = type === 'elder';
  const isPregnant = type === 'pregnant';
  const isStarving = type === 'starving';

  const skin = isElder ? SKIN_ELDER : isStarving ? SKIN_PALE : SKIN;
  const hair = isElder ? HAIR_ELDER : HAIR_BROWN;

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

  // Ground shadow first, south-east of the feet (one pixel right, on the row under them)
  buf.fillRect(ox + 2, oy + 8, 6, 1, GROUND_SHADOW);

  // Children are smaller (shifted down 2 pixels, shorter torso) but their feet share the adult baseline
  const yOff = isChild ? 2 : 0;
  // Poses move the head and the body: kneeling and sitting lower both, upright; bending keeps the hips
  // high and bows the head down in front of the body (drawn over it). A child is already short, so it
  // drops at most one row.
  const lowered = frame === POSE_BEND || frame === POSE_KNEEL || frame === POSE_SIT;
  const headDrop = frame === POSE_KNEEL ? 2 : frame === POSE_SIT ? 3 : 0;
  // Bending: the hips stay where they are and the head hangs below them, in front.
  const bodyDrop = frame === POSE_BEND ? 0 : headDrop;
  const hx = ox + (frame === POSE_BEND ? (isChild ? 2 : 3) : 0); // head left edge
  const hy = frame === POSE_BEND ? oy + (isChild ? 4 : 4) : oy + yOff + (isChild ? Math.min(1, headDrop) : headDrop); // head top
  const bx = ox; // body left edge
  const torsoY = oy + yOff + 3 + (isChild ? Math.min(1, bodyDrop) : bodyDrop);
  const torsoH = isChild || lowered ? 2 : 3;

  const drawHead = (): void => {
    // Head: hair on top with crisp boundary, face lit on the left, eye on right
    buf.fillRect(hx + 2, hy + 0, 4, 1, hair);
    buf.setPixel(hx + 1, hy + 0, OUTLINE);
    buf.setPixel(hx + 6, hy + 0, OUTLINE);
    buf.setPixel(hx + 2, hy + 1, hair);
    buf.setPixel(hx + 5, hy + 1, hair);
    if (type === 'female' || isPregnant) {
      buf.setPixel(hx + 1, hy + 1, hair);
      buf.setPixel(hx + 1, hy + 2, hair);
      buf.setPixel(hx + 6, hy + 1, hair);
      buf.setPixel(hx + 6, hy + 2, hair);
    }
    buf.fillRect(hx + 3, hy + 1, 2, 2, skin);
    buf.setPixel(hx + 4, hy + 1, HAIR_DARK); // eye
    if (!isElder && !isStarving) buf.setPixel(hx + 4, hy + 2, SKIN_SHADE);
    buf.setPixel(hx + 2, hy + 2, OUTLINE);
    buf.setPixel(hx + 5, hy + 2, OUTLINE);
    if (isElder) buf.fillRect(hx + 3, hy + 2, 2, 2, HAIR_ELDER); // full beard
  };

  // 1. Head (a bowed head is drawn after the body, in front of it)
  if (frame !== POSE_BEND) drawHead();

  // 2. Torso: lit left, shaded right column, distinct leather belt & buckle. Lowered figures fold to
  // two rows so the feet keep the baseline.
  buf.fillRect(bx + 2, torsoY, 4, torsoH - 1, tunic);
  buf.setPixel(bx + 5, torsoY, tunicDark);
  buf.setPixel(bx + 1, torsoY, OUTLINE);
  buf.setPixel(bx + 6, torsoY, OUTLINE);

  // Arms: left in the light, right (the front) in shade, unless the pose uses the front arm
  buf.setPixel(bx + 1, torsoY + 1, skin);
  const frontArmFree = frame !== POSE_BEND && frame !== POSE_KNEEL && frame !== POSE_STRIKE;
  if (frontArmFree) buf.setPixel(bx + 6, torsoY + 1, SKIN_SHADE);

  // Leather belt & buckle
  buf.fillRect(bx + 2, torsoY + torsoH - 1, 4, 1, BELT);
  buf.setPixel(bx + 3, torsoY + torsoH - 1, BUCKLE);
  buf.setPixel(bx + 1, torsoY + torsoH - 1, OUTLINE);
  buf.setPixel(bx + 6, torsoY + torsoH - 1, OUTLINE);

  if (isPregnant) {
    buf.fillRect(bx + 4, torsoY + 1, 2, 1, BELLY_HIGHLIGHT);
    buf.setPixel(bx + 5, torsoY + 1, tunicDark);
  }

  // 3. Legs and feet (feet on row 7 for every figure)
  const feetY = oy + 7;
  if (isChild) {
    if (frame === POSE_SIT) {
      buf.setPixel(ox + 5, feetY, FEET);
      buf.setPixel(ox + 6, feetY, FEET);
    } else {
      buf.setPixel(ox + 3, feetY, FEET);
      buf.setPixel(ox + 4, feetY, FEET);
    }
  } else if (frame === POSE_KNEEL) {
    // Folded: the shin flat on the ground behind, the front knee up
    buf.fillRect(ox + 1, feetY, 3, 1, LEGS_DARK);
    buf.setPixel(ox + 0, feetY, FEET);
    buf.setPixel(ox + 4, feetY, LEGS_DARK);
  } else if (frame === POSE_SIT) {
    // Legs out in front
    buf.fillRect(ox + 4, feetY, 3, 1, LEGS_DARK);
    buf.setPixel(ox + 7, feetY, FEET);
  } else if (frame === POSE_BEND) {
    // Straight legs under high hips
    buf.setPixel(ox + 2, feetY - 2, LEGS_DARK);
    buf.setPixel(ox + 4, feetY - 2, LEGS_DARK);
    buf.setPixel(ox + 2, feetY - 1, LEGS_DARK);
    buf.setPixel(ox + 4, feetY - 1, LEGS_DARK);
    buf.setPixel(ox + 2, feetY, FEET);
    buf.setPixel(ox + 4, feetY, FEET);
    buf.setPixel(ox + 1, feetY, OUTLINE);
  } else {
    const legY = torsoY + torsoH;
    const stance = frame === POSE_STRIKE ? 1 : frame === POSE_HOLD ? 0 : frame;
    if (stance === 0) {
      buf.setPixel(ox + 2, legY, LEGS_DARK);
      buf.setPixel(ox + 5, legY, LEGS_DARK);
      buf.setPixel(ox + 2, legY + 1, FEET);
      buf.setPixel(ox + 5, legY + 1, FEET);
      buf.setPixel(ox + 1, legY + 1, OUTLINE);
      buf.setPixel(ox + 6, legY + 1, OUTLINE);
    } else if (stance === 1) {
      buf.setPixel(ox + 2, legY, LEGS_DARK);
      buf.setPixel(ox + 2, legY + 1, FEET);
      buf.setPixel(ox + 1, legY + 1, FEET);
      buf.setPixel(ox + 5, legY, FEET);
      buf.setPixel(ox + 0, legY + 1, OUTLINE);
    } else {
      buf.setPixel(ox + 2, legY, FEET);
      buf.setPixel(ox + 5, legY, LEGS_DARK);
      buf.setPixel(ox + 5, legY + 1, FEET);
      buf.setPixel(ox + 6, legY + 1, FEET);
      buf.setPixel(ox + 7, legY + 1, OUTLINE);
    }
  }

  // 4. The front arm for the poses that use it
  if (frame === POSE_BEND) {
    // Bowed head in front of the body, the hand reaching down to the ground under it
    drawHead();
    buf.setPixel(ox + 6, feetY - 1, SKIN_SHADE);
    buf.setPixel(ox + 7, feetY, skin);
  } else if (frame === POSE_KNEEL) {
    // Cupped hand forward and down, at the water's edge
    buf.setPixel(bx + 6, torsoY + 1, SKIN_SHADE);
    buf.setPixel(bx + 7, torsoY + 2, SKIN_SHADE);
    buf.setPixel(bx + 7, feetY, skin);
  } else if (frame === POSE_STRIKE) {
    // Front arm raised, a spear held high with its point forward
    buf.setPixel(bx + 6, torsoY, SKIN_SHADE);
    buf.setPixel(bx + 7, torsoY - 1, skin);
    for (let y = oy - 1 + yOff; y <= torsoY + 1; y++) buf.setPixel(bx + 8, y, SPEAR);
    buf.setPixel(bx + 8, oy - 1 + yOff, SPEAR_TIP);
  } else if (frame === POSE_HOLD) {
    // A swaddled baby across the chest, its face to the front
    buf.fillRect(bx + 3, torsoY + 1, 4, 1, SWADDLE);
    buf.setPixel(bx + 6, torsoY, SKIN);
    buf.setPixel(bx + 7, torsoY + 1, OUTLINE);
  }
}

/** Trunk and ground shadow shared by the tree sprites (12x14, base on row 13). */
const TREE_PALETTE_BASE = {
  k: BARK_LIGHT,
  T: BARK_OAK,
  t: BARK_OAK_DARK,
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
      'HLLLLLMMMMDD',
      'LLLLMMMMMDDD',
      'LLLMMMMMMDDD',
      '.LMMMMMMDDD.',
      '.MMMMDDDDDD.',
      '..DDDDDDDD..',
      '.....kT.....',
      '.....kT.....',
      '....kkTt....',
      '...kkTTtt...',
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
      '...HLLMMD...',
      '....LLMMD...',
      '...HLLMMMD..',
      '..HLLMMMMDD.',
      '....LLMMMD..',
      '..HLLMMMMDD.',
      '.HLLLMMMMDDD',
      'HLLLMMMMMMDD',
      '.....kT.....',
      '.....kT.....',
      '....kkTt....',
      '...kkTTtt...',
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

  // Grid layout: 8x10 person sprites spaced by 12x12 slots
  let curX = 0;
  let curY = 0;

  for (let t = 0; t < personTypes.length; t++) {
    const pType = personTypes[t];
    for (let f = 0; f < PERSON_FRAMES.length; f++) {
      const key = `person_${pType}_${PERSON_FRAMES[f]}` as SpriteKey;

      drawPerson(pBuf, curX + 2, curY + 1, pType, f as PersonFrame);

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
    getSprite(k: SpriteKey): SpriteRect {
      return sprites[k] ?? sprites['person_male_idle'];
    },
  };
}
