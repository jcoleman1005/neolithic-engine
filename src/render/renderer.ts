import type { WorldView } from '../sim/protocol';
import {
  PERSON_FRAME_BYTES,
  LOOK_SEX_MASK,
  LOOK_PREGNANT_MASK,
  LOOK_STAGE_MASK,
  LOOK_STAGE_CHILD,
  LOOK_STAGE_ELDER,
  LOOK_ENERGY_MASK,
} from '../sim/protocol';
import {
  createWorldBoxSpriteAtlas,
  hexToABGR,
  type SpriteAtlas,
  type SpriteRect,
  type SpriteKey,
} from './sprites';
import {
  PALETTE,
  applyAtmosphericHaze,
  type MaterialRamp,
  type TerrainTheme,
  getPaletteForTheme,
} from './palette';
import {
  createTerrainAtlas,
  type TerrainAtlas,
  T_GRASS,
  T_DIRT,
  T_SAND,
  T_SHALLOWS,
  T_OCEAN,
  T_ROCK,
  T_SNOW,
  CLIFF_S,
  CLIFF_E,
  CLIFF_W,
  CLIFF_SE,
  CLIFF_SW,
  FOAM_N,
  FOAM_S,
  FOAM_W,
  FOAM_E,
} from './terrain-tiles';
import {
  createTerraceData,
  buildTerraces,
  type TerraceData,
} from './terrace';
import {
  getWallBitmask,
  populateWallSpatialMask,
  drawCutawayWall,
} from './walls';

export type MotionStyle = 'smooth' | 'fluid';
export type ColorMode = 'status' | 'bands';
export type OverlayMode = 'none' | 'terrain';

export interface ViewInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

// Whole-number integer zoom scales
const ZOOM_STEPS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32] as const;
// Land overlay colours, as ABGR with alpha added per cell: farmland brown, desert sand, seeds yellow.
const COLOR_FARM_RGB = 0x3068a8; // rgb(168, 104, 48), warm terracotta
const COLOR_DESERT_RGB = 0xaadcee; // rgb(238, 220, 170), pale cream
const COLOR_SEEDS_RGB = 0x28c8f0; // rgb(240, 200, 40), alpha added per cell
const COLOR_HEAP_RGB = 0x2896f0; // rgb(240, 150, 40), bright orange so a food heap never reads as brown
const COLOR_PATH_RGB = 0x3f5f80; // rgb(128, 95, 63), trodden earth on worn paths
const COLOR_BRUSH_RGB = 0x305a7d; // rgb(125, 90, 48), wood stick flecks for brush heaps
const STICK_COLORS = ['#5e4224', '#7d5a30', '#a07c42'];
const FOOD_DOT_COLORS = ['#d9453a', '#ee9a2f', '#e8cf3a', '#6fae3c', '#c2552d'];
const COLOR_GRANARY = 0xff284e7a; // rgb(122, 78, 40), plank floor, opaque
const COLOR_CUT_RGB = 0x6eb4d2; // rgb(210, 180, 110), pale straw: felled woodland showing bare ground
const COLOR_FIELD = 0xff64be78; // rgb(120, 190, 100), open meadow where a stand was cleared
const COLOR_FISH_RGB = 0xf0f0d8; // pale silver, a faint glint on fished water
const COLOR_NEST = 0xff2846a0; // rgb(160, 70, 40), thatched roof, opaque
// Settlement marks on the map.
const LABEL_HIT_CAP = 256;
const SETTLEMENT_MID_MAX_CELL = 10; // no marks above this cell size
const SETTLEMENT_MID_MIN_TIER = 3; // between sprite zoom and that, only towns and cities are marked
const SETTLEMENT_CAMP_NAME_CELL = 4; // camps are named from this cell size up
const SETTLEMENT_FONT = '600 11px system-ui, sans-serif';
const SETTLEMENT_TINT = 'rgba(255, 214, 140, 0.16)';
const SETTLEMENT_LABEL = '#efe7d6';
const SETTLEMENT_LABEL_MAJOR = '#ffd98a';
const SETTLEMENT_LABEL_OUTLINE = '#1a1208';
const SETTLEMENT_ICON = '#e8dcc4';
const SETTLEMENT_ICON_CAMP = '#c9a26b';
const ZOOM_SPRITE_THRESHOLD = 6; // cellSize >= 6 switches from pixel blit to stick figure & trees

// Oblique object pass: light from the north-west, soft shadow to the south-east.
const SHADOW = 'rgba(26, 18, 8, 0.30)';
const THATCH_LIT = ['#d9b45a', '#c9a24c'];
const THATCH_SHADE = ['#a07c38', '#8a6a2c'];
// Where a stump may stand inside its tile (art-pixels, top-left of the drum)
const STUMP_SPOTS: readonly (readonly [number, number])[] = [[1, 1.5], [4.5, 0.8], [2.5, 4.6], [5.6, 4.2], [0.8, 5.8]];
// Drawable kinds
const D_TREE = 1, D_STUMPS = 2, D_STRUCT = 3, D_FISH = 4, D_CAVE = 5, D_GLOW = 6, D_FIRE = 7;
const D_CARCASS = 8, D_WOLF = 9, D_DEER = 10, D_PERSON = 11, D_HUT = 12, D_GRAVE = 13, D_DETAIL = 14, D_CROPS = 15;
// Sort keys: screen y of an object's base, biased positive and packed with its index so ties keep the order collected
const GROUND_KEY = -50000; // flat ground marks sort before everything standing
const KEY_BIAS = 65536;
const KEY_STRIDE = 1048576; // 2^20 drawables at most
const MAX_DRAWABLES = KEY_STRIDE - 1;

// Planimetric Bluff Drop Shadow Helper (blends with rgba(20, 24, 36, 0.45) or 0.60 corner)
const SHADOW_R = 20;
const SHADOW_G = 24;
const SHADOW_B = 36;

function applyBluffDropShadow(abgr: number, isCorner: boolean): number {
  const inv = isCorner ? 40 : 55;
  const a = isCorner ? 60 : 45;
  const r = abgr & 0xff;
  const g = (abgr >>> 8) & 0xff;
  const b = (abgr >>> 16) & 0xff;
  const nr = ((r * inv + SHADOW_R * a + 50) / 100) | 0;
  const ng = ((g * inv + SHADOW_G * a + 50) / 100) | 0;
  const nb = ((b * inv + SHADOW_B * a + 50) / 100) | 0;
  return ((0xff << 24) | (nb << 16) | (ng << 8) | nr) >>> 0;
}

// People Look ABGR Colors for direct pixel writes
const COLOR_PEOPLE_STARVING = hexToABGR('#ef4444');
const COLOR_PEOPLE_PREGNANT = hexToABGR('#f43f5e');
const COLOR_PEOPLE_CHILD    = hexToABGR('#f59e0b');
const COLOR_PEOPLE_ELDER    = hexToABGR('#cbd5e1');
const COLOR_PEOPLE_FEMALE   = hexToABGR('#fb7185');
const COLOR_PEOPLE_MALE     = hexToABGR('#38bdf8');
const COLOR_PEOPLE_LONER    = hexToABGR('#888888');

function hashRootLeaderToABGR(rootId: number): number {
  let h = rootId >>> 0;
  h = ((h >> 16) ^ h) * 0x45d9f3b;
  h = ((h >> 16) ^ h) * 0x45d9f3b;
  h = (h >> 16) ^ h;
  const hue = ((h % 360) + 360) % 360;

  const s = 0.85;
  const l = 0.55;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (hue < 60) { r = c; g = x; }
  else if (hue < 120) { r = x; g = c; }
  else if (hue < 180) { g = c; b = x; }
  else if (hue < 240) { g = x; b = c; }
  else if (hue < 300) { r = x; b = c; }
  else { r = c; b = x; }
  const R = Math.round((r + m) * 255);
  const G = Math.round((g + m) * 255);
  const B = Math.round((b + m) * 255);
  return (0xff << 24) | (B << 16) | (G << 8) | R;
}

function hashRootLeaderToHex(rootId: number): string {
  let h = rootId >>> 0;
  h = ((h >> 16) ^ h) * 0x45d9f3b;
  h = ((h >> 16) ^ h) * 0x45d9f3b;
  h = (h >> 16) ^ h;
  const hue = ((h % 360) + 360) % 360;
  return `hsl(${hue}, 85%, 55%)`;
}

export class CanvasRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private world: WorldView & {
    packedPeopleBuffer?: Uint8Array;
    herdPositions?: Uint8Array;
    wolfPositions?: Uint8Array;
    carcassPositions?: Uint8Array;
    featurePositions?: Uint8Array;
    peopleCount?: number;
    running?: boolean;
    getSelectedPerson?(): any;
  };
  private insets: ViewInsets = { top: 0, bottom: 0, left: 0, right: 0 };

  // Integer scale zoom and pan
  private zoomIndex = 2; // Default scale: ZOOM_STEPS[2] = 3
  public cellSize: number = ZOOM_STEPS[2];
  private gotoTarget: { x: number; y: number } | null = null;
  /** False: single bounded world view, no viewport tiling. */
  private wrapX = false;
  private wrapY = false;
  private panX = 0;
  private panY = 0;

  // Procedural Sprite Atlas
  private readonly atlas: SpriteAtlas;

  // Offscreen 1px/cell (256x256) cached terrain canvas
  private readonly terrainCanvas: HTMLCanvasElement;
  private readonly terrainCtx: CanvasRenderingContext2D;
  private readonly terrainImgData: ImageData;
  private readonly terrainData32: Uint32Array;
  private readonly isForest = new Uint8Array(65536);
  private terrainGenerated = false;
  private lastTerrainVersion = -1;
  /** The terrain and elevation the cache was drawn from: a new seed brings new objects, even at the same version number. */
  private lastTerrainRef: unknown = null;
  private lastElevationRef: unknown = null;

  // Planimetric Terrace & Cutaway State
  private activeElevationSlice = 0; // 0 = all tiers visible; 1..5 = isolate tier
  private readonly terraceData: TerraceData = createTerraceData();
  private readonly wallOccupancyMask = new Uint8Array(65536);
  private terrainTheme: TerrainTheme = 'classic';
  private terrainAtlas: TerrainAtlas = createTerrainAtlas('classic');

  // Zoomed-out people blit overlay canvas (fixed 256x256, 1 px/cell)
  private readonly overlayCanvas: HTMLCanvasElement;
  private readonly overlayCtx: CanvasRenderingContext2D;
  private readonly overlayImg: ImageData;
  private readonly overlayData32: Uint32Array;
  private lastOverlayVersion = -1;
  private lastStructuresVersion = -1;
  private lastPathsVersion = -1;
  private readonly peopleCanvas: HTMLCanvasElement;
  private readonly peopleCtx: CanvasRenderingContext2D;
  private readonly peopleImgData: ImageData;
  private readonly peopleData32: Uint32Array;

  // Motion smoothing state (up to 65536 slots)
  private readonly activeSlots = new Int32Array(65536);
  private activeCount = 0;
  private readonly activeMask = new Uint8Array(65536);
  private readonly prevX = new Float32Array(65536);
  private readonly prevY = new Float32Array(65536);
  private readonly currX = new Float32Array(65536);
  private readonly currY = new Float32Array(65536);
  private readonly lookBytes = new Uint8Array(65536);
  private readonly slotGenerations = new Uint8Array(65536);
  private readonly rootLeaderIds = new Uint32Array(65536);
  private readonly personFacing = new Uint8Array(65536);
  private readonly bandSizes = new Map<number, number>();
  public colorMode: ColorMode = 'status';

  // Oblique object pass: drawables are collected into preallocated typed arrays and sorted by base y
  private dCap = 16384;
  private dCount = 0;
  private dKind = new Uint8Array(16384);
  private dX = new Int32Array(16384);
  private dY = new Int32Array(16384);
  private dA = new Int32Array(16384);
  private dB = new Int32Array(16384);
  private dKeys = new Float64Array(16384);
  private ap = 1; // one art-pixel in screen pixels (cellSize / 8)
  private flick = 0;
  private hasSel = false;
  private selX = 0;
  private selY = 0;
  private readonly personSprites: SpriteRect[] = [];
  private readonly treeSprites: SpriteRect[] = [];

  private lastFrameTime = 0;
  private frameInterval = 333; // ms between sim frames

  // Animal tracking for smooth interpolation and stable heading (up to 256 wolves, 512 deer)
  private readonly prevWolfX = new Float32Array(256);
  private readonly prevWolfY = new Float32Array(256);
  private readonly currWolfX = new Float32Array(256);
  private readonly currWolfY = new Float32Array(256);
  private readonly nextWolfX = new Float32Array(256);
  private readonly nextWolfY = new Float32Array(256);
  private readonly wolfFacing = new Uint8Array(256); // 1 = East (right), 0 = West (left)
  private readonly nextWolfFacing = new Uint8Array(256);
  private wolfCount = 0;

  private readonly prevDeerX = new Float32Array(512);
  private readonly prevDeerY = new Float32Array(512);
  private readonly currDeerX = new Float32Array(512);
  private readonly currDeerY = new Float32Array(512);
  private readonly nextDeerX = new Float32Array(512);
  private readonly nextDeerY = new Float32Array(512);
  private readonly deerFacing = new Uint8Array(512);
  private readonly nextDeerFacing = new Uint8Array(512);
  private deerCount = 0;

  private readonly animalMatched = new Uint8Array(512);

  // Selection & Follow
  /**
   * World-map marks for settlements: a faint footprint, a tier icon and a name. Far zoom shows every
   * settlement that fits, middle zoom only towns and cities, and close zoom none, since the buildings
   * themselves are readable by then.
   */
  private renderSettlements(width: number, height: number, worldPxW: number, worldPxH: number): void {
    this.labelHitCount = 0;
    const list = this.world.settlements;
    const cs = this.cellSize;
    if (!list || list.length === 0 || cs > SETTLEMENT_MID_MAX_CELL) return;
    const far = cs < ZOOM_SPRITE_THRESHOLD;
    const ctx = this.ctx;
    ctx.font = SETTLEMENT_FONT;
    ctx.textBaseline = 'middle';
    // The list comes biggest first, so bigger places win when labels would overlap.
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      if (!far && s.tier < SETTLEMENT_MID_MIN_TIER) continue;
      const showName = !far || s.tier >= 1 || cs >= SETTLEMENT_CAMP_NAME_CELL;
      for (let ty = this.panY; ty < (this.wrapY ? height : this.panY + 1); ty += worldPxH) {
        for (let tx = this.panX; tx < (this.wrapX ? width : this.panX + 1); tx += worldPxW) {
          const sx = Math.round(tx + (s.x + 0.5) * cs);
          const sy = Math.round(ty + (s.y + 0.5) * cs);
          if (sx < -80 || sx > width + 80 || sy < -20 || sy > height + 20) continue;
          if (far) {
            ctx.fillStyle = SETTLEMENT_TINT;
            ctx.beginPath();
            ctx.arc(sx, sy, Math.max(4, (s.radius + 2) * cs), 0, Math.PI * 2);
            ctx.fill();
          }
          const half = this.drawSettlementIcon(sx, sy, s.tier);
          let x1 = sx + half;
          if (showName) {
            const textW = ctx.measureText(s.name).width;
            const lx = sx + half + 3;
            if (!this.labelOverlaps(lx, sy - 7, lx + textW, sy + 7)) {
              ctx.lineWidth = 3;
              ctx.strokeStyle = SETTLEMENT_LABEL_OUTLINE;
              ctx.strokeText(s.name, lx, sy);
              ctx.fillStyle = s.tier >= 2 ? SETTLEMENT_LABEL_MAJOR : SETTLEMENT_LABEL;
              ctx.fillText(s.name, lx, sy);
              x1 = lx + textW;
            }
          }
          this.addLabelHit(s.id, sx - half - 2, sy - Math.max(half, 7) - 2, x1 + 2, sy + Math.max(half, 7) + 2);
        }
      }
    }
  }

  /** Where each settlement mark was drawn last frame, in canvas pixels, for scripts/capture.ts. */
  public settlementHitBoxes(): Array<{ id: number; x0: number; y0: number; x1: number; y1: number }> {
    const out = [];
    for (let i = 0; i < this.labelHitCount; i++) {
      const o = i * 4;
      out.push({ id: this.labelHitIds[i], x0: this.labelHits[o], y0: this.labelHits[o + 1], x1: this.labelHits[o + 2], y1: this.labelHits[o + 3] });
    }
    return out;
  }

  private labelOverlaps(x0: number, y0: number, x1: number, y1: number): boolean {
    for (let i = 0; i < this.labelHitCount; i++) {
      const o = i * 4;
      if (x0 < this.labelHits[o + 2] && x1 > this.labelHits[o] && y0 < this.labelHits[o + 3] && y1 > this.labelHits[o + 1]) return true;
    }
    return false;
  }

  private addLabelHit(id: number, x0: number, y0: number, x1: number, y1: number): void {
    if (this.labelHitCount >= LABEL_HIT_CAP) return;
    const o = this.labelHitCount * 4;
    this.labelHits[o] = x0;
    this.labelHits[o + 1] = y0;
    this.labelHits[o + 2] = x1;
    this.labelHits[o + 3] = y1;
    this.labelHitIds[this.labelHitCount++] = id;
  }

  /** A placeholder site mark that grows with the tier: one block for a camp, up to five for a city. Returns its half width. */
  private drawSettlementIcon(sx: number, sy: number, tier: number): number {
    const ctx = this.ctx;
    const half = 3 + tier;
    ctx.fillStyle = SETTLEMENT_LABEL_OUTLINE;
    ctx.fillRect(sx - half - 1, sy - half - 1, half * 2 + 2, half * 2 + 2);
    ctx.fillStyle = tier === 0 ? SETTLEMENT_ICON_CAMP : SETTLEMENT_ICON;
    ctx.fillRect(sx - half, sy - half, half * 2, half * 2);
    ctx.fillStyle = SETTLEMENT_LABEL_OUTLINE;
    for (let k = 1; k <= tier; k++) {
      const bx = sx - half + ((k * 5) % (half * 2 - 1));
      const by = sy - half + ((k * 3) % (half * 2 - 1));
      ctx.fillRect(bx, by, 2, 2);
    }
    return half;
  }

  public selectedSlot: number | null = null;
  public followSelected = false;
  public onSelect?: (slot: number | null) => void;
  /** Called when a settlement's icon or name is tapped. */
  public onSelectSettlement?: (id: number) => void;
  private readonly labelHits = new Float32Array(LABEL_HIT_CAP * 4);
  private readonly labelHitIds = new Int32Array(LABEL_HIT_CAP);
  private labelHitCount = 0;
  /** Called when the viewer pans, zooms or taps, so the auto-camera can back off. */
  public onUserInput?: () => void;
  private cameraTarget: { x: number; y: number } | null = null;
  private camX = 0;
  private camY = 0;
  private lastCameraStep = 0;

  // 30 FPS Render Loop
  private animHandle: number | null = null;
  private lastRenderTimestamp = 0;
  private readonly targetFrameMs = 1000 / 30; // 30 FPS cap

  // Interaction State
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragStartPanX = 0;
  private dragStartPanY = 0;
  private pinchStartDist = 0;
  private pinchStartZoomIndex = 2;

  constructor(
    canvas: HTMLCanvasElement,
    world: WorldView & {
      packedPeopleBuffer?: Uint8Array;
    herdPositions?: Uint8Array;
    wolfPositions?: Uint8Array;
    carcassPositions?: Uint8Array;
    featurePositions?: Uint8Array;
      peopleCount?: number;
      running?: boolean;
      getSelectedPerson?(): any;
    }
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.world = world;

    // Generate procedural sprite atlas once
    this.atlas = createWorldBoxSpriteAtlas();
    for (const type of ['male', 'female', 'pregnant', 'child', 'elder', 'starving']) {
      for (const frame of ['idle', 'walk_0', 'walk_1']) {
        this.personSprites.push(this.atlas.getSprite(`person_${type}_${frame}` as SpriteKey));
      }
    }
    for (const key of ['tree_oak', 'tree_pine', 'tree_fruit'] as const) {
      this.treeSprites.push(this.atlas.getSprite(key));
    }

    // Initialize 256x256 1 px/cell terrain canvas
    this.terrainCanvas = document.createElement('canvas');
    this.terrainCanvas.width = 256;
    this.terrainCanvas.height = 256;
    this.terrainCtx = this.terrainCanvas.getContext('2d')!;
    this.terrainCtx.imageSmoothingEnabled = false;
    this.terrainImgData = this.terrainCtx.createImageData(256, 256);
    this.terrainData32 = new Uint32Array(this.terrainImgData.data.buffer);

    // Initialize 256x256 overlay canvas for direct 1px/cell ImageData blitting
    this.overlayCanvas = document.createElement('canvas');
    this.overlayCanvas.width = 256;
    this.overlayCanvas.height = 256;
    this.overlayCtx = this.overlayCanvas.getContext('2d')!;
    this.overlayCtx.imageSmoothingEnabled = false;
    this.overlayImg = this.overlayCtx.createImageData(256, 256);
    this.overlayData32 = new Uint32Array(this.overlayImg.data.buffer);
    this.peopleCanvas = document.createElement('canvas');
    this.peopleCanvas.width = 256;
    this.peopleCanvas.height = 256;
    this.peopleCtx = this.peopleCanvas.getContext('2d')!;
    this.peopleCtx.imageSmoothingEnabled = false;
    this.peopleImgData = this.peopleCtx.createImageData(256, 256);
    this.peopleData32 = new Uint32Array(this.peopleImgData.data.buffer);
    this.personFacing.fill(1);

    this.setupEvents();
    this.resize();
    this.startLoop();
  }

  public setInsets(insets: ViewInsets): void {
    this.insets = insets;
    this.resize();
  }

  public resize(): void {
    const rect = this.canvas.parentElement?.getBoundingClientRect() ?? { width: 360, height: 360 };
    const dpr = window.devicePixelRatio || 1;
    const w = Math.floor(rect.width * dpr);
    const h = Math.floor(rect.height * dpr);

    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.canvas.style.width = `${rect.width}px`;
      this.canvas.style.height = `${rect.height}px`;
    }

    const worldW = this.world.config.worldWidth || 256;
    const worldH = this.world.config.worldHeight || 256;
    const availW = Math.max(100, rect.width - this.insets.left - this.insets.right);
    const availH = Math.max(100, rect.height - this.insets.top - this.insets.bottom);

    // Center world initially if not panned
    if (this.panX === 0 && this.panY === 0) {
      this.panX = Math.round(this.insets.left + (availW - worldW * this.cellSize) / 2);
      this.panY = Math.round(this.insets.top + (availH - worldH * this.cellSize) / 2);
    }
  }

  public setWorld(
    world: WorldView & {
      packedPeopleBuffer?: Uint8Array;
    herdPositions?: Uint8Array;
    wolfPositions?: Uint8Array;
    carcassPositions?: Uint8Array;
    featurePositions?: Uint8Array;
      peopleCount?: number;
      running?: boolean;
      getSelectedPerson?(): any;
    }
  ): void {
    this.world = world;
    this.wolfCount = 0;
    this.deerCount = 0;
  }

  public startLoop(): void {
    if (this.animHandle !== null) return;
    const tick = (time: number) => {
      this.animHandle = requestAnimationFrame(tick);
      const elapsed = time - this.lastRenderTimestamp;
      if (elapsed >= this.targetFrameMs - 1) {
        this.lastRenderTimestamp = time;
        this.stepCamera(time);
        this.render();
      }
    };
    this.animHandle = requestAnimationFrame(tick);
  }

  /** Where the auto-camera wants to look, in cells; null lets go of the view. */
  public setCameraTarget(target: { x: number; y: number } | null): void {
    this.cameraTarget = target;
  }

  /** One-off glide to a spot (a tapped chronicle entry). The auto-camera backs off meanwhile. */
  public goTo(x: number, y: number): void {
    this.gotoTarget = { x, y };
    this.followSelected = false;
    this.onUserInput?.();
  }

  /** Glides the pan toward the camera target. Pan stays whole pixels so zoom stays crisp. */
  private stepCamera(time: number): void {
    const dt = Math.min(250, Math.max(0, time - this.lastCameraStep));
    this.lastCameraStep = time;
    if (this.isDragging) this.gotoTarget = null;
    const t = this.gotoTarget ?? this.cameraTarget;
    if (!t) return;
    const rect = this.canvas.parentElement?.getBoundingClientRect();
    if (!rect) return;
    const availW = Math.max(100, rect.width - this.insets.left - this.insets.right);
    const availH = Math.max(100, rect.height - this.insets.top - this.insets.bottom);
    let wantX = this.insets.left + availW / 2 - t.x * this.cellSize;
    let wantY = this.insets.top + availH / 2 - t.y * this.cellSize;
    const wpx = (this.world.config.worldWidth || 256) * this.cellSize;
    const hpx = (this.world.config.worldHeight || 256) * this.cellSize;
    if (this.wrapX) {
      wantX -= Math.round((wantX - this.camX) / wpx) * wpx;
    } else {
      wantX = wpx <= availW
        ? Math.round(this.insets.left + (availW - wpx) / 2)
        : Math.min(this.insets.left, Math.max(this.insets.left + availW - wpx, wantX));
    }
    if (this.wrapY) {
      wantY -= Math.round((wantY - this.camY) / hpx) * hpx;
    } else {
      wantY = hpx <= availH
        ? Math.round(this.insets.top + (availH - hpx) / 2)
        : Math.min(this.insets.top, Math.max(this.insets.top + availH - hpx, wantY));
    }
    // Someone else moved the view (a drag or zoom): start again from where it is.
    if (Math.abs(Math.round(this.camX) - this.panX) > 1 || Math.abs(Math.round(this.camY) - this.panY) > 1) {
      this.camX = this.panX;
      this.camY = this.panY;
    }
    const k = 1 - Math.exp(-dt / 700);
    this.camX += (wantX - this.camX) * k;
    this.camY += (wantY - this.camY) * k;
    this.panX = Math.round(this.camX);
    this.panY = Math.round(this.camY);
    if (this.gotoTarget && Math.abs(wantX - this.camX) < 2 && Math.abs(wantY - this.camY) < 2) {
      this.gotoTarget = null;
    }
  }

  public stopLoop(): void {
    if (this.animHandle !== null) {
      cancelAnimationFrame(this.animHandle);
      this.animHandle = null;
    }
  }

  public setMotionStyle(_style: MotionStyle): void {}
  public setColorMode(_mode: ColorMode): void {}
  public setOverlay(_mode: OverlayMode): void {}
  public setHighlightSpecies(_id: number | null): void {}
  public setSpeciesLookup(_fn: ((id: string) => number) | null): void {}

  private setupEvents(): void {
    // Crisp whole-number wheel zoom
    this.canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.onUserInput?.();
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const oldCellSize = this.cellSize;
        const worldX = (mouseX - this.panX) / oldCellSize;
        const worldY = (mouseY - this.panY) / oldCellSize;

        if (e.deltaY < 0) {
          // Zoom in
          this.zoomIndex = Math.min(ZOOM_STEPS.length - 1, this.zoomIndex + 1);
        } else {
          // Zoom out
          this.zoomIndex = Math.max(0, this.zoomIndex - 1);
        }

        this.cellSize = ZOOM_STEPS[this.zoomIndex];
        this.panX = Math.round(mouseX - worldX * this.cellSize);
        this.panY = Math.round(mouseY - worldY * this.cellSize);
      },
      { passive: false }
    );

    this.canvas.addEventListener('pointerdown', (e) => {
      this.onUserInput?.();
      this.isDragging = true;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      this.dragStartPanX = this.panX;
      this.dragStartPanY = this.panY;
      try {
        this.canvas.setPointerCapture(e.pointerId);
      } catch {}
    });

    this.canvas.addEventListener('pointermove', (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.dragStartX;
      const dy = e.clientY - this.dragStartY;
      this.panX = Math.round(this.dragStartPanX + dx);
      this.panY = Math.round(this.dragStartPanY + dy);
      if (Math.hypot(dx, dy) > 5) {
        this.followSelected = false; // Manual pan stops auto-follow
      }
    });

    const pointerUp = (e: PointerEvent) => {
      if (this.isDragging) {
        const moved = Math.hypot(e.clientX - this.dragStartX, e.clientY - this.dragStartY);
        this.isDragging = false;
        try {
          this.canvas.releasePointerCapture(e.pointerId);
        } catch {}

        if (moved < 5) {
          this.handleTap(e.clientX, e.clientY);
        }
      }
    };
    this.canvas.addEventListener('pointerup', pointerUp);
    this.canvas.addEventListener('pointercancel', pointerUp);

    // Mobile Pinch-to-zoom snapped to whole numbers
    this.canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        this.pinchStartDist = Math.hypot(dx, dy);
        this.pinchStartZoomIndex = this.zoomIndex;
      }
    });

    this.canvas.addEventListener(
      'touchmove',
      (e) => {
        if (e.touches.length === 2 && this.pinchStartDist > 0) {
          e.preventDefault();
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          const dist = Math.hypot(dx, dy);
          const ratio = dist / this.pinchStartDist;

          // Midpoint of pinch
          const rect = this.canvas.getBoundingClientRect();
          const midX = (e.touches[0].clientX + e.touches[1].clientX) * 0.5 - rect.left;
          const midY = (e.touches[0].clientY + e.touches[1].clientY) * 0.5 - rect.top;

          const oldCellSize = this.cellSize;
          const worldX = (midX - this.panX) / oldCellSize;
          const worldY = (midY - this.panY) / oldCellSize;

          const targetSize = ZOOM_STEPS[this.pinchStartZoomIndex] * ratio;
          let bestIndex = 0;
          let minDiff = Math.abs(ZOOM_STEPS[0] - targetSize);
          for (let i = 1; i < ZOOM_STEPS.length; i++) {
            const diff = Math.abs(ZOOM_STEPS[i] - targetSize);
            if (diff < minDiff) {
              minDiff = diff;
              bestIndex = i;
            }
          }

          if (bestIndex !== this.zoomIndex) {
            this.zoomIndex = bestIndex;
            this.cellSize = ZOOM_STEPS[this.zoomIndex];
            this.panX = Math.round(midX - worldX * this.cellSize);
            this.panY = Math.round(midY - worldY * this.cellSize);
          }
        }
      },
      { passive: false }
    );
  }

  /** The settlement whose icon or name is under this point, or null. */
  private settlementAtClient(clientX: number, clientY: number): number | null {
    const rect = this.canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    for (let i = this.labelHitCount - 1; i >= 0; i--) {
      const o = i * 4;
      if (x >= this.labelHits[o] && x <= this.labelHits[o + 2] && y >= this.labelHits[o + 1] && y <= this.labelHits[o + 3]) {
        return this.labelHitIds[i];
      }
    }
    return null;
  }

  private handleTap(clientX: number, clientY: number): void {
    // Zoomed out, people are single pixels packed around camps, so a tap on a label means the label.
    const settlement = this.settlementAtClient(clientX, clientY);
    if (settlement !== null && this.cellSize < ZOOM_SPRITE_THRESHOLD) {
      this.onSelectSettlement?.(settlement);
      return;
    }
    const person = this.findPersonNearClient(clientX, clientY, 2.5);
    if (person === null && settlement !== null) {
      this.onSelectSettlement?.(settlement);
      return;
    }
    if (person !== null) {
      this.selectedSlot = person.slot;
      this.onSelect?.(person.slot);
    } else {
      this.selectedSlot = null;
      this.followSelected = false;
      this.onSelect?.(null);
    }
  }

  public worldToCell(clientX: number, clientY: number): { x: number; y: number } | null {
    const rect = this.canvas.getBoundingClientRect();
    const px = clientX - rect.left - this.panX;
    const py = clientY - rect.top - this.panY;
    const w = this.world.config.worldWidth || 256;
    const h = this.world.config.worldHeight || 256;
    let cx = Math.floor(px / this.cellSize);
    let cy = Math.floor(py / this.cellSize);
    if (!this.wrapX && (cx < 0 || cx >= w)) return null;
    if (!this.wrapY && (cy < 0 || cy >= h)) return null;
    if (this.world.config.wrapping) {
      cx = ((cx % w) + w) % w;
      cy = ((cy % h) + h) % h;
      return { x: cx, y: cy };
    }
    if (cx < 0 || cy < 0 || cx >= w || cy >= h) return null;
    return { x: cx, y: cy };
  }

  public findPersonNearClient(
    clientX: number,
    clientY: number,
    maxCellDist = 2.0
  ): { slot: number; dist: number } | null {
    const rect = this.canvas.getBoundingClientRect();
    const px = clientX - rect.left - this.panX;
    const py = clientY - rect.top - this.panY;
    const targetX = px / this.cellSize;
    const targetY = py / this.cellSize;

    const w = this.world.config.worldWidth || 256;
    const h = this.world.config.worldHeight || 256;
    if (!this.wrapX && (targetX < -0.5 || targetX > w + 0.5)) return null;
    if (!this.wrapY && (targetY < -0.5 || targetY > h + 0.5)) return null;

    let bestSlot = -1;
    let bestDistSq = maxCellDist * maxCellDist;

    for (let i = 0; i < this.activeCount; i++) {
      const slot = this.activeSlots[i];
      const cx = this.currX[slot];
      const cy = this.currY[slot];

      let dx = (cx + 0.5) - targetX;
      if (this.wrapX && this.world.config.wrapping) {
        if (dx > w / 2) dx -= w;
        else if (dx < -w / 2) dx += w;
      }

      let dy = (cy + 0.5) - targetY;
      if (this.wrapY && this.world.config.wrapping) {
        if (dy > h / 2) dy -= h;
        else if (dy < -h / 2) dy += h;
      }

      const distSq = dx * dx + dy * dy;
      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        bestSlot = slot;
      }
    }

    if (bestSlot >= 0) {
      return { slot: bestSlot, dist: Math.sqrt(bestDistSq) };
    }
    return null;
  }

  public frameStart(): void {}

  public frameDone(): void {
    const buf = this.world.packedPeopleBuffer;
    if (!buf || buf.length === 0) return;

    const now = performance.now();
    if (this.lastFrameTime > 0) {
      this.frameInterval = Math.max(16, Math.min(1000, now - this.lastFrameTime));
    }
    this.lastFrameTime = now;

    const count = Math.floor(buf.length / PERSON_FRAME_BYTES);
    const newMask = new Uint8Array(65536);

    let offset = 0;
    this.bandSizes.clear();
    for (let i = 0; i < count; i++) {
      const slot = buf[offset] | (buf[offset + 1] << 8);
      const x = buf[offset + 2];
      const y = buf[offset + 3];
      const look = buf[offset + 4];
      const gen = buf[offset + 5];
      const rId =
        (buf[offset + 6] | (buf[offset + 7] << 8) | (buf[offset + 8] << 16) | (buf[offset + 9] << 24)) >>> 0;
      offset += PERSON_FRAME_BYTES;

      if (slot >= 65536) continue;

      if (this.activeMask[slot] === 0 || this.slotGenerations[slot] !== gen) {
        // Snap rather than slide when slot generation changes or slot first seen
        this.prevX[slot] = x;
        this.prevY[slot] = y;
        this.slotGenerations[slot] = gen;
      } else {
        this.prevX[slot] = this.currX[slot];
        this.prevY[slot] = this.currY[slot];
      }

      this.currX[slot] = x;
      this.currY[slot] = y;
      this.lookBytes[slot] = look;
      this.rootLeaderIds[slot] = rId;
      this.bandSizes.set(rId, (this.bandSizes.get(rId) ?? 0) + 1);
      newMask[slot] = 1;
      this.activeSlots[i] = slot;
    }

    this.activeMask.set(newMask);
    this.activeCount = count;
    this.updateAnimalTracking();
  }

  private updateAnimalTracking(): void {
    // 1. Wolves
    const wolves = this.world.wolfPositions;
    const wolfN = wolves ? wolves.length >> 1 : 0;
    const oldWolfN = this.wolfCount;
    const targetW = Math.min(256, wolfN);
    this.animalMatched.fill(0);

    for (let i = 0; i < targetW; i++) {
      const nx = wolves![i * 2];
      const ny = wolves![i * 2 + 1];
      let bestJ = -1;

      // Fast path: same slot index
      if (i < oldWolfN && this.animalMatched[i] === 0) {
        let dx = nx - this.currWolfX[i];
        if (dx > 128) dx -= 256; else if (dx < -128) dx += 256;
        let dy = ny - this.currWolfY[i];
        if (dy > 128) dy -= 256; else if (dy < -128) dy += 256;
        if (Math.abs(dx) <= 2 && Math.abs(dy) <= 2) {
          bestJ = i;
        }
      }

      // Fallback scan if index shifted due to spawn/death
      if (bestJ < 0 && oldWolfN > 0) {
        let minD = 1e9;
        for (let j = 0; j < oldWolfN; j++) {
          if (this.animalMatched[j] === 1) continue;
          let dx = nx - this.currWolfX[j];
          if (dx > 128) dx -= 256; else if (dx < -128) dx += 256;
          let dy = ny - this.currWolfY[j];
          if (dy > 128) dy -= 256; else if (dy < -128) dy += 256;
          if (Math.abs(dx) <= 2 && Math.abs(dy) <= 2) {
            const d = dx * dx + dy * dy;
            if (d < minD) { minD = d; bestJ = j; }
          }
        }
      }

      if (bestJ >= 0) {
        this.animalMatched[bestJ] = 1;
        this.prevWolfX[i] = this.currWolfX[bestJ];
        this.prevWolfY[i] = this.currWolfY[bestJ];
        this.nextWolfX[i] = nx;
        this.nextWolfY[i] = ny;
        let mdx = nx - this.currWolfX[bestJ];
        if (mdx > 128) mdx -= 256; else if (mdx < -128) mdx += 256;
        this.nextWolfFacing[i] = Math.abs(mdx) > 0.01 ? (mdx > 0 ? 1 : 0) : this.wolfFacing[bestJ];
      } else {
        this.prevWolfX[i] = nx;
        this.prevWolfY[i] = ny;
        this.nextWolfX[i] = nx;
        this.nextWolfY[i] = ny;
        this.nextWolfFacing[i] = 1;
      }
    }

    if (targetW > 0) {
      this.currWolfX.set(this.nextWolfX.subarray(0, targetW));
      this.currWolfY.set(this.nextWolfY.subarray(0, targetW));
      this.wolfFacing.set(this.nextWolfFacing.subarray(0, targetW));
    }
    this.wolfCount = targetW;

    // 2. Deer (herds)
    const herds = this.world.herdPositions;
    const deerN = herds ? herds.length >> 1 : 0;
    const oldDeerN = this.deerCount;
    const targetD = Math.min(512, deerN);
    this.animalMatched.fill(0);

    for (let i = 0; i < targetD; i++) {
      const nx = herds![i * 2];
      const ny = herds![i * 2 + 1];
      let bestJ = -1;

      if (i < oldDeerN && this.animalMatched[i] === 0) {
        let dx = nx - this.currDeerX[i];
        if (dx > 128) dx -= 256; else if (dx < -128) dx += 256;
        let dy = ny - this.currDeerY[i];
        if (dy > 128) dy -= 256; else if (dy < -128) dy += 256;
        if (Math.abs(dx) <= 2 && Math.abs(dy) <= 2) {
          bestJ = i;
        }
      }

      if (bestJ < 0 && oldDeerN > 0) {
        let minD = 1e9;
        for (let j = 0; j < oldDeerN; j++) {
          if (this.animalMatched[j] === 1) continue;
          let dx = nx - this.currDeerX[j];
          if (dx > 128) dx -= 256; else if (dx < -128) dx += 256;
          let dy = ny - this.currDeerY[j];
          if (dy > 128) dy -= 256; else if (dy < -128) dy += 256;
          if (Math.abs(dx) <= 2 && Math.abs(dy) <= 2) {
            const d = dx * dx + dy * dy;
            if (d < minD) { minD = d; bestJ = j; }
          }
        }
      }

      if (bestJ >= 0) {
        this.animalMatched[bestJ] = 1;
        this.prevDeerX[i] = this.currDeerX[bestJ];
        this.prevDeerY[i] = this.currDeerY[bestJ];
        this.nextDeerX[i] = nx;
        this.nextDeerY[i] = ny;
        let mdx = nx - this.currDeerX[bestJ];
        if (mdx > 128) mdx -= 256; else if (mdx < -128) mdx += 256;
        this.nextDeerFacing[i] = Math.abs(mdx) > 0.01 ? (mdx > 0 ? 1 : 0) : this.deerFacing[bestJ];
      } else {
        this.prevDeerX[i] = nx;
        this.prevDeerY[i] = ny;
        this.nextDeerX[i] = nx;
        this.nextDeerY[i] = ny;
        this.nextDeerFacing[i] = 1;
      }
    }

    if (targetD > 0) {
      this.currDeerX.set(this.nextDeerX.subarray(0, targetD));
      this.currDeerY.set(this.nextDeerY.subarray(0, targetD));
      this.deerFacing.set(this.nextDeerFacing.subarray(0, targetD));
    }
    this.deerCount = targetD;
  }

  public render(): void {
    const dpr = window.devicePixelRatio || 1;
    const width = this.canvas.width / dpr;
    const height = this.canvas.height / dpr;

    this.ctx.save();
    this.ctx.scale(dpr, dpr);
    this.ctx.imageSmoothingEnabled = false;

    // Void background
    this.ctx.fillStyle = '#0b0f19';
    this.ctx.fillRect(0, 0, width, height);

    const w = this.world.config.worldWidth || 256;
    const h = this.world.config.worldHeight || 256;
    const worldPxW = w * this.cellSize;
    const worldPxH = h * this.cellSize;

    // Follow camera if tracking a person
    if (
      this.followSelected &&
      this.selectedSlot !== null &&
      this.activeMask[this.selectedSlot] === 1
    ) {
      const sx = this.currX[this.selectedSlot] * this.cellSize;
      const sy = this.currY[this.selectedSlot] * this.cellSize;
      this.panX = Math.round(width / 2 - sx);
      this.panY = Math.round(height / 2 - sy);
    }

    // When zoomed out far enough that the world fits on an axis, center it with the void
    // around it. When zoomed in, clamp panning so the camera stays within world bounds.
    // The view does not wrap; entities teleport across edges like a continuous world.
    this.wrapX = false;
    this.wrapY = false;
    const nx = worldPxW <= width
      ? Math.round((width - worldPxW) / 2)
      : Math.min(0, Math.max(width - worldPxW, this.panX));
    const ny = worldPxH <= height
      ? Math.round((height - worldPxH) / 2)
      : Math.min(0, Math.max(height - worldPxH, this.panY));
    this.camX += nx - this.panX;
    this.camY += ny - this.panY;
    this.panX = nx;
    this.panY = ny;

    // 1. Ensure terrain cache is up to date
    this.updateTerrainCache();

    // 2. Draw the terrain: zoomed-in uses 8x8 DF pixel-art tiles and cliff strata; zoomed-out uses 256x256 cache
    const isZoomedIn = this.cellSize >= ZOOM_SPRITE_THRESHOLD;
    if (isZoomedIn) {
      this.renderTerrainTiles(width, height, w, h);
    } else {
      this.ctx.drawImage(this.terrainCanvas, 0, 0, 256, 256, this.panX, this.panY, worldPxW, worldPxH);
    }

    // 3. Farmland, desert and seeds, drawn on the ground in the single world rect
    if (this.updateOverlayCache()) {
      this.ctx.drawImage(this.overlayCanvas, 0, 0, 256, 256, this.panX, this.panY, worldPxW, worldPxH);
    }

    // 4. Objects. Zoomed in: oblique sprites, collected, sorted by row and painted back to front.
    //    Zoomed out: flat dots and pixels, as before.
    if (isZoomedIn) {
      this.renderObjects(width, height, w, h);
    } else {
      this.renderPeopleFlat(width, height, w, h);
      this.renderFeaturesFlat(width, height, w, h);
      this.renderHerdsFlat(width, height, w, h);
    }

    this.renderSettlements(width, height, worldPxW, worldPxH);

    this.ctx.restore();
  }

  /**
   * Paints the land overlay (one byte per cell: desert 3 bits, farmland 3 bits, seeds 2 bits)
   * into a transparent 256x256 canvas, only when it has changed. False when there is nothing to draw.
   */
  private updateOverlayCache(): boolean {
    const data = this.world.landOverlay;
    if (!data) return false;
    const version = this.world.landOverlayVersion ?? 0;
    const structVersion = this.world.landStructuresVersion ?? 0;
    const pathsVersion = this.world.landPathsVersion ?? 0;
    if (version !== this.lastOverlayVersion || structVersion !== this.lastStructuresVersion || pathsVersion !== this.lastPathsVersion) {
      this.lastOverlayVersion = version;
      this.lastStructuresVersion = structVersion;
      this.lastPathsVersion = pathsVersion;
      const paths = this.world.landPaths;
      const structures = this.world.landStructures;
      const out = this.overlayData32;
      const waterArr = this.world.elevation?.water;
      for (let i = 0; i < 65536; i++) {
        const b = data[i];
        const desert = b & 7;
        const farm = (b >> 3) & 7;
        const seeds = b >> 6;
        let c = 0;
        // A faint checker on worked soil reads as tilled ground, distinct from smooth desert.
        const checker = ((i + (i >> 8)) & 1) * 10;
        if (seeds === 3) c = (((230 + checker) << 24) | COLOR_SEEDS_RGB) >>> 0; // ripe golden crops: brilliant rich gold
        else if (seeds > 0) c = (((120 + seeds * 35 + checker) << 24) | COLOR_SEEDS_RGB) >>> 0; // growing grain / seedbed
        else if (farm >= 2 && farm >= desert) c = (((115 + farm * 16 + checker) << 24) | COLOR_FARM_RGB) >>> 0; // worked soil: dark brown
        else if (desert >= 2) c = (((85 + desert * 20) << 24) | COLOR_DESERT_RGB) >>> 0; // stripped land: pale sand
        else if (farm === 1) c = (((70 + checker) << 24) | COLOR_FARM_RGB) >>> 0; // barely worked
        // S2: worn paths show as trodden earth, stronger the more they are used.
        const path = paths ? paths[i] : 0;
        if (path >= 2) c = ((50 + path * 22) << 24) | COLOR_PATH_RGB;
        // Heaps and granary floors sit on top of everything else.
        const st = structures ? structures[i] : 0;
        if (waterArr && waterArr[i] > 0) {
          // Shore water holding fish shimmers faintly; the byte there is a fish level, not a heap.
          if (st > 0) c = (((30 + st * 12) << 24) | COLOR_FISH_RGB) >>> 0;
          out[i] = c >>> 0;
          continue;
        }
        if (st !== 0 && this.isForest[i] === 1 && (st >> 5) > 0 && c === 0) {
          // Thinned woodland: the more is felled, the paler and barer the stand.
          const th = st >> 5;
          c = th === 7 ? COLOR_FIELD : th === 6 ? ((200 << 24) | COLOR_CUT_RGB) : ((50 + th * 26) << 24) | COLOR_CUT_RGB;
        }
        if (st !== 0) {
          const form = (st >> 3) & 3;
          if (form === 2) c = COLOR_GRANARY;
          else if (form === 3) c = COLOR_NEST;
          else if ((st & 7) > 0) c = ((170 + (st & 7) * 12) << 24) | COLOR_HEAP_RGB;
          else if (form === 1 && this.isForest[i] === 0 && (st >> 5) > 0) {
            const bLevel = st >> 5;
            c = ((130 + bLevel * 16) << 24) | COLOR_BRUSH_RGB;
          }
        }
        out[i] = c >>> 0;
      }
      this.overlayCtx.putImageData(this.overlayImg, 0, 0);
    }
    return true;
  }

  /**
   * Generates or updates the 256x256 1 px/cell terrain canvas.
   * Renders 4-tone autotiled materials and hard terrace drop shadows.
   */
  private updateTerrainCache(): void {
    const elevation = this.world.elevation;
    const terrain = this.world.terrain;

    if (!elevation && !terrain) {
      if (!this.terrainGenerated) {
        this.terrainCtx.fillStyle = PALETTE.grass.baseHex;
        this.terrainCtx.fillRect(0, 0, 256, 256);
        this.terrainGenerated = true;
      }
      return;
    }

    // Redraw only when not yet generated or when terrain changes
    const curTerrainVer = terrain ? terrain.version : 0;
    if (
      this.terrainGenerated &&
      curTerrainVer === this.lastTerrainVersion &&
      terrain === this.lastTerrainRef &&
      elevation === this.lastElevationRef
    ) {
      return;
    }

    if (elevation?.elevation) {
      buildTerraces(elevation.elevation, this.terraceData);
    } else {
      this.terraceData.tiers.fill(2);
      this.terraceData.shadowMask.fill(0);
    }

    const elevArr = elevation?.elevation;
    const waterArr = elevation?.water;
    const coverArr = terrain?.cover;
    const deepThreshold = Math.floor((this.world.config.elevationDeepThreshold ?? 0.2) * 255);
    const tiers = this.terraceData.tiers;
    const shadowMask = this.terraceData.shadowMask;
    const pal = getPaletteForTheme(this.terrainTheme);

    for (let y = 0; y < 256; y++) {
      const yPrev = (y - 1) & 255;
      const yNext = (y + 1) & 255;
      const rowOffset = y << 8;
      const rowPrev = yPrev << 8;
      const rowNext = yNext << 8;

      for (let x = 0; x < 256; x++) {
        const idx = rowOffset + x;
        const xPrev = (x - 1) & 255;
        const xNext = (x + 1) & 255;

        const isWater = waterArr ? waterArr[idx] > 0 : false;
        let ramp: MaterialRamp;
        let forestCell = false;

        if (isWater) {
          const depth = waterArr![idx];
          ramp = depth >= deepThreshold ? pal.deepWater : pal.shallowWater;
        } else {
          const tier = tiers[idx];
          const h = elevArr ? elevArr[idx] / 65535 : 0.5;

          // Shore check: near water
          const nearWater =
            (waterArr &&
              (waterArr[rowOffset + xPrev] > 0 ||
                waterArr[rowOffset + xNext] > 0 ||
                waterArr[rowPrev + x] > 0 ||
                waterArr[rowNext + x] > 0)) ||
            (elevation && h < elevation.seaLevel + 0.015);

          if (nearWater || tier <= 1) {
            ramp = pal.sand;
          } else if (tier === 5) {
            ramp = pal.snow;
          } else if (tier === 4) {
            ramp = pal.rock;
          } else if (tier === 3) {
            ramp = pal.shrub;
          } else {
            // Lowlands: meadow vs forest
            const cover = coverArr ? coverArr[idx] / 65535 : 0.4;
            if (cover >= 0.50) {
              forestCell = true;
            }
            ramp = pal.grass;
          }
        }

        this.isForest[idx] = forestCell ? 1 : 0;

        // Clean low-noise plane: dominant material base tone
        let pixelColor = ramp.base;

        // Bluff drop shadows and crest highlights
        const shadowFlags = shadowMask[idx];
        if ((shadowFlags & 3) !== 0) {
          // Hard 1-2px bluff drop shadow on lower tile
          const isCorner = (shadowFlags & 3) === 3;
          pixelColor = applyBluffDropShadow(pixelColor, isCorner);
        } else if ((shadowFlags & 4) !== 0) {
          // Sharp crest highlight on top edge of bluff
          pixelColor = ramp.highlight;
        }

        // Elevation Slicing & Atmospheric Depth Tinting (Phase 3)
        if (this.activeElevationSlice > 0) {
          const myTier = isWater ? 0 : tiers[idx];
          if (myTier > this.activeElevationSlice) {
            // Sliced away higher tier: subtle dark blueprint contour
            const isBorder = (shadowFlags & 4) !== 0;
            pixelColor = isBorder ? 0xff4d352a : 0xff241814;
          } else {
            const tierDrop = this.activeElevationSlice - myTier;
            if (tierDrop > 0) {
              pixelColor = applyAtmosphericHaze(pixelColor, tierDrop);
            }
          }
        }

        this.terrainData32[idx] = pixelColor;
      }
    }

    this.terrainCtx.putImageData(this.terrainImgData, 0, 0);
    this.terrainGenerated = true;
    this.lastTerrainVersion = curTerrainVer;
    this.lastTerrainRef = terrain;
    this.lastElevationRef = elevation;
  }

  public getTerraceData(): TerraceData {
    return this.terraceData;
  }

  public getWallOccupancyMask(): Uint8Array {
    return this.wallOccupancyMask;
  }

  public getActiveElevationSlice(): number {
    return this.activeElevationSlice;
  }

  public setActiveElevationSlice(tier: number): void {
    const next = Math.max(0, Math.min(5, tier | 0));
    if (this.activeElevationSlice !== next) {
      this.activeElevationSlice = next;
      this.terrainGenerated = false;
    }
  }

  public getTerrainTheme(): TerrainTheme {
    return this.terrainTheme;
  }

  public setTerrainTheme(theme: TerrainTheme): void {
    if (this.terrainTheme === theme) return;
    this.terrainTheme = theme;
    this.terrainAtlas = createTerrainAtlas(theme);
    this.terrainGenerated = false; // Forces regeneration of the 256x256 cache
  }

  /**
   * Dwarf Fortress Steam-Style 8x8 Pixel-Art Terrain Renderer.
   * At close zoom (cellSize >= ZOOM_SPRITE_THRESHOLD), draws procedural 8x8 tiles with
   * 4 organic variations per biome, stepped z-level cliff strata, and shoreline foam fringes.
   */
  private renderTerrainTiles(screenW: number, screenH: number, worldW: number, worldH: number): void {
    const cs = this.cellSize;
    const minCellX = this.wrapX ? Math.floor(-this.panX / cs) - 1 : Math.max(0, Math.floor(-this.panX / cs) - 1);
    const maxCellX = this.wrapX ? Math.ceil((screenW - this.panX) / cs) + 1 : Math.min(worldW - 1, Math.ceil((screenW - this.panX) / cs) + 1);
    const minCellY = this.wrapY ? Math.floor(-this.panY / cs) - 1 : Math.max(0, Math.floor(-this.panY / cs) - 1);
    const maxCellY = this.wrapY ? Math.ceil((screenH - this.panY) / cs) + 1 : Math.min(worldH - 1, Math.ceil((screenH - this.panY) / cs) + 1);

    const waterArr = this.world.elevation?.water;
    const coverArr = this.world.terrain?.cover;
    const deepThreshold = Math.floor((this.world.config.elevationDeepThreshold ?? 0.2) * 255);
    const tiers = this.terraceData.tiers;
    const atlas = this.terrainAtlas;
    const canvas = atlas.canvas;
    const activeSlice = this.activeElevationSlice;

    for (let cy = minCellY; cy <= maxCellY; cy++) {
      if (!this.wrapY && (cy < 0 || cy >= worldH)) continue;
      const wy = ((cy % worldH) + worldH) % worldH;
      const rowOffset = wy * worldW;
      const y0 = cy * cs + this.panY;

      for (let cx = minCellX; cx <= maxCellX; cx++) {
        if (!this.wrapX && (cx < 0 || cx >= worldW)) continue;
        const wx = ((cx % worldW) + worldW) % worldW;
        const idx = rowOffset + wx;
        const x0 = cx * cs + this.panX;

        const isWater = waterArr ? waterArr[idx] > 0 : false;
        const tier = isWater ? 0 : tiers[idx];

        // Elevation Slicing: if higher than sliced tier, draw subtle blueprint contour and skip full tile
        if (activeSlice > 0 && tier > activeSlice) {
          this.ctx.fillStyle = '#141824';
          this.ctx.fillRect(x0, y0, cs, cs);
          this.ctx.strokeStyle = '#2a354d';
          this.ctx.strokeRect(x0 + 0.5, y0 + 0.5, cs - 1, cs - 1);
          continue;
        }

        // Deterministic pseudo-random variation hash by cell coordinate
        const h = (((wx * 374761393) ^ (wy * 668265263)) >>> 0);
        // Variant 0 (clean solid base sod) is 94% dominant for restful visual field and figure pop; variants 1..3 are rare accents (2% each)
        const roll = h % 100;
        const variant = roll < 94 ? 0 : roll < 96 ? 1 : roll < 98 ? 2 : 3;

        let kind = T_GRASS;

        if (isWater) {
          const depth = waterArr ? waterArr[idx] : 128;
          kind = depth >= deepThreshold ? T_OCEAN : T_SHALLOWS;
        } else {
          const xPrev = (wx - 1 + worldW) % worldW;
          const xNext = (wx + 1) % worldW;
          const yPrev = (wy - 1 + worldH) % worldH;
          const yNext = (wy + 1) % worldH;
          const nearWater =
            waterArr &&
            (waterArr[rowOffset + xPrev] > 0 ||
              waterArr[rowOffset + xNext] > 0 ||
              waterArr[yPrev * worldW + wx] > 0 ||
              waterArr[yNext * worldW + wx] > 0);

          if (nearWater || tier <= 1) {
            kind = T_SAND;
          } else if (tier === 5) {
            kind = T_SNOW;
          } else if (tier === 4) {
            kind = T_ROCK;
          } else if (tier === 3) {
            const cover = coverArr ? coverArr[idx] / 65535 : 0.4;
            kind = cover >= 0.55 ? T_DIRT : T_GRASS;
          } else {
            kind = T_GRASS;
          }
        }

        const sx = atlas.getTileX(kind, variant);
        const sy = atlas.getTileY(kind);

        this.ctx.drawImage(canvas, sx, sy, 8, 8, x0, y0, cs, cs);

        // Stepped Z-Level Cliff Strata (South / East / West drops)
        if (!isWater && tier > 1) {
          const sWy = (wy + 1) % worldH;
          const sTier = tiers[sWy * worldW + wx];
          const sWater = waterArr ? waterArr[sWy * worldW + wx] > 0 : false;
          const dropSouth = tier > sTier || sWater;

          const eWx = (wx + 1) % worldW;
          const eTier = tiers[wy * worldW + eWx];
          const eWater = waterArr ? waterArr[wy * worldW + eWx] > 0 : false;
          const dropEast = tier > eTier || eWater;

          const wWx = (wx + worldW - 1) % worldW;
          const wTier = tiers[wy * worldW + wWx];
          const wWater = waterArr ? waterArr[wy * worldW + wWx] > 0 : false;
          const dropWest = tier > wTier || wWater;

          if (dropSouth && dropEast) {
            this.ctx.drawImage(canvas, atlas.getCliffX(CLIFF_SE), atlas.getCliffY(), 8, 8, x0, y0, cs, cs);
          } else if (dropSouth && dropWest) {
            this.ctx.drawImage(canvas, atlas.getCliffX(CLIFF_SW), atlas.getCliffY(), 8, 8, x0, y0, cs, cs);
          } else if (dropSouth) {
            this.ctx.drawImage(canvas, atlas.getCliffX(CLIFF_S), atlas.getCliffY(), 8, 8, x0, y0, cs, cs);
          } else if (dropEast) {
            this.ctx.drawImage(canvas, atlas.getCliffX(CLIFF_E), atlas.getCliffY(), 8, 8, x0, y0, cs, cs);
          } else if (dropWest) {
            this.ctx.drawImage(canvas, atlas.getCliffX(CLIFF_W), atlas.getCliffY(), 8, 8, x0, y0, cs, cs);
          }
        }

        // Shoreline wave foam fringe on water adjacent to land
        if (isWater && waterArr) {
          const nWy = (wy + worldH - 1) % worldH;
          const sWy = (wy + 1) % worldH;
          const wWx = (wx + worldW - 1) % worldW;
          const eWx = (wx + 1) % worldW;
          if (waterArr[nWy * worldW + wx] === 0) {
            this.ctx.drawImage(canvas, atlas.getFoamX(FOAM_N), atlas.getFoamY(), 8, 8, x0, y0, cs, cs);
          }
          if (waterArr[sWy * worldW + wx] === 0) {
            this.ctx.drawImage(canvas, atlas.getFoamX(FOAM_S), atlas.getFoamY(), 8, 8, x0, y0, cs, cs);
          }
          if (waterArr[wy * worldW + wWx] === 0) {
            this.ctx.drawImage(canvas, atlas.getFoamX(FOAM_W), atlas.getFoamY(), 8, 8, x0, y0, cs, cs);
          }
          if (waterArr[wy * worldW + eWx] === 0) {
            this.ctx.drawImage(canvas, atlas.getFoamX(FOAM_E), atlas.getFoamY(), 8, 8, x0, y0, cs, cs);
          }
        }

        // Atmospheric haze overlay if lower than active slice
        if (activeSlice > 0 && tier < activeSlice) {
          const hazeAlpha = Math.min(0.65, (activeSlice - tier) * 0.15);
          this.ctx.fillStyle = `rgba(56, 74, 102, ${hazeAlpha.toFixed(2)})`;
          this.ctx.fillRect(x0, y0, cs, cs);
        }
      }
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Oblique (3/4 top-down) objects, zoomed in.
  //
  // Every object that stands on the land (trees, stumps, caves, fires, nests, heaps, granaries,
  // animals, carcasses, people) is first collected as a small record in preallocated typed arrays,
  // then sorted by the screen y of its base and painted back to front, so a tall object overlaps the
  // tiles behind it and is overlapped by whatever stands in front. Ground marks (fish glints, the
  // warm glow of a fire) get a very low key and are painted first. Nothing here touches the sim.
  // ---------------------------------------------------------------------------------------------

  private ensureDrawables(n: number): boolean {
    if (n <= this.dCap) return true;
    if (n > MAX_DRAWABLES) return false;
    let cap = this.dCap;
    while (cap < n) cap *= 2;
    cap = Math.min(cap, MAX_DRAWABLES);
    const kind = new Uint8Array(cap); kind.set(this.dKind);
    const x = new Int32Array(cap); x.set(this.dX);
    const y = new Int32Array(cap); y.set(this.dY);
    const a = new Int32Array(cap); a.set(this.dA);
    const b = new Int32Array(cap); b.set(this.dB);
    this.dKind = kind; this.dX = x; this.dY = y; this.dA = a; this.dB = b;
    this.dKeys = new Float64Array(cap);
    this.dCap = cap;
    return true;
  }

  /** Adds one drawable; `keyDy` is the base line below `y` (or an absolute key when very negative). */
  private push(kind: number, x: number, y: number, a: number, b: number, keyDy: number): void {
    const n = this.dCount;
    if (n >= this.dCap && !this.ensureDrawables(n + 1)) return;
    this.dKind[n] = kind;
    this.dX[n] = x;
    this.dY[n] = y;
    this.dA[n] = a;
    this.dB[n] = b;
    const keyY = keyDy <= GROUND_KEY ? GROUND_KEY : y + keyDy;
    this.dKeys[n] = (keyY + KEY_BIAS) * KEY_STRIDE + n;
    this.dCount = n + 1;
  }

  /** Pushes every on-screen copy of a world-space spot given in screen pixels. Single bounded world view. */
  private emitAt(
    kind: number, px: number, py: number, a: number, b: number, keyDy: number,
    screenW: number, screenH: number, worldPxW: number, worldPxH: number
  ): void {
    const cs = this.cellSize;
    if (this.wrapX || this.wrapY) {
      let sx = px;
      while (sx > -cs) sx -= worldPxW;
      while (sx < -cs) sx += worldPxW;
      let sy = py;
      while (sy > -2 * cs) sy -= worldPxH;
      while (sy < -2 * cs) sy += worldPxH;
      for (let x0 = sx; x0 < screenW + cs; x0 += worldPxW) {
        for (let y0 = sy; y0 < screenH + cs; y0 += worldPxH) {
          this.push(kind, x0, y0, a, b, keyDy);
        }
      }
    } else {
      if (px >= -cs * 2 && px <= screenW + cs * 2 && py >= -cs * 2 && py <= screenH + cs * 2) {
        this.push(kind, px, py, a, b, keyDy);
      }
    }
  }

  /** Collects everything and paints it back to front. Called only when zoomed in. */
  private renderObjects(screenW: number, screenH: number, worldW: number, worldH: number): void {
    this.dCount = 0;
    const cs = this.cellSize;
    this.ap = cs / 8;
    const q = (v: number): number => Math.round(v * this.ap);
    this.flick = Math.floor(performance.now() / 120);
    this.hasSel = false;
    const worldPxW = worldW * cs;
    const worldPxH = worldH * cs;

    this.collectCells(screenW, screenH, worldW, worldH);
    this.collectFeatures(screenW, screenH, worldPxW, worldPxH, q);
    this.collectAnimals(screenW, screenH, worldPxW, worldPxH, q);
    this.collectPeople(screenW, screenH, worldW, worldH, worldPxW, worldPxH);

    const n = this.dCount;
    if (n > 0) {
      const keys = this.dKeys.subarray(0, n);
      keys.sort(); // numeric ascending for typed arrays: base y, ties in the order collected
      for (let j = 0; j < n; j++) {
        const k = keys[j];
        const i = k - Math.floor(k / KEY_STRIDE) * KEY_STRIDE;
        this.drawOne(i);
      }
    }
    if (this.hasSel) this.drawSelectionIndicator(this.selX, this.selY, cs, performance.now(), true);
  }

  /** Trees, stumps, heaps, granaries, nests and fish, one pass over the visible cells. */
  private collectCells(screenW: number, screenH: number, worldW: number, worldH: number): void {
    const cs = this.cellSize;
    const q = (v: number): number => Math.round(v * this.ap);
    const minCellX = this.wrapX ? Math.floor(-this.panX / cs) - 1 : Math.max(0, Math.floor(-this.panX / cs) - 1);
    const maxCellX = this.wrapX ? Math.ceil((screenW - this.panX) / cs) + 1 : Math.min(worldW - 1, Math.ceil((screenW - this.panX) / cs) + 1);
    const minCellY = this.wrapY ? Math.floor(-this.panY / cs) - 1 : Math.max(0, Math.floor(-this.panY / cs) - 1);
    const maxCellY = this.wrapY ? Math.ceil((screenH - this.panY) / cs) + 1 : Math.min(worldH - 1, Math.ceil((screenH - this.panY) / cs) + 1);
    const structures = this.world.landStructures;
    const water = this.world.elevation?.water;
    const treeKey = cs;
    const lowKey = q(2);
    const nestKey = q(6);
    const stumpKey = q(5);

    for (let cy = minCellY; cy <= maxCellY; cy++) {
      const wy = ((cy % worldH) + worldH) % worldH;
      const rowOffset = wy * worldW;
      const y0 = cy * cs + this.panY;
      for (let cx = minCellX; cx <= maxCellX; cx++) {
        const wx = ((cx % worldW) + worldW) % worldW;
        const idx = rowOffset + wx;
        const x0 = cx * cs + this.panX;
        const st = structures ? structures[idx] : 0;

        if (water && water[idx] > 0) {
          // Fish markers lie on the water: flat, painted with the ground.
          if (st > 0) this.push(D_FISH, x0, y0, st, wx | (wy << 8), GROUND_KEY);
          continue;
        }

        const level = st & 7;
        const form = (st >> 3) & 3;
        const forest = this.isForest[idx] === 1;
        const thin = st >> 5;

        if (forest) {
          if (thin === 6 && form === 0 && level === 0) {
            this.push(D_STUMPS, x0, y0, st, wx | (wy << 8), stumpKey);
            continue;
          }
          // Felled woodland: trees thin out with the cutting and are gone on stumps and open field.
          if (!(thin >= 6 || (thin > 0 && ((wx * 13 + wy * 7) % 6) < thin))) {
            this.push(D_TREE, x0, y0, (wx * 37 + wy * 89) % 3, 0, treeKey);
          }
        }
        if (st === 0) continue;
        const brush = !forest && form === 1 && level === 0 && thin > 0;
        if (form >= 2 || level > 0 || brush) {
          this.push(D_STRUCT, x0, y0, st, wx | (wy << 8) | (forest ? 1 << 16 : 0),
            forest ? treeKey + 1 : form === 3 ? nestKey : lowKey);
        }

        // Ripe golden crops: standing wheat/barley stalks swaying on worked farmland
        const overlay = this.world.landOverlay;
        if (overlay && !forest && (st === 0 || (form === 1 && level === 0))) {
          const b = overlay[idx];
          const seedLevel = b >> 6;
          if (seedLevel === 3) {
            // Full ripe golden wheat stalks
            this.push(D_CROPS, x0, y0, 3, wx | (wy << 8), lowKey);
          } else if (seedLevel === 1) {
            // Younger growing amber shoots
            this.push(D_CROPS, x0, y0, 1, wx | (wy << 8), lowKey);
          }
        }
      }
    }
  }

  /** Caves and fires. A fire also pushes its glow, a ground mark with the lowest key. */
  private collectFeatures(
    screenW: number, screenH: number, worldPxW: number, worldPxH: number, q: (v: number) => number
  ): void {
    const feats = this.world.featurePositions;
    if (!feats || feats.length < 3) return;
    const cs = this.cellSize;
    populateWallSpatialMask(feats, this.wallOccupancyMask);
    for (let i = 0; i + 2 < feats.length; i += 3) {
      const kind = feats[i + 2];
      const px = Math.round(feats[i] * cs + this.panX);
      const py = Math.round(feats[i + 1] * cs + this.panY);
      const fl = (this.flick + feats[i] * 7 + feats[i + 1] * 13) & 3;
      if (kind >= 16) {
        this.emitAt(D_CAVE, px, py, kind - 16, 0, q(5.5), screenW, screenH, worldPxW, worldPxH);
      } else if (kind >= 8 && kind < 12) {
        const mask = getWallBitmask(this.wallOccupancyMask, feats[i], feats[i + 1]);
        this.emitAt(D_HUT, px, py, mask, 0, GROUND_KEY + 1, screenW, screenH, worldPxW, worldPxH);
      } else if (kind === 5) {
        this.emitAt(D_GRAVE, px, py, 0, 0, q(6.2), screenW, screenH, worldPxW, worldPxH);
      } else {
        this.emitAt(D_GLOW, px, py, fl, 0, GROUND_KEY, screenW, screenH, worldPxW, worldPxH);
        this.emitAt(D_FIRE, px, py, fl, 0, q(7.2), screenW, screenH, worldPxW, worldPxH);
      }
    }
  }

  /** Herd animals, wolves and fresh kills. */
  private collectAnimals(
    screenW: number, screenH: number, worldPxW: number, worldPxH: number, q: (v: number) => number
  ): void {
    const cs = this.cellSize;
    const worldW = 256;
    const worldH = 256;
    const now = performance.now();
    const t =
      this.world.running === false
        ? 1.0
        : Math.min(1.0, (now - this.lastFrameTime) / this.frameInterval);

    // 1. Carcasses (static on ground)
    const carcasses = this.world.carcassPositions;
    if (carcasses) {
      for (let i = 0; i + 1 < carcasses.length; i += 2) {
        this.emitAt(
          D_CARCASS,
          Math.round(carcasses[i] * cs + this.panX), Math.round(carcasses[i + 1] * cs + this.panY),
          0, carcasses[i] | (carcasses[i + 1] << 8), q(6),
          screenW, screenH, worldPxW, worldPxH
        );
      }
    }

    // 2. Wolves (interpolated, motion heading, trotting gait)
    for (let k = 0; k < this.wolfCount; k++) {
      let dx = this.currWolfX[k] - this.prevWolfX[k];
      if (dx > worldW / 2) dx -= worldW; else if (dx < -worldW / 2) dx += worldW;
      let dy = this.currWolfY[k] - this.prevWolfY[k];
      if (dy > worldH / 2) dy -= worldH; else if (dy < -worldH / 2) dy += worldH;

      let rx = this.prevWolfX[k] + dx * t;
      if (rx < 0) rx += worldW; else if (rx >= worldW) rx -= worldW;
      let ry = this.prevWolfY[k] + dy * t;
      if (ry < 0) ry += worldH; else if (ry >= worldH) ry -= worldH;

      const isMoving = Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01;
      const frame = isMoving ? ((Math.floor(rx * 2 + ry * 2) & 1) === 0 ? 1 : 2) : 0;
      const face = this.wolfFacing[k] === 1;

      this.emitAt(
        D_WOLF,
        Math.round(rx * cs + this.panX), Math.round(ry * cs + this.panY),
        (face ? 1 : 0) | (frame << 1), Math.round(rx) | (Math.round(ry) << 8), q(7.2),
        screenW, screenH, worldPxW, worldPxH
      );
    }

    // 3. Deer (interpolated, motion heading, trotting gait)
    for (let k = 0; k < this.deerCount; k++) {
      let dx = this.currDeerX[k] - this.prevDeerX[k];
      if (dx > worldW / 2) dx -= worldW; else if (dx < -worldW / 2) dx += worldW;
      let dy = this.currDeerY[k] - this.prevDeerY[k];
      if (dy > worldH / 2) dy -= worldH; else if (dy < -worldH / 2) dy += worldH;

      let rx = this.prevDeerX[k] + dx * t;
      if (rx < 0) rx += worldW; else if (rx >= worldW) rx -= worldW;
      let ry = this.prevDeerY[k] + dy * t;
      if (ry < 0) ry += worldH; else if (ry >= worldH) ry -= worldH;

      const isMoving = Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01;
      const frame = isMoving ? ((Math.floor(rx * 2 + ry * 2) & 1) === 0 ? 1 : 2) : 0;
      const face = this.deerFacing[k] === 1;

      this.emitAt(
        D_DEER,
        Math.round(rx * cs + this.panX), Math.round(ry * cs + this.panY),
        (face ? 1 : 0) | (frame << 1), Math.round(rx) | (Math.round(ry) << 8), q(7.2),
        screenW, screenH, worldPxW, worldPxH
      );
    }
  }

  /** People: feet on the lower part of their tile, sorted by the y of the feet. */
  private collectPeople(
    screenW: number, screenH: number, worldW: number, worldH: number, worldPxW: number, worldPxH: number
  ): void {
    if (this.activeCount === 0) return;
    const now = performance.now();
    const t =
      this.world.running === false
        ? 1.0
        : Math.min(1.0, (now - this.lastFrameTime) / this.frameInterval);
    const cs = this.cellSize;
    const water = this.world.elevation?.water;

    for (let i = 0; i < this.activeCount; i++) {
      const slot = this.activeSlots[i];
      let dx = this.currX[slot] - this.prevX[slot];
      if (dx > worldW / 2) dx -= worldW;
      else if (dx < -worldW / 2) dx += worldW;
      let dy = this.currY[slot] - this.prevY[slot];
      if (dy > worldH / 2) dy -= worldH;
      else if (dy < -worldH / 2) dy += worldH;

      let rx = this.prevX[slot] + dx * t;
      if (rx < 0) rx += worldW;
      else if (rx >= worldW) rx -= worldW;
      let ry = this.prevY[slot] + dy * t;
      if (ry < 0) ry += worldH;
      else if (ry >= worldH) ry -= worldH;

      // Deterministic sub-tile offset from the slot so people sharing a cell don't stack
      const hVal = (slot * 2654435761) >>> 0;
      let offX = ((hVal & 7) - 3.5) / 10;
      let offY = (((hVal >>> 3) & 7) - 3.5) / 10;
      if (water) {
        // Beside water the figure stays on its own tile instead of spilling onto the water.
        const ccx = Math.round(rx) & 255, ccy = Math.round(ry) & 255;
        if (offX > 0 && water[(ccy << 8) | ((ccx + 1) & 255)] > 0) offX = 0;
        else if (offX < 0 && water[(ccy << 8) | ((ccx - 1) & 255)] > 0) offX = 0;
        if (offY > 0 && water[(((ccy + 1) & 255) << 8) | ccx] > 0) offY = 0;
        else if (offY < 0 && water[(((ccy - 1) & 255) << 8) | ccx] > 0) offY = 0;
      }

      // Feet at the middle of the tile, a little below its centre
      const baseX = Math.round((rx + offX) * cs + this.panX + cs * 0.5);
      const baseY = Math.round((ry + offY) * cs + this.panY + cs * 0.85);

      if (slot === this.selectedSlot) {
        let sx = baseX;
        if (this.wrapX) {
          while (sx > -cs) sx -= worldPxW;
          while (sx < -cs) sx += worldPxW;
        }
        let sy = baseY;
        if (this.wrapY) {
          while (sy > -2 * cs) sy -= worldPxH;
          while (sy < -2 * cs) sy += worldPxH;
        }
        this.selX = sx;
        this.selY = sy;
        this.hasSel = true;
      }

      let facing = this.personFacing[slot];
      if (dx > 0.005) {
        facing = 1;
        this.personFacing[slot] = 1;
      } else if (dx < -0.005) {
        facing = 0;
        this.personFacing[slot] = 0;
      }

      const isMoving = Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01;
      const frame = isMoving ? ((Math.floor(rx * 2 + ry * 2) & 1) === 0 ? 1 : 2) : 0;
      this.emitAt(D_PERSON, baseX, baseY, slot, frame | (facing << 2), 0, screenW, screenH, worldPxW, worldPxH);
    }
  }

  private drawOne(i: number): void {
    const x0 = this.dX[i];
    const y0 = this.dY[i];
    const a = this.dA[i];
    const b = this.dB[i];
    switch (this.dKind[i]) {
      case D_TREE: this.drawTree(x0, y0, a); break;
      case D_STUMPS: this.drawStumps(x0, y0, b & 255, b >> 8); break;
      case D_STRUCT: this.drawStructure(x0, y0, a, b & 255, (b >> 8) & 255, (b >> 16) === 1); break;
      case D_FISH: this.drawFish(x0, y0, a, b & 255, (b >> 8) & 255); break;
      case D_CAVE: this.drawCave(x0, y0, a); break;
      case D_GLOW: this.drawGlow(x0, y0, a); break;
      case D_FIRE: this.drawFire(x0, y0, a); break;
      case D_HUT: drawCutawayWall(this.ctx, x0, y0, this.cellSize, a); break;
      case D_GRAVE: this.drawGrave(x0, y0); break;
      case D_CARCASS: this.drawCarcass(x0, y0, b & 255, b >> 8); break;
      case D_WOLF: this.drawWolf(x0, y0, (a & 1) === 1, a >> 1); break;
      case D_DEER: this.drawDeer(x0, y0, (a & 1) === 1, a >> 1); break;
      case D_PERSON: this.drawPerson(x0, y0, a, b); break;
      case D_DETAIL: this.drawDetail(x0, y0, a, b); break;
      case D_CROPS: this.drawCropStalks(x0, y0, a, b & 255, b >> 8); break;
    }
  }

  /** One rectangle in art-pixels (8 per tile) from the tile origin; rounded at both edges so there are no gaps. */
  private R(x0: number, y0: number, u: number, v: number, w: number, h: number, c: string): void {
    const ap = this.ap;
    const x = x0 + Math.round(u * ap);
    const y = y0 + Math.round(v * ap);
    this.ctx.fillStyle = c;
    this.ctx.fillRect(
      x, y,
      Math.max(1, x0 + Math.round((u + w) * ap) - x),
      Math.max(1, y0 + Math.round((v + h) * ap) - y)
    );
  }

  private drawTree(x0: number, y0: number, variant: number): void {
    const spr = this.treeSprites[variant];
    const ap = this.ap;
    // Base of the trunk sits on the bottom edge of the tile; the canopy rises into the tile above.
    const dx = Math.round(x0 + this.cellSize * 0.5 - spr.anchorX * ap);
    const dy = Math.round(y0 + this.cellSize - spr.anchorY * ap);
    this.ctx.drawImage(
      this.atlas.canvas, spr.x, spr.y, spr.w, spr.h,
      dx, dy, Math.round(spr.w * ap), Math.round(spr.h * ap)
    );
  }

  private drawPerson(fx: number, fy: number, slot: number, packed: number): void {
    const frame = packed & 3;
    const facing = (packed >> 2) & 1;
    const look = this.lookBytes[slot];
    const sex = (look & LOOK_SEX_MASK) === 1 ? 0 : 1; // male, female
    const pregnant = (look & LOOK_PREGNANT_MASK) !== 0;
    const stage = (look & LOOK_STAGE_MASK) >> 2;
    const energyLevel = (look & LOOK_ENERGY_MASK) >> 4;
    // Same precedence as ever: starving, pregnant, child, elder, then plain male or female.
    let type = sex;
    if (energyLevel <= 1) type = 5;
    else if (pregnant) type = 2;
    else if (stage === LOOK_STAGE_CHILD) type = 3;
    else if (stage === LOOK_STAGE_ELDER) type = 4;
    const spr = this.personSprites[type * 3 + frame];
    const ap = this.ap;

    if (this.colorMode === 'bands') {
      // A band-coloured disc flat on the ground under the feet
      const rId = this.rootLeaderIds[slot];
      this.ctx.fillStyle =
        (this.bandSizes.get(rId) ?? 0) <= 1 ? '#888888' : hashRootLeaderToHex(rId);
      this.ctx.beginPath();
      this.ctx.ellipse(fx, fy - ap, Math.max(3, 3.5 * ap), Math.max(2, 1.8 * ap), 0, 0, Math.PI * 2);
      this.ctx.fill();
    }

    if (facing === 0) {
      this.ctx.save();
      this.ctx.translate(Math.round(fx), 0);
      this.ctx.scale(-1, 1);
      this.ctx.drawImage(
        this.atlas.canvas, spr.x, spr.y, spr.w, spr.h,
        -Math.round(spr.anchorX * ap), Math.round(fy - spr.anchorY * ap),
        Math.round(spr.w * ap), Math.round(spr.h * ap)
      );
      this.ctx.restore();
    } else {
      this.ctx.drawImage(
        this.atlas.canvas, spr.x, spr.y, spr.w, spr.h,
        Math.round(fx - spr.anchorX * ap), Math.round(fy - spr.anchorY * ap),
        Math.round(spr.w * ap), Math.round(spr.h * ap)
      );
    }

    // Band Leader Star: gently bobbing golden star hovering above the head
    const isLeader =
      this.rootLeaderIds[slot] === ((((slot & 0xfffff) << 12) | (this.slotGenerations[slot] & 0xfff)) >>> 0) &&
      (this.bandSizes.get(this.rootLeaderIds[slot]) ?? 0) > 1;

    if (isLeader) {
      const starSpr = this.atlas.getSprite('star_leader');
      const bounce = Math.sin(this.lastRenderTimestamp * 0.006 + slot) * 2;
      const starScale = Math.max(1, Math.round(ap * 0.85));
      const starW = starSpr.w * starScale;
      const starH = starSpr.h * starScale;
      const starX = Math.round(fx - starSpr.anchorX * starScale);
      const starY = Math.round(fy - spr.anchorY * ap - starH * 0.65 + bounce);
      this.ctx.drawImage(
        this.atlas.canvas, starSpr.x, starSpr.y, starSpr.w, starSpr.h,
        starX, starY, starW, starH
      );
    }
  }

  /**
   * Close-zoom micro-accents (cs >= 10) on open ground:
   * subtle wildflower, blade of grass, pebble, or chisel notch.
   */
  private drawDetail(x0: number, y0: number, tier: number, hh: number): void {
    const u = ((hh >>> 3) & 3) + 2;
    const v = ((hh >>> 5) & 3) + 2;
    if (tier === 2) {
      // Grass tier: wildflower or blade tip
      const c = (hh & 16) === 0 ? '#facc15' : PALETTE.grass.highlightHex;
      this.R(x0, y0, u, v, 1, 1, c);
    } else if (tier === 1) {
      // Sand tier: pebble
      this.R(x0, y0, u, v, 1, 1, PALETTE.sand.shadowHex);
    } else if (tier >= 4) {
      // Rock/mountain tier: stone notch
      this.R(x0, y0, u, v, 1, 1, PALETTE.rock.highlightHex);
    }
  }

  /**
   * Standing wheat/barley stalks on cultivated land.
   * Renders natural clusters of vertical cereal stems with drooping ripe golden heads,
   * gentle wind sway, and fine grain awns so ripe plots read unmistakably as wheat fields.
   */
  private drawCropStalks(x0: number, y0: number, ripeness: number, wx: number, wy: number): void {
    const isRipe = ripeness === 3;
    const count = isRipe ? 5 : 3;
    const t = performance.now() / 900;

    // Golden harvest grain tones
    const stalkColor = isRipe ? '#b8860b' : '#9a9438';     // dark goldenrod / olive green stem
    const earColor = isRipe ? '#ffd700' : '#d4af37';       // bright ripe golden yellow / amber
    const awnHighlight = isRipe ? '#fff3a8' : '#e6cc70';   // sunlit golden wheat tip
    const stalkShadow = '#785408';

    for (let k = 0; k < count; k++) {
      const h = ((wx * 1973 + wy * 9277 + k * 8461) >>> 0);
      // Base root position within the 8x8 tile: furrows spaced across the tile
      const baseX = 1.0 + (k * 1.3) + (((h >> 3) & 7) * 0.12);
      const baseY = 6.2 + (((h >> 6) & 3) * 0.35);

      // Height of this stalk: 3.2 to 4.8 art-pixels tall
      const stalkH = isRipe ? (3.8 + ((h & 7) * 0.15)) : (2.4 + ((h & 3) * 0.2));

      // Wind sway offset: organic gentle breeze
      const phase = (wx * 0.7 + wy * 0.5 + k * 1.1);
      const sway = Math.sin(t + phase) * (isRipe ? 0.35 : 0.2);

      const topX = baseX + sway;
      const topY = baseY - stalkH;

      // 1. Slender vertical stalk stem
      this.R(x0, y0, baseX + sway * 0.3, topY + 1.2, 0.45, stalkH - 1.2, stalkColor);
      this.R(x0, y0, baseX + sway * 0.3 + 0.45, topY + 2.0, 0.3, stalkH - 2.0, stalkShadow);

      // 2. Grain head (ear of wheat): plump oval grain cluster
      const earH = isRipe ? 1.8 : 1.2;
      const earW = isRipe ? 0.95 : 0.7;
      this.R(x0, y0, topX - 0.25, topY, earW, earH, earColor);
      this.R(x0, y0, topX - 0.25, topY, earW * 0.5, earH * 0.7, awnHighlight);

      // 3. Bristling wheat awns (whiskers at top of ear)
      if (isRipe && this.cellSize >= 8) {
        this.R(x0, y0, topX - 0.4, topY - 0.7, 0.35, 0.8, awnHighlight);
        this.R(x0, y0, topX + 0.3, topY - 0.6, 0.35, 0.7, awnHighlight);
      }
    }
  }

  /** Fish: one little silver fish on about half the shore tiles, held still by cell. Flat on the water. */
  private drawFish(x0: number, y0: number, st: number, wx: number, wy: number): void {
    const hh = (wx * 97 + wy * 57) & 15;
    // Sparse: one at most, and a thin stock (level 1 to 2) shows fewer.
    if (!((hh & 1) === 0 && (st >= 3 || (hh & 2) === 0))) return;
    const sx = (hh % 5) + 1;
    const sy = ((hh >> 1) % 5) + 1;
    const left = (hh & 1) === 0;
    this.R(x0, y0, sx, sy, 2.2, 1, '#e8f2f0'); // body
    this.R(x0, y0, sx, sy, 2.2, 0.4, '#8fb4c4'); // back
    this.R(x0, y0, left ? sx + 2.2 : sx - 0.8, sy - 0.3, 0.8, 1.6, '#e8f2f0'); // tail
    this.R(x0, y0, left ? sx + 0.3 : sx + 1.7, sy + 0.2, 0.4, 0.4, '#1c3a4a'); // eye
  }

  /**
   * Stumps: cut trunks with pale tops, three to a cell, placed by cell so they hold still.
   * Each is a short drum: lit top, shaded right side, shadow to the south-east. Drawn back to front.
   */
  private drawStumps(x0: number, y0: number, wx: number, wy: number): void {
    const h = (wx * 73 + wy * 151) & 7;
    let i0 = h % 5, i1 = (h + 2) % 5, i2 = (h + 4) % 5;
    let t: number;
    if (STUMP_SPOTS[i0][1] > STUMP_SPOTS[i1][1]) { t = i0; i0 = i1; i1 = t; }
    if (STUMP_SPOTS[i1][1] > STUMP_SPOTS[i2][1]) { t = i1; i1 = i2; i2 = t; }
    if (STUMP_SPOTS[i0][1] > STUMP_SPOTS[i1][1]) { t = i0; i0 = i1; i1 = t; }
    for (let k = 0; k < 3; k++) {
      const s = STUMP_SPOTS[k === 0 ? i0 : k === 1 ? i1 : i2];
      const sx = s[0], sy = s[1];
      this.R(x0, y0, sx + 0.7, sy + 2.0, 2.4, 0.8, SHADOW);
      this.R(x0, y0, sx, sy + 0.8, 2, 1.5, '#4a2e14'); // side
      this.R(x0, y0, sx + 1.4, sy + 0.8, 0.6, 1.5, '#35200e'); // shaded right
      this.R(x0, y0, sx, sy, 2, 1, '#d8b878'); // top
      this.R(x0, y0, sx, sy, 0.5, 1, '#ecd08c'); // lit left edge
      this.R(x0, y0, sx + 0.7, sy + 0.3, 0.7, 0.4, '#b08848'); // rings
    }
  }

  /** Glow of a burning fire: two flat warm ellipses on the ground that breathe with the flame. */
  private drawGlow(x0: number, y0: number, fl: number): void {
    const cs = this.cellSize;
    const ctx = this.ctx;
    const cx = x0 + cs * 0.5;
    const cy = y0 + this.ap * 6.6;
    ctx.fillStyle = (fl & 1) ? 'rgba(255, 170, 60, 0.17)' : 'rgba(255, 170, 60, 0.13)';
    ctx.beginPath();
    ctx.ellipse(cx, cy, cs * 2.6, cs * 1.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 200, 90, 0.14)';
    ctx.beginPath();
    ctx.ellipse(cx, cy, cs * 1.3, cs * 0.75, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  /** A fire seen from the front: ring stones, a crossed log, a flickering flame rising above them. */
  private drawFire(x0: number, y0: number, fl: number): void {
    const f1 = fl & 1;
    const f2 = fl >> 1;
    this.R(x0, y0, 1.8, 7.0, 5.6, 0.9, SHADOW);
    this.R(x0, y0, 0.8, 6.2, 1.2, 1.0, '#8a817c'); // stones, lit on top
    this.R(x0, y0, 0.8, 6.2, 1.2, 0.4, '#bcb8b1');
    this.R(x0, y0, 6.0, 6.2, 1.2, 1.0, '#6d655f');
    this.R(x0, y0, 6.0, 6.2, 1.2, 0.4, '#a39b94');
    this.R(x0, y0, 2.0, 5.5, 4.0, 0.9, '#3a2616'); // back log
    this.R(x0, y0, 2.5 - 0, 3.4 - f1 * 0.6, 3.0, 2.8 + f1 * 0.6, '#d85a10'); // flame
    this.R(x0, y0, 3.4, 2.4 - f2 * 0.5, 1.2, 1.3, '#d85a10'); // tip
    this.R(x0, y0, 3.0, 3.0 - f2 * 0.6, 2.0, 3.2 + f2 * 0.6, '#ffb030');
    this.R(x0, y0, 3.5, 4.4, 1.0, 1.6, '#fff0a0');
    this.R(x0, y0, 1.6, 6.2, 4.8, 1.0, '#4a3020'); // front log
    this.R(x0, y0, 1.6, 6.2, 4.8, 0.4, '#7a5434'); // lit top edge
    this.R(x0, y0, 1.5, 6.3, 0.8, 0.8, '#c8a070'); // cut end
  }

  /** A fresh grave: a low earth mound with a stick cross and a few bones. */
  private drawGrave(x0: number, y0: number): void {
    const R = (u: number, v: number, w: number, h: number, c: string): void => this.R(x0, y0, u, v, w, h, c);
    R(1.6, 7.0, 5.6, 0.8, SHADOW);
    R(1.4, 6.0, 5.2, 1.4, '#6b5238'); R(1.4, 6.0, 5.2, 0.4, '#8a6c4a'); R(5.6, 6.2, 1.0, 1.2, '#4a3624');
    R(3.6, 2.8, 0.7, 3.4, '#cbbd9a'); R(2.6, 3.6, 2.7, 0.6, '#cbbd9a'); R(3.6, 2.8, 0.3, 3.4, '#e6dbbc');
    R(1.8, 6.6, 0.8, 0.4, '#e6dbbc'); R(5.0, 6.8, 0.9, 0.4, '#e6dbbc');
  }

  /**
   * A cave as a rock face: a lit top slab, a front face shaded on the right and at the foot, and the
   * dark mouth on it. East and west facings put the mouth to that side with a shaded jamb so it reads
   * as turned; a north facing hides the mouth behind the ridge, seen as a dark notch in the top slab.
   */
  private drawCave(x0: number, y0: number, f: number): void {
    const R = (u: number, v: number, w: number, h: number, c: string): void => this.R(x0, y0, u, v, w, h, c);
    R(1.6, 6.9, 6.6, 1.1, SHADOW); // cast shadow, south-east
    R(7.4, 3.4, 0.9, 4.4, SHADOW);
    R(0.6, 2.6, 6.8, 5.0, '#7d756f'); // front face
    R(0.6, 7.0, 6.8, 0.6, '#5f5852'); // shaded foot
    R(6.2, 2.6, 1.2, 5.0, '#5f5852'); // shaded right side
    R(0.6, 2.8, 0.8, 4.2, '#948b84'); // lit left edge
    R(1.4, 3.6, 1.0, 0.8, '#948b84'); // boulders on the face
    R(5.0, 3.2, 0.9, 0.8, '#6d655f');
    R(0.8, 1.4, 6.4, 1.4, '#b0a8a0'); // top slab
    R(1.2, 0.6, 5.6, 0.9, '#c8c0b8'); // lit crown
    R(5.6, 1.4, 1.6, 1.4, '#948b84'); // top, shaded to the right
    if (f === 3) {
      // Opening on the far side: only a dark notch over the ridge shows
      R(2.2, 1.0, 3.4, 1.3, '#16110d');
      R(2.6, 1.6, 2.6, 0.7, '#000000');
      R(2.0, 0.7, 3.8, 0.4, '#c8c0b8');
      return;
    }
    const ox = f === 0 ? 4.6 : f === 1 ? 1.0 : 2.6;
    const ow = f === 2 ? 2.8 : 2.0;
    if (f === 0) R(ox - 0.5, 3.6, 0.5, 4.0, '#5f5852'); // jamb on the near side
    else if (f === 1) R(ox + ow, 3.6, 0.5, 4.0, '#5f5852');
    R(ox - 0.3, 3.0, ow + 0.6, 0.6, '#c4bcb4'); // lintel stone catching the light
    R(ox, 4.2, ow, 3.4, '#16110d'); // the mouth
    R(ox + 0.4, 3.6, ow - 0.8, 0.7, '#16110d'); // arched top
    R(ox + 0.5, 5.0, ow - 1.0, 2.6, '#000000'); // deep inside
    R(ox - 0.3, 7.4, ow + 0.6, 0.5, '#9c8764'); // worn earth at the mouth
  }

  /** Nests (a thatched hut), plank granary floors, food heaps and brush heaps, from the structure byte. */
  private drawStructure(x0: number, y0: number, st: number, wx: number, wy: number, forest: boolean): void {
    const level = st & 7;
    const form = (st >> 3) & 3;
    const bLevel = forest ? 0 : st >> 5; // on woodland these bits mean thinning, not a brush heap
    const ap = this.ap;
    const cs = this.cellSize;
    const R = (u: number, v: number, w: number, h: number, c: string): void => this.R(x0, y0, u, v, w, h, c);

    if (form === 3) {
      // Nest / lean-to as a little thatched hut: an A-frame of brush, lit left, shaded right, dark door
      R(1.8, 7.0, 6.4, 1.0, SHADOW);
      for (let r = 0; r < 6; r++) {
        const hw = 0.9 + r * 0.55;
        R(4 - hw, 1.4 + r, hw, 1.0, THATCH_LIT[r & 1]);
        R(4, 1.4 + r, hw, 1.0, THATCH_SHADE[r & 1]);
      }
      R(3.7, 0.6, 0.6, 1.1, '#5a3c1c'); // crossed pole tips
      R(3.1, 4.6, 1.8, 0.5, '#5a3c1c'); // lintel
      R(3.1, 5.1, 1.8, 2.3, '#241608'); // doorway
      return;
    }

    let floorV = 7.4;
    if (form === 2) {
      // Granary: a raised plank platform seen from the front, top lit, front face and posts in shade
      R(1.6, 7.4, 6.8, 0.8, SHADOW);
      R(0.6, 5.6, 6.8, 1.9, '#4a2e14'); // front face
      R(0.6, 6.6, 6.8, 0.9, '#35200e');
      R(0.8, 5.6, 0.6, 1.9, '#5a3a1c'); // posts
      R(6.4, 5.6, 0.6, 1.9, '#35200e');
      R(0.6, 3.2, 6.8, 2.6, '#8a5a30'); // top surface
      R(0.6, 3.2, 6.8, 0.4, '#b07a44');
      R(0.6, 3.2, 0.8, 2.6, '#a36e3c');
      R(0.6, 4.2, 6.8, 0.4, '#6a4220'); // plank seams
      R(0.6, 5.0, 6.8, 0.4, '#6a4220');
      floorV = 5.3;
    }

    if (bLevel > 0 && level === 0 && form === 1) {
      // Brush heap: a loose crisscross of thin sticks, more of them with a bigger heap
      R(1.4, 6.8, 5.6, 0.9, SHADOW);
      const n = Math.min(9, 3 + bLevel);
      const len = Math.max(4, Math.round(cs * 0.55));
      const th = Math.max(1, Math.round(ap * 0.6));
      const ctx = this.ctx;
      for (let k = 0; k < n; k++) {
        const h = ((wx * 73856093) ^ (wy * 19349663) ^ (k * 83492791)) >>> 0;
        const sx = x0 + Math.round(cs * 0.15 + ((h % 1000) / 1000) * cs * 0.5);
        const sy = y0 + Math.round(cs * 0.6 + (((h >> 10) % 1000) / 1000) * cs * 0.3);
        const dir = h & 1 ? 1 : -1;
        const slope = 0.4 + ((h >> 20) & 3) * 0.3;
        ctx.fillStyle = STICK_COLORS[(h >> 22) % STICK_COLORS.length];
        for (let i = 0; i < len; i += th) ctx.fillRect(sx + dir * i, sy - Math.round(i * slope), th, th);
      }
      return;
    }

    if (level > 0) {
      // Food heap: a pyramid of round gathered food, lit top-left, shaded bottom-right, taller and wider with the heap
      const rows = Math.min(4, 1 + Math.ceil(level * 0.45));
      const d = Math.max(2, Math.round(ap * 1.5));
      const floorY = y0 + Math.round(floorV * ap);
      const baseW = (rows + 1) * d;
      if (form !== 2) {
        this.ctx.fillStyle = SHADOW;
        this.ctx.fillRect(x0 + Math.round((cs - baseW) / 2) + d, floorY - Math.round(ap * 0.6), baseW, Math.max(1, Math.round(ap * 1.0)));
      }
      const ctx = this.ctx;
      for (let r = 0; r < rows; r++) {
        const n = rows - r + 1;
        const rx = x0 + Math.round((cs - n * d) / 2);
        const ry = floorY - (r + 1) * d;
        for (let k = 0; k < n; k++) {
          ctx.fillStyle = FOOD_DOT_COLORS[(wx * 7 + wy * 3 + r * 2 + k) % FOOD_DOT_COLORS.length];
          ctx.fillRect(rx + k * d, ry, d - (d > 2 ? 1 : 0), d - (d > 2 ? 1 : 0));
          if (ap >= 2) {
            ctx.fillStyle = 'rgba(255,255,255,0.45)';
            ctx.fillRect(rx + k * d, ry, 1, 1);
            ctx.fillStyle = 'rgba(0,0,0,0.28)';
            ctx.fillRect(rx + k * d + d - 2, ry + d - 2, 1, 1);
          }
        }
      }
    }
  }

  /** Mirrored rectangle for a creature facing left or right (art-pixels, 8 wide). */
  private M(x0: number, y0: number, face: boolean, u: number, v: number, w: number, h: number, c: string): void {
    this.R(x0, y0, face ? u : 8 - u - w, v, w, h, c);
  }

  /** A herd animal in side view, standing: lit back, shaded belly and rump, shadow to the south-east. */
  private drawDeer(x0: number, y0: number, face: boolean, frame: number): void {
    const M = (u: number, v: number, w: number, h: number, c: string): void => this.M(x0, y0, face, u, v, w, h, c);
    M(1.6, 6.9, 6.0, 0.9, SHADOW);

    // Trotting gait or standing
    if (frame === 1) {
      M(1.2, 5, 0.6, 2, '#6b4220');
      M(3.0, 5, 0.6, 2, '#6b4220');
      M(4.0, 5, 0.6, 2, '#6b4220');
      M(5.8, 5, 0.6, 2, '#6b4220');
    } else if (frame === 2) {
      M(2.0, 5, 0.6, 2, '#6b4220');
      M(2.2, 5, 0.6, 2, '#6b4220');
      M(4.8, 5, 0.6, 2, '#6b4220');
      M(5.0, 5, 0.6, 2, '#6b4220');
    } else {
      for (const lx of [1.6, 2.6, 4.4, 5.4]) M(lx, 5, 0.6, 2, '#6b4220'); // legs
    }

    M(1.2, 3, 5.4, 2.2, '#b8793c'); // body
    M(1.2, 4.6, 5.4, 0.6, '#8f5a2a'); // shaded belly
    M(5.6, 3.4, 1.0, 1.8, '#9a6030'); // shaded haunch on the far side from the light
    M(1.2, 3, 5.4, 0.7, '#d9a35c'); // lit back
    M(6.2, 2.2, 1.6, 1.8, '#9a6030'); // head and neck
    M(6.8, 1.2, 0.5, 1.1, '#e8d8b0'); // antler tines
    M(7.2, 2.8, 0.4, 0.4, '#1c1008'); // eye
  }

  /** A wolf in side view: lean, ears up, tail out. */
  private drawWolf(x0: number, y0: number, face: boolean, frame: number): void {
    const M = (u: number, v: number, w: number, h: number, c: string): void => this.M(x0, y0, face, u, v, w, h, c);
    M(1.4, 6.9, 6.0, 0.9, SHADOW);

    // Trotting leg pairs or standing
    if (frame === 1) {
      M(1.0, 5, 0.6, 2, '#3a3a44');
      M(2.8, 5, 0.6, 2, '#3a3a44');
      M(4.2, 5, 0.6, 2, '#3a3a44');
      M(6.0, 5, 0.6, 2, '#3a3a44');
    } else if (frame === 2) {
      M(1.8, 5, 0.6, 2, '#3a3a44');
      M(2.0, 5, 0.6, 2, '#3a3a44');
      M(5.0, 5, 0.6, 2, '#3a3a44');
      M(5.2, 5, 0.6, 2, '#3a3a44');
    } else {
      for (const lx of [1.4, 2.4, 4.6, 5.6]) M(lx, 5, 0.6, 2, '#3a3a44'); // standing
    }

    M(1.0, 3, 5.2, 2.2, '#7c7c88'); // lean body
    M(1.0, 4.6, 5.2, 0.6, '#5c5c68'); // shaded belly
    M(1.0, 3, 5.2, 0.6, '#a4a4b0'); // back light
    M(6.0, 2.4, 2, 1.6, '#5c5c68'); // head and snout
    M(7.4, 3.2, 0.8, 0.8, '#5c5c68');
    M(6.2, 1.6, 0.6, 0.9, '#3a3a44'); // ears
    M(7.0, 1.6, 0.6, 0.9, '#3a3a44');

    const tailY = frame === 1 ? 2.3 : frame === 2 ? 2.8 : 2.6;
    M(0, tailY, 1.2, 0.7, '#7c7c88'); // tail
    M(7.0, 2.7, 0.4, 0.4, '#e8c020'); // eye
  }

  /** A fresh kill: a dead animal on its back, legs in the air, with blood on the ground. */
  private drawCarcass(x0: number, y0: number, cx: number, cy: number): void {
    const face = ((cx * 31 + cy * 17) & 1) === 0;
    this.R(x0, y0, 1.8, 6.9, 5.8, 0.9, SHADOW);
    this.R(x0, y0, 1.2, 4.6, 5.4, 2.2, '#7a3a20'); // belly-up body
    this.R(x0, y0, 1.2, 6.2, 5.4, 0.6, '#5a2a14'); // shaded underside on the ground
    this.R(x0, y0, 1.6, 5.2, 4.6, 0.8, '#c99a6a'); // pale belly
    for (const lx of [1.6, 2.7, 4.2, 5.4]) this.R(x0, y0, lx, 3.2, 0.6, 1.5, '#4a2810'); // four legs up
    this.R(x0, y0, face ? 6.4 : 0, 5.2, 1.6, 1.5, '#6a3a1c'); // head, fallen to the side
    this.R(x0, y0, face ? 7.2 : 0.2, 4.2, 0.5, 1.0, '#e8d8b0'); // antler
    this.R(x0, y0, 2, 6.8, 3.2, 0.6, '#a01818'); // blood
  }

  /** Zoomed-out features: tiny flat marks, as before. */
  private renderFeaturesFlat(screenWidth: number, screenHeight: number, worldW: number, worldH: number): void {
    const feats = this.world.featurePositions;
    if (!feats || feats.length < 3) return;
    const cs = this.cellSize;
    const ctx = this.ctx;
    const worldPxW = worldW * cs;
    const worldPxH = worldH * cs;
    const flick = Math.floor(performance.now() / 120);
    for (let i = 0; i + 2 < feats.length; i += 3) {
      const kind = feats[i + 2];
      let sx = Math.round(feats[i] * cs + this.panX);
      let sy = Math.round(feats[i + 1] * cs + this.panY);
      if (this.wrapX) { while (sx > -cs) sx -= worldPxW; while (sx < -cs) sx += worldPxW; }
      if (this.wrapY) { while (sy > -cs) sy -= worldPxH; while (sy < -cs) sy += worldPxH; }
      const fl = (flick + feats[i] * 7 + feats[i + 1] * 13) & 3;
      for (let x0 = sx; x0 < screenWidth; x0 += this.wrapX ? worldPxW : screenWidth + 1) {
        for (let y0 = sy; y0 < screenHeight; y0 += this.wrapY ? worldPxH : screenHeight + 1) {
          if (kind >= 8 && kind < 12) {
            ctx.fillStyle = '#a49a90'; ctx.fillRect(x0, y0, Math.max(2, cs), Math.max(2, cs));
            ctx.fillStyle = '#2a2420'; ctx.fillRect(x0 + cs * 0.35, y0 + cs * 0.55, Math.max(1, cs * 0.3), Math.max(1, cs * 0.4));
            continue;
          }
          if (kind === 5) {
            const gw = Math.max(2, Math.round(cs * 0.85));
            ctx.fillStyle = '#6b5238'; ctx.fillRect(x0, y0, gw, gw);
            if (gw >= 3) {
              ctx.fillStyle = '#e6dbbc';
              ctx.fillRect(x0 + Math.floor(gw / 2), y0, 1, Math.max(1, gw - 1));
              ctx.fillRect(x0 + 1, y0 + 1, Math.max(1, gw - 2), 1);
            }
            continue;
          }
          if (kind >= 16) {
            ctx.fillStyle = '#6d655f'; ctx.fillRect(x0, y0, Math.max(2, cs), Math.max(2, cs));
            ctx.fillStyle = '#16110d'; ctx.fillRect(x0 + cs * 0.3, y0 + cs * 0.3, Math.max(1, cs * 0.4), Math.max(1, cs * 0.4));
            continue;
          }
          ctx.fillStyle = 'rgba(255, 170, 60, 0.16)';
          const g = Math.max(cs * 5, 6);
          ctx.fillRect(x0 + cs / 2 - g / 2, y0 + cs / 2 - g / 2, g, g);
          ctx.fillStyle = fl & 1 ? '#ffb030' : '#ff7a18';
          ctx.fillRect(x0, y0, Math.max(2, cs), Math.max(2, cs));
        }
      }
    }
  }

  /** Zoomed-out herds, wolves and kills: coloured dots, smoothly interpolated. */
  private renderHerdsFlat(screenWidth: number, screenHeight: number, worldW: number, worldH: number): void {
    const cs = this.cellSize;
    const ctx = this.ctx;
    const worldPxW = worldW * cs;
    const worldPxH = worldH * cs;
    const d = Math.max(2, Math.round(cs * 0.9));
    const now = performance.now();
    const t =
      this.world.running === false
        ? 1.0
        : Math.min(1.0, (now - this.lastFrameTime) / this.frameInterval);

    // 1. Carcasses (static on ground)
    const carcasses = this.world.carcassPositions;
    if (carcasses) {
      ctx.fillStyle = '#8a2e22';
      for (let i = 0; i + 1 < carcasses.length; i += 2) {
        let sx = Math.round(carcasses[i] * cs + this.panX);
        let sy = Math.round(carcasses[i + 1] * cs + this.panY);
        if (this.wrapX) { while (sx > -cs) sx -= worldPxW; while (sx < -cs) sx += worldPxW; }
        if (this.wrapY) { while (sy > -cs) sy -= worldPxH; while (sy < -cs) sy += worldPxH; }
        for (let x0 = sx; x0 < screenWidth; x0 += this.wrapX ? worldPxW : screenWidth + 1) {
          for (let y0 = sy; y0 < screenHeight; y0 += this.wrapY ? worldPxH : screenHeight + 1) {
            ctx.fillRect(x0, y0, d, d);
          }
        }
      }
    }

    // 2. Wolves (interpolated dots)
    ctx.fillStyle = '#5c5c68';
    for (let k = 0; k < this.wolfCount; k++) {
      let dx = this.currWolfX[k] - this.prevWolfX[k];
      if (dx > worldW / 2) dx -= worldW; else if (dx < -worldW / 2) dx += worldW;
      let dy = this.currWolfY[k] - this.prevWolfY[k];
      if (dy > worldH / 2) dy -= worldH; else if (dy < -worldH / 2) dy += worldH;
      let rx = this.prevWolfX[k] + dx * t;
      if (rx < 0) rx += worldW; else if (rx >= worldW) rx -= worldW;
      let ry = this.prevWolfY[k] + dy * t;
      if (ry < 0) ry += worldH; else if (ry >= worldH) ry -= worldH;

      let sx = Math.round(rx * cs + this.panX);
      let sy = Math.round(ry * cs + this.panY);
      if (this.wrapX) { while (sx > -cs) sx -= worldPxW; while (sx < -cs) sx += worldPxW; }
      if (this.wrapY) { while (sy > -cs) sy -= worldPxH; while (sy < -cs) sy += worldPxH; }
      for (let x0 = sx; x0 < screenWidth; x0 += this.wrapX ? worldPxW : screenWidth + 1) {
        for (let y0 = sy; y0 < screenHeight; y0 += this.wrapY ? worldPxH : screenHeight + 1) {
          ctx.fillRect(x0, y0, d, d);
        }
      }
    }

    // 3. Deer (interpolated dots)
    ctx.fillStyle = '#d9a441';
    for (let k = 0; k < this.deerCount; k++) {
      let dx = this.currDeerX[k] - this.prevDeerX[k];
      if (dx > worldW / 2) dx -= worldW; else if (dx < -worldW / 2) dx += worldW;
      let dy = this.currDeerY[k] - this.prevDeerY[k];
      if (dy > worldH / 2) dy -= worldH; else if (dy < -worldH / 2) dy += worldH;
      let rx = this.prevDeerX[k] + dx * t;
      if (rx < 0) rx += worldW; else if (rx >= worldW) rx -= worldW;
      let ry = this.prevDeerY[k] + dy * t;
      if (ry < 0) ry += worldH; else if (ry >= worldH) ry -= worldH;

      let sx = Math.round(rx * cs + this.panX);
      let sy = Math.round(ry * cs + this.panY);
      if (this.wrapX) { while (sx > -cs) sx -= worldPxW; while (sx < -cs) sx += worldPxW; }
      if (this.wrapY) { while (sy > -cs) sy -= worldPxH; while (sy < -cs) sy += worldPxH; }
      for (let x0 = sx; x0 < screenWidth; x0 += this.wrapX ? worldPxW : screenWidth + 1) {
        for (let y0 = sy; y0 < screenHeight; y0 += this.wrapY ? worldPxH : screenHeight + 1) {
          ctx.fillRect(x0, y0, d, d);
        }
      }
    }
  }

  /**
   * Zoomed-out people: coloured pixels written straight into a 256x256 ImageData, scaled up.
   * (Zoomed in, people are collected and sorted with the other objects: see renderObjects.)
   */
  private renderPeopleFlat(screenWidth: number, screenHeight: number, worldW: number, worldH: number): void {
    if (this.activeCount === 0) return;

    const now = performance.now();
    const t =
      this.world.running === false
        ? 1.0
        : Math.min(1.0, (now - this.lastFrameTime) / this.frameInterval);
    const cellSize = this.cellSize;

    let selectedRenderX = -1;
    let selectedRenderY = -1;
    let hasSelected = false;

    this.peopleData32.fill(0); // clear transparent 256x256 overlay

    for (let i = 0; i < this.activeCount; i++) {
      const slot = this.activeSlots[i];
      const p0x = this.prevX[slot];
      const p1x = this.currX[slot];
      const p0y = this.prevY[slot];
      const p1y = this.currY[slot];

      let dx = p1x - p0x;
      if (dx > worldW / 2) dx -= worldW;
      else if (dx < -worldW / 2) dx += worldW;

      let dy = p1y - p0y;
      if (dy > worldH / 2) dy -= worldH;
      else if (dy < -worldH / 2) dy += worldH;

      let rx = p0x + dx * t;
      if (rx < 0) rx += worldW;
      else if (rx >= worldW) rx -= worldW;

      let ry = p0y + dy * t;
      if (ry < 0) ry += worldH;
      else if (ry >= worldH) ry -= worldH;

      const cellX = Math.floor(rx) & 255;
      const cellY = Math.floor(ry) & 255;

      if (slot === this.selectedSlot) {
        selectedRenderX = Math.round(rx * cellSize + this.panX);
        selectedRenderY = Math.round(ry * cellSize + this.panY);
        if (this.wrapX && selectedRenderX < 0) selectedRenderX += worldW * cellSize;
        if (this.wrapY && selectedRenderY < 0) selectedRenderY += worldH * cellSize;
        hasSelected = true;
      }

      let colorABGR = 0;
      if (this.colorMode === 'bands') {
        const rId = this.rootLeaderIds[slot];
        const bandSize = this.bandSizes.get(rId) ?? 0;
        colorABGR = bandSize <= 1 ? COLOR_PEOPLE_LONER : hashRootLeaderToABGR(rId);
      } else {
        const look = this.lookBytes[slot];
        const sex = (look & LOOK_SEX_MASK) === 1 ? 'male' : 'female';
        const pregnant = (look & LOOK_PREGNANT_MASK) !== 0;
        const stage = (look & LOOK_STAGE_MASK) >> 2;
        const energyLevel = (look & LOOK_ENERGY_MASK) >> 4;

        colorABGR = sex === 'male' ? COLOR_PEOPLE_MALE : COLOR_PEOPLE_FEMALE;
        if (energyLevel <= 1) colorABGR = COLOR_PEOPLE_STARVING;
        else if (pregnant) colorABGR = COLOR_PEOPLE_PREGNANT;
        else if (stage === LOOK_STAGE_CHILD) colorABGR = COLOR_PEOPLE_CHILD;
        else if (stage === LOOK_STAGE_ELDER) colorABGR = COLOR_PEOPLE_ELDER;
      }

      this.peopleData32[cellY * 256 + cellX] = colorABGR;
    }

    this.peopleCtx.putImageData(this.peopleImgData, 0, 0);
    const worldPxW = worldW * cellSize;
    const worldPxH = worldH * cellSize;
    for (let ty = this.panY; ty < (this.wrapY ? screenHeight : this.panY + 1); ty += worldPxH) {
      for (let tx = this.panX; tx < (this.wrapX ? screenWidth : this.panX + 1); tx += worldPxW) {
        this.ctx.drawImage(this.peopleCanvas, 0, 0, 256, 256, tx, ty, worldPxW, worldPxH);
      }
    }

    // Band Leader Star when zoomed out
    const starSpr = this.atlas.getSprite('star_leader');
    for (let i = 0; i < this.activeCount; i++) {
      const slot = this.activeSlots[i];
      const isLeader =
        this.rootLeaderIds[slot] === ((((slot & 0xfffff) << 12) | (this.slotGenerations[slot] & 0xfff)) >>> 0) &&
        (this.bandSizes.get(this.rootLeaderIds[slot]) ?? 0) > 1;
      if (isLeader) {
        const lx = Math.round(this.currX[slot] * cellSize + this.panX);
        const ly = Math.round(this.currY[slot] * cellSize + this.panY);
        const bounce = Math.sin(now * 0.006 + slot) * 2;
        const scale = Math.max(1, Math.floor(cellSize / 4));
        const dw = starSpr.w * scale;
        const dh = starSpr.h * scale;
        const dx = Math.round(lx - starSpr.anchorX * scale);
        const dy = Math.round(ly - dh - 2 + bounce);
        this.ctx.drawImage(this.atlas.canvas, starSpr.x, starSpr.y, starSpr.w, starSpr.h, dx, dy, dw, dh);
      }
    }

    if (hasSelected) {
      this.drawSelectionIndicator(selectedRenderX, selectedRenderY, cellSize, now, false);
    }
  }

  /**
   * Bouncing golden ring and chevron over selected person.
   */
  private drawSelectionIndicator(x: number, y: number, cellSize: number, now: number, oblique: boolean): void {
    const ctx = this.ctx;
    const cx = x;
    const cy = y;

    const pulse = Math.sin(now * 0.008);
    const ringRadius = Math.max(8, cellSize * 0.6) + pulse * 2;

    // Glowing selection ring: flat on the ground around the feet when zoomed in
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (oblique) ctx.ellipse(cx, cy - this.ap, ringRadius, ringRadius * 0.5, 0, 0, Math.PI * 2);
    else ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Bouncing chevron sprite, above the head when zoomed in
    const spr = this.atlas.getSprite('selector_chevron');
    const bounce = Math.abs(Math.sin(now * 0.006)) * 6;
    const scale = Math.max(1, Math.floor(cellSize / 12));
    const dw = spr.w * scale;
    const dh = spr.h * scale;
    const dx = Math.round(cx - spr.anchorX * scale);
    const lift = oblique ? this.ap * 10 + 4 : ringRadius + 8;
    const dy = Math.round(cy - lift - bounce - spr.anchorY * scale);

    ctx.drawImage(this.atlas.canvas, spr.x, spr.y, spr.w, spr.h, dx, dy, dw, dh);
  }
}
