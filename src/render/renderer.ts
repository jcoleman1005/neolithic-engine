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
  type SpriteKey,
} from './sprites';

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
const ZOOM_SPRITE_THRESHOLD = 6; // cellSize >= 6 switches from pixel blit to stick figure & trees

// WorldBox Terrain 32-bit ABGR Palette
const COLOR_DEEP_WATER = hexToABGR('#154273');
const COLOR_SHALLOWS   = hexToABGR('#277da1');
const COLOR_SAND       = hexToABGR('#e9c46a');
const COLOR_GRASS_LUSH = hexToABGR('#489a5b');
const COLOR_GRASS_MID  = hexToABGR('#57cc99');
const COLOR_FOREST     = hexToABGR('#2d6a4f');
const COLOR_HILLS      = hexToABGR('#8a817c');
const COLOR_MOUNTAIN   = hexToABGR('#bcb8b1');
const COLOR_SNOW       = hexToABGR('#f8f9fa');

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
    peopleCount?: number;
    running?: boolean;
    getSelectedPerson?(): any;
  };
  private insets: ViewInsets = { top: 0, bottom: 0, left: 0, right: 0 };

  // Integer scale zoom and pan
  private zoomIndex = 2; // Default scale: ZOOM_STEPS[2] = 3
  public cellSize: number = ZOOM_STEPS[2];
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

  // Zoomed-out people blit overlay canvas (fixed 256x256, 1 px/cell)
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
  private readonly bandSizes = new Map<number, number>();
  public colorMode: ColorMode = 'status';

  private lastFrameTime = 0;
  private frameInterval = 333; // ms between sim frames

  // Selection & Follow
  public selectedSlot: number | null = null;
  public followSelected = false;
  public onSelect?: (slot: number | null) => void;
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

    // Initialize 256x256 1 px/cell terrain canvas
    this.terrainCanvas = document.createElement('canvas');
    this.terrainCanvas.width = 256;
    this.terrainCanvas.height = 256;
    this.terrainCtx = this.terrainCanvas.getContext('2d')!;
    this.terrainCtx.imageSmoothingEnabled = false;
    this.terrainImgData = this.terrainCtx.createImageData(256, 256);
    this.terrainData32 = new Uint32Array(this.terrainImgData.data.buffer);

    // Initialize 256x256 overlay canvas for direct 1px/cell ImageData blitting
    this.peopleCanvas = document.createElement('canvas');
    this.peopleCanvas.width = 256;
    this.peopleCanvas.height = 256;
    this.peopleCtx = this.peopleCanvas.getContext('2d')!;
    this.peopleCtx.imageSmoothingEnabled = false;
    this.peopleImgData = this.peopleCtx.createImageData(256, 256);
    this.peopleData32 = new Uint32Array(this.peopleImgData.data.buffer);

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
      peopleCount?: number;
      running?: boolean;
      getSelectedPerson?(): any;
    }
  ): void {
    this.world = world;
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

  /** Glides the pan toward the camera target. Pan stays whole pixels so zoom stays crisp. */
  private stepCamera(time: number): void {
    const dt = Math.min(250, Math.max(0, time - this.lastCameraStep));
    this.lastCameraStep = time;
    const t = this.cameraTarget;
    if (!t || this.isDragging) return;
    const rect = this.canvas.parentElement?.getBoundingClientRect();
    if (!rect) return;
    const availW = Math.max(100, rect.width - this.insets.left - this.insets.right);
    const availH = Math.max(100, rect.height - this.insets.top - this.insets.bottom);
    let wantX = this.insets.left + availW / 2 - t.x * this.cellSize;
    let wantY = this.insets.top + availH / 2 - t.y * this.cellSize;
    // The world wraps, so glide the short way round (and across an edge) to the target.
    const wpx = (this.world.config.worldWidth || 256) * this.cellSize;
    const hpx = (this.world.config.worldHeight || 256) * this.cellSize;
    wantX -= Math.round((wantX - this.camX) / wpx) * wpx;
    wantY -= Math.round((wantY - this.camY) / hpx) * hpx;
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

  private handleTap(clientX: number, clientY: number): void {
    const person = this.findPersonNearClient(clientX, clientY, 2.5);
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
    let bestSlot = -1;
    let bestDistSq = maxCellDist * maxCellDist;

    for (let i = 0; i < this.activeCount; i++) {
      const slot = this.activeSlots[i];
      const cx = this.currX[slot];
      const cy = this.currY[slot];

      let dx = cx - targetX;
      if (this.world.config.wrapping) {
        if (dx > w / 2) dx -= w;
        else if (dx < -w / 2) dx += w;
      }

      let dy = cy - targetY;
      if (this.world.config.wrapping) {
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

    // The world wraps: keep the pan in [-world, 0) so tiled copies always cover the screen.
    // (camX/camY follow along so the glide sees no jump.)
    const nx = ((this.panX % worldPxW) + worldPxW) % worldPxW - worldPxW;
    const ny = ((this.panY % worldPxH) + worldPxH) % worldPxH - worldPxH;
    this.camX += nx - this.panX;
    this.camY += ny - this.panY;
    this.panX = nx;
    this.panY = ny;

    // 1. Ensure terrain cache is up to date
    this.updateTerrainCache();

    // 2. Draw the terrain tiled, copy after copy, from the 256x256 offscreen canvas
    for (let ty = this.panY; ty < height; ty += worldPxH) {
      for (let tx = this.panX; tx < width; tx += worldPxW) {
        this.ctx.drawImage(this.terrainCanvas, 0, 0, 256, 256, tx, ty, worldPxW, worldPxH);
      }
    }

    // 4. Render Forest Trees when zoomed in
    const isZoomedIn = this.cellSize >= ZOOM_SPRITE_THRESHOLD;
    if (isZoomedIn) {
      this.renderTrees(width, height, w, h);
    }

    // 5. Render People (Direct ImageData blit zoomed out; Stick-figure sprites zoomed in)
    this.renderPeople(width, height, w, h, isZoomedIn);

    this.ctx.restore();
  }

  /**
   * Generates or updates the 256x256 1 px/cell terrain canvas.
   * Renders elevation hillshading and terrain colors once; redraws only changing cells.
   */
  private updateTerrainCache(): void {
    const elevation = this.world.elevation;
    const terrain = this.world.terrain;

    if (!elevation && !terrain) {
      if (!this.terrainGenerated) {
        this.terrainCtx.fillStyle = '#489a5b';
        this.terrainCtx.fillRect(0, 0, 256, 256);
        this.terrainGenerated = true;
      }
      return;
    }

    // Redraw only when not yet generated or when terrain changes
    const curTerrainVer = terrain ? terrain.version : 0;
    if (this.terrainGenerated && curTerrainVer === this.lastTerrainVersion) {
      return;
    }

    const elevArr = elevation?.elevation;
    const waterArr = elevation?.water;
    const coverArr = terrain?.cover;
    const deepThreshold = Math.floor((this.world.config.elevationDeepThreshold ?? 0.2) * 255);

    for (let y = 0; y < 256; y++) {
      const yPrev = (y - 1) & 255;
      const yNext = (y + 1) & 255;
      const rowOffset = y * 256;
      const rowPrev = yPrev * 256;
      const rowNext = yNext * 256;

      for (let x = 0; x < 256; x++) {
        const idx = rowOffset + x;
        const xPrev = (x - 1) & 255;
        const xNext = (x + 1) & 255;

        const isWater = waterArr ? waterArr[idx] > 0 : false;
        let baseColor = COLOR_GRASS_LUSH;
        let forestCell = false;

        if (isWater) {
          const depth = waterArr![idx];
          baseColor = depth >= deepThreshold ? COLOR_DEEP_WATER : COLOR_SHALLOWS;
        } else if (elevArr) {
          const h = elevArr[idx] / 65535;

          // Shore check: near water
          const nearWater =
            (waterArr &&
              (waterArr[rowOffset + xPrev] > 0 ||
                waterArr[rowOffset + xNext] > 0 ||
                waterArr[rowPrev + x] > 0 ||
                waterArr[rowNext + x] > 0)) ||
            (elevation && h < elevation.seaLevel + 0.015);

          if (nearWater) {
            baseColor = COLOR_SAND;
          } else if (h >= 0.82) {
            baseColor = COLOR_SNOW;
          } else if (h >= 0.70) {
            baseColor = COLOR_MOUNTAIN;
          } else if (h >= 0.56) {
            baseColor = COLOR_HILLS;
          } else {
            // Plains & Lowlands: check cover
            const cover = coverArr ? coverArr[idx] / 65535 : 0.4;
            if (cover >= 0.50) {
              baseColor = COLOR_FOREST;
              forestCell = true;
            } else if (cover >= 0.30) {
              baseColor = COLOR_GRASS_LUSH;
            } else {
              baseColor = COLOR_GRASS_MID;
            }
          }
        }

        this.isForest[idx] = forestCell ? 1 : 0;

        // Light elevation hillshading (north-west light: -1, -1)
        if (elevArr && !isWater) {
          const elevL = elevArr[rowOffset + xPrev];
          const elevR = elevArr[rowOffset + xNext];
          const elevU = elevArr[rowPrev + x];
          const elevD = elevArr[rowNext + x];

          const slope = ((elevL - elevR) + (elevU - elevD)) / 65535;
          const shade = Math.max(0.82, Math.min(1.18, 1.0 + slope * 1.5));

          const r = Math.min(255, Math.max(0, Math.round((baseColor & 0xff) * shade)));
          const g = Math.min(255, Math.max(0, Math.round(((baseColor >> 8) & 0xff) * shade)));
          const b = Math.min(255, Math.max(0, Math.round(((baseColor >> 16) & 0xff) * shade)));
          this.terrainData32[idx] = ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
        } else {
          this.terrainData32[idx] = baseColor;
        }
      }
    }

    this.terrainCtx.putImageData(this.terrainImgData, 0, 0);
    this.terrainGenerated = true;
    this.lastTerrainVersion = curTerrainVer;
  }

  /**
   * Draws small tree sprites on visible forest cells when zoomed in.
   */
  private renderTrees(
    screenWidth: number,
    screenHeight: number,
    worldW: number,
    worldH: number
  ): void {
    const cellSize = this.cellSize;
    const minCellX = Math.floor(-this.panX / cellSize) - 1;
    const maxCellX = Math.ceil((screenWidth - this.panX) / cellSize) + 1;
    const minCellY = Math.floor(-this.panY / cellSize) - 1;
    const maxCellY = Math.ceil((screenHeight - this.panY) / cellSize) + 1;

    const scale = Math.max(1, Math.floor(cellSize / 10));

    for (let cy = minCellY; cy <= maxCellY; cy++) {
      const wy = ((cy % worldH) + worldH) % worldH;
      const rowOffset = wy * worldW;

      for (let cx = minCellX; cx <= maxCellX; cx++) {
        const wx = ((cx % worldW) + worldW) % worldW;
        if (this.isForest[rowOffset + wx] === 1) {
          // Deterministic tree variant by coordinate
          const variant = (wx * 37 + wy * 89) % 3;
          const key: SpriteKey =
            variant === 0 ? 'tree_oak' : variant === 1 ? 'tree_pine' : 'tree_fruit';
          const spr = this.atlas.getSprite(key);

          const screenX = cx * cellSize + Math.floor(cellSize * 0.5);
          const screenY = cy * cellSize + cellSize;
          const dw = spr.w * scale;
          const dh = spr.h * scale;
          const dx = Math.round(screenX - spr.anchorX * scale + this.panX);
          const dy = Math.round(screenY - spr.anchorY * scale + this.panY);

          this.ctx.drawImage(this.atlas.canvas, spr.x, spr.y, spr.w, spr.h, dx, dy, dw, dh);
        }
      }
    }
  }

  /**
   * People rendering:
   * - Zoomed out: writes colored pixels straight into ImageData buffer.
   * - Zoomed in: draws stick-figure sprites on screen with deterministic cell offsets.
   */
  private renderPeople(
    screenWidth: number,
    screenHeight: number,
    worldW: number,
    worldH: number,
    isZoomedIn: boolean
  ): void {
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

    if (!isZoomedIn) {
      // Zoomed out: Draw into 256x256 overlay (one pixel per cell) and scale up with nearest neighbor
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
          if (selectedRenderX < 0) selectedRenderX += worldW * cellSize;
          if (selectedRenderY < 0) selectedRenderY += worldH * cellSize;
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
      for (let ty = this.panY; ty < screenHeight; ty += worldPxH) {
        for (let tx = this.panX; tx < screenWidth; tx += worldPxW) {
          this.ctx.drawImage(this.peopleCanvas, 0, 0, 256, 256, tx, ty, worldPxW, worldPxH);
        }
      }
    } else {
      // Zoomed in: Draw stick-figure sprites for on-screen people with deterministic ID offsets
      const scale = Math.max(1, Math.floor(cellSize / 8));

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

        // Deterministic sub-pixel offset from slot ID so people sharing a cell don't stack
        const hVal = (slot * 2654435761) >>> 0;
        const offX = ((hVal & 7) - 3.5) / 10;
        const offY = (((hVal >>> 3) & 7) - 3.5) / 10;

        const baseX = Math.round((rx + offX) * cellSize + this.panX);
        const baseY = Math.round((ry + offY) * cellSize + this.panY);
        const worldPxW = worldW * cellSize;
        const worldPxH = worldH * cellSize;

        // Wrapped world: the copy of this person that lands on screen (first one if several)
        let screenX = baseX;
        while (screenX > -cellSize) screenX -= worldPxW;
        while (screenX < -cellSize) screenX += worldPxW;
        let screenY = baseY;
        while (screenY > -cellSize) screenY -= worldPxH;
        while (screenY < -cellSize) screenY += worldPxH;

        if (slot === this.selectedSlot) {
          selectedRenderX = screenX;
          selectedRenderY = screenY;
          hasSelected = true;
        }

        // View frustum culling: skip people with no copy inside the visible screen bounds
        if (screenX > screenWidth + cellSize || screenY > screenHeight + cellSize) {
          continue;
        }
        const firstX = screenX;
        const firstY = screenY;

        const look = this.lookBytes[slot];
        const sex = (look & LOOK_SEX_MASK) === 1 ? 'male' : 'female';
        const pregnant = (look & LOOK_PREGNANT_MASK) !== 0;
        const stage = (look & LOOK_STAGE_MASK) >> 2;
        const energyLevel = (look & LOOK_ENERGY_MASK) >> 4;

        // Walking animation frame
        const isMoving = Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01;
        const walkFrame = isMoving
          ? ((Math.floor(rx * 2 + ry * 2) & 1) === 0 ? 'walk_0' : 'walk_1')
          : 'idle';

        let typeStr: string = sex;
        if (energyLevel <= 1) typeStr = 'starving';
        else if (pregnant) typeStr = 'pregnant';
        else if (stage === LOOK_STAGE_CHILD) typeStr = 'child';
        else if (stage === LOOK_STAGE_ELDER) typeStr = 'elder';

        const spriteKey = `person_${typeStr}_${walkFrame}` as SpriteKey;
        const spr = this.atlas.getSprite(spriteKey);

        const dw = spr.w * scale;
        const dh = spr.h * scale;
        const bandFill =
          this.colorMode === 'bands'
            ? (this.bandSizes.get(this.rootLeaderIds[slot]) ?? 0) <= 1
              ? '#888888'
              : hashRootLeaderToHex(this.rootLeaderIds[slot])
            : null;

        for (let cy = firstY; cy <= screenHeight + cellSize; cy += worldPxH) {
          for (let cx = firstX; cx <= screenWidth + cellSize; cx += worldPxW) {
            if (bandFill !== null) {
              this.ctx.fillStyle = bandFill;
              this.ctx.beginPath();
              this.ctx.arc(cx, cy + spr.h * scale * 0.45, Math.max(3, 3 * scale), 0, Math.PI * 2);
              this.ctx.fill();
            }
            this.ctx.drawImage(
              this.atlas.canvas, spr.x, spr.y, spr.w, spr.h,
              Math.round(cx - spr.anchorX * scale), Math.round(cy - spr.anchorY * scale), dw, dh
            );
          }
        }
      }
    }

    // Draw selection indicator if person selected
    if (hasSelected) {
      this.drawSelectionIndicator(selectedRenderX, selectedRenderY, cellSize, now);
    }
  }

  /**
   * Bouncing golden ring and chevron over selected person.
   */
  private drawSelectionIndicator(x: number, y: number, cellSize: number, now: number): void {
    const ctx = this.ctx;
    const cx = x;
    const cy = y;

    const pulse = Math.sin(now * 0.008);
    const ringRadius = Math.max(8, cellSize * 0.6) + pulse * 2;

    // Glowing selection ring
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Bouncing chevron sprite
    const spr = this.atlas.getSprite('selector_chevron');
    const bounce = Math.abs(Math.sin(now * 0.006)) * 6;
    const scale = Math.max(1, Math.floor(cellSize / 12));
    const dw = spr.w * scale;
    const dh = spr.h * scale;
    const dx = Math.round(cx - spr.anchorX * scale);
    const dy = Math.round(cy - ringRadius - 8 - bounce - spr.anchorY * scale);

    ctx.drawImage(this.atlas.canvas, spr.x, spr.y, spr.w, spr.h, dx, dy, dw, dh);
  }
}
