import type { WorldView } from '../sim/protocol';
import { type TerrainField } from '../sim/terrain';
import { type ElevationField } from '../sim/elevation';
import { paintTerrain } from './terrain-paint';
import { paintElevation } from './elevation-paint';
import {
  PERSON_FRAME_BYTES,
  LOOK_SEX_MASK,
  LOOK_PREGNANT_MASK,
  LOOK_STAGE_MASK,
  LOOK_STAGE_CHILD,
  LOOK_STAGE_ELDER,
  LOOK_ENERGY_MASK,
} from '../sim/protocol';

export type MotionStyle = 'smooth' | 'fluid';
export type ColorMode = 'tag' | 'lineage';
export type OverlayMode = 'none' | 'terrain';

export interface ViewInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
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

  private panX = 0;
  private panY = 0;
  private zoom = 1;
  private baseCell = 4;
  public cellSize = 4;

  // Cached 256x256 composite background
  private cachedBackground: HTMLCanvasElement | null = null;
  private terrainLayerFor: TerrainField | null = null;
  private elevationLayerFor: ElevationField | null = null;

  // People motion smoothing state (up to 65536 slots)
  private readonly activeSlots = new Int32Array(65536);
  private activeCount = 0;
  private readonly activeMask = new Uint8Array(65536);
  private readonly prevX = new Float32Array(65536);
  private readonly prevY = new Float32Array(65536);
  private readonly currX = new Float32Array(65536);
  private readonly currY = new Float32Array(65536);
  private readonly lookBytes = new Uint8Array(65536);

  private lastFrameTime = 0;
  private frameInterval = 333; // ms between sim frames

  // Selection & Follow
  public selectedSlot: number | null = null;
  public followSelected = false;
  public onSelect?: (slot: number | null) => void;

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
  private pinchStartZoom = 1;

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
    this.canvas.width = Math.floor(rect.width * dpr);
    this.canvas.height = Math.floor(rect.height * dpr);
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;

    const w = this.world.config.worldWidth || 256;
    const h = this.world.config.worldHeight || 256;
    const availW = Math.max(100, rect.width - this.insets.left - this.insets.right);
    const availH = Math.max(100, rect.height - this.insets.top - this.insets.bottom);
    this.baseCell = Math.min(availW / w, availH / h);
    this.cellSize = this.baseCell * this.zoom;

    // Center world initially if not panned
    if (this.panX === 0 && this.panY === 0) {
      this.panX = (rect.width - w * this.cellSize) / 2;
      this.panY = (rect.height - h * this.cellSize) / 2;
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
        this.render();
      }
    };
    this.animHandle = requestAnimationFrame(tick);
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
    this.canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const zoomFactor = e.deltaY < 0 ? 1.2 : 0.83;
        const newZoom = Math.max(0.5, Math.min(32, this.zoom * zoomFactor));

        // Zoom centered around mouse cursor
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const currentCell = this.baseCell * this.zoom;
        const nextCell = this.baseCell * newZoom;

        const worldX = (mouseX - this.panX) / currentCell;
        const worldY = (mouseY - this.panY) / nextCell;

        this.zoom = newZoom;
        this.cellSize = nextCell;

        this.panX = mouseX - worldX * nextCell;
        this.panY = mouseY - worldY * nextCell;
      },
      { passive: false }
    );

    this.canvas.addEventListener('pointerdown', (e) => {
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
      this.panX = this.dragStartPanX + dx;
      this.panY = this.dragStartPanY + dy;
      if (Math.hypot(dx, dy) > 5) {
        this.followSelected = false; // user panned manually
      }
    });

    const pointerUp = (e: PointerEvent) => {
      if (this.isDragging) {
        const moved = Math.hypot(e.clientX - this.dragStartX, e.clientY - this.dragStartY);
        this.isDragging = false;
        try {
          this.canvas.releasePointerCapture(e.pointerId);
        } catch {}

        // If it was a quick tap/click without drag, handle selection
        if (moved < 5) {
          this.handleTap(e.clientX, e.clientY);
        }
      }
    };
    this.canvas.addEventListener('pointerup', pointerUp);
    this.canvas.addEventListener('pointercancel', pointerUp);

    // Mobile Pinch-to-zoom
    this.canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        this.pinchStartDist = Math.hypot(dx, dy);
        this.pinchStartZoom = this.zoom;
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
          const factor = dist / this.pinchStartDist;
          this.zoom = Math.max(0.5, Math.min(32, this.pinchStartZoom * factor));
          this.cellSize = this.baseCell * this.zoom;
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
    for (let i = 0; i < count; i++) {
      const slot = buf[offset] | (buf[offset + 1] << 8);
      const x = buf[offset + 2];
      const y = buf[offset + 3];
      const look = buf[offset + 4];
      offset += PERSON_FRAME_BYTES;

      if (slot >= 65536) continue;

      if (this.activeMask[slot] === 0) {
        // Newborn / first time seen: snap previous position to current
        this.prevX[slot] = x;
        this.prevY[slot] = y;
      } else {
        // Person already active: slide previous to where they just were
        this.prevX[slot] = this.currX[slot];
        this.prevY[slot] = this.currY[slot];
      }

      this.currX[slot] = x;
      this.currY[slot] = y;
      this.lookBytes[slot] = look;
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

    // Deep void background
    this.ctx.fillStyle = '#0b0f19';
    this.ctx.fillRect(0, 0, width, height);

    const w = this.world.config.worldWidth || 256;
    const h = this.world.config.worldHeight || 256;
    const worldPxW = w * this.cellSize;
    const worldPxH = h * this.cellSize;

    // Camera follow if tracking a selected person
    if (
      this.followSelected &&
      this.selectedSlot !== null &&
      this.activeMask[this.selectedSlot] === 1
    ) {
      const sx = this.currX[this.selectedSlot] * this.cellSize;
      const sy = this.currY[this.selectedSlot] * this.cellSize;
      this.panX = width / 2 - sx;
      this.panY = height / 2 - sy;
    }

    this.ctx.save();
    this.ctx.translate(this.panX, this.panY);

    // 1. Draw cached 256x256 composite terrain background
    this.updateBackgroundCache();
    if (this.cachedBackground) {
      this.ctx.imageSmoothingEnabled = false;
      this.ctx.drawImage(this.cachedBackground, 0, 0, worldPxW, worldPxH);
    }

    // 2. World Border
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(0, 0, worldPxW, worldPxH);

    // 3. Render People with wrap-aware smoothing
    this.renderPeople(w, h);

    this.ctx.restore();
    this.ctx.restore();
  }

  private updateBackgroundCache(): void {
    const terrain = this.world.terrain;
    const elevation = this.world.elevation;

    if (!terrain && !elevation) return;
    if (terrain === this.terrainLayerFor && elevation === this.elevationLayerFor && this.cachedBackground) {
      return;
    }

    const w = this.world.config.worldWidth || 256;
    const h = this.world.config.worldHeight || 256;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;

    // Base ground: default lush grassland
    ctx.fillStyle = '#489a5b';
    ctx.fillRect(0, 0, w, h);

    if (terrain) {
      const tPix = paintTerrain(terrain, 1, false, elevation?.water);
      const imgData = new ImageData(tPix.data, tPix.width, tPix.height);
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = tPix.width;
      tempCanvas.height = tPix.height;
      tempCanvas.getContext('2d')!.putImageData(imgData, 0, 0);
      ctx.drawImage(tempCanvas, 0, 0, w, h);
    }

    if (elevation) {
      const ePix = paintElevation(
        {
          width: elevation.width,
          height: elevation.height,
          elevation: elevation.elevation,
          water: elevation.water,
          seaLevel: elevation.seaLevel,
          deepThreshold: this.world.config.elevationDeepThreshold ?? 0.2,
        },
        1
      );
      const imgData = new ImageData(ePix.data, ePix.width, ePix.height);
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = ePix.width;
      tempCanvas.height = ePix.height;
      tempCanvas.getContext('2d')!.putImageData(imgData, 0, 0);
      ctx.drawImage(tempCanvas, 0, 0, w, h);
    }

    this.cachedBackground = canvas;
    this.terrainLayerFor = terrain ?? null;
    this.elevationLayerFor = elevation ?? null;
  }

  private renderPeople(worldW: number, worldH: number): void {
    if (this.activeCount === 0) return;

    const now = performance.now();
    const t = this.world.running === false ? 1.0 : Math.min(1.0, (now - this.lastFrameTime) / this.frameInterval);
    const cellSize = this.cellSize;
    const isZoomedIn = cellSize >= 8;

    let selectedRenderX = -1;
    let selectedRenderY = -1;
    let hasSelected = false;

    for (let i = 0; i < this.activeCount; i++) {
      const slot = this.activeSlots[i];
      const p0x = this.prevX[slot];
      const p1x = this.currX[slot];
      const p0y = this.prevY[slot];
      const p1y = this.currY[slot];

      // Shortest modular difference across wrapping boundaries
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

      const screenX = rx * cellSize;
      const screenY = ry * cellSize;

      const look = this.lookBytes[slot];
      const isSelected = slot === this.selectedSlot;

      if (isSelected) {
        selectedRenderX = screenX;
        selectedRenderY = screenY;
        hasSelected = true;
      }

      if (isZoomedIn) {
        this.drawWorldboxFigure(screenX, screenY, look, cellSize, rx, ry);
      } else {
        this.drawWorldboxDot(screenX, screenY, look, cellSize);
      }
    }

    // Draw prominent selection ring and bounce indicator above selected person
    if (hasSelected) {
      this.drawSelectionIndicator(selectedRenderX, selectedRenderY, cellSize, now);
    }
  }

  /**
   * Zoomed-out representation: crisp WorldBox colored dot.
   */
  private drawWorldboxDot(x: number, y: number, look: number, cellSize: number): void {
    const sex = (look & LOOK_SEX_MASK) === 1 ? 'male' : 'female';
    const pregnant = (look & LOOK_PREGNANT_MASK) !== 0;
    const stage = (look & LOOK_STAGE_MASK) >> 2;
    const energyLevel = (look & LOOK_ENERGY_MASK) >> 4;

    const ctx = this.ctx;
    const radius = Math.max(1.2, Math.min(3.5, cellSize * 0.45));

    let color: string;
    if (energyLevel <= 1) {
      color = '#ef4444'; // Red for starving
    } else if (pregnant) {
      color = '#f43f5e'; // Vibrant rose for pregnant
    } else if (stage === LOOK_STAGE_CHILD) {
      color = '#f59e0b'; // Amber for children
    } else if (stage === LOOK_STAGE_ELDER) {
      color = '#cbd5e1'; // Silver/grey for elders
    } else {
      color = sex === 'female' ? '#fb7185' : '#38bdf8'; // Soft coral / vibrant sky blue
    }

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x + cellSize * 0.5, y + cellSize * 0.5, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Zoomed-in representation: WorldBox miniature pixel stick figure.
   */
  private drawWorldboxFigure(
    x: number,
    y: number,
    look: number,
    cellSize: number,
    rx: number,
    ry: number
  ): void {
    const sex = (look & LOOK_SEX_MASK) === 1 ? 'male' : 'female';
    const pregnant = (look & LOOK_PREGNANT_MASK) !== 0;
    const stage = (look & LOOK_STAGE_MASK) >> 2;
    const energyLevel = (look & LOOK_ENERGY_MASK) >> 4;

    const ctx = this.ctx;
    const cx = Math.floor(x + cellSize * 0.5);
    const cy = Math.floor(y + cellSize * 0.5);

    // Scale unit per pixel
    const s = Math.max(1, Math.floor(cellSize / 8));
    const isChild = stage === LOOK_STAGE_CHILD;
    const isElder = stage === LOOK_STAGE_ELDER;

    // Palette
    const skinColor = '#e0ac69';
    const hairColor = isElder ? '#e2e8f0' : '#451a03';
    let tunicColor = sex === 'female' ? '#e11d48' : '#0284c7';
    if (energyLevel <= 1) tunicColor = '#7f1d1d'; // starving dark red

    // Walking animation bob based on position
    const stepBob = (Math.floor(rx * 2 + ry * 2) & 1) * s;

    // 1. Head (2x2)
    ctx.fillStyle = skinColor;
    const headY = cy - 3 * s + (isChild ? s : 0);
    ctx.fillRect(cx - s, headY, 2 * s, 2 * s);

    // Hair cap (1x2 top)
    ctx.fillStyle = hairColor;
    ctx.fillRect(cx - s, headY, 2 * s, s);

    // 2. Torso (2x2)
    ctx.fillStyle = tunicColor;
    const torsoY = headY + 2 * s;
    ctx.fillRect(cx - s, torsoY, 2 * s, 2 * s);

    // Pregnant belly bump
    if (pregnant) {
      ctx.fillStyle = '#f43f5e';
      ctx.fillRect(cx + s, torsoY + s, s, s);
    }

    // 3. Legs (two 1x2 pixel legs with subtle walking offset)
    ctx.fillStyle = '#1e293b';
    const legY = torsoY + 2 * s;
    ctx.fillRect(cx - s, legY + stepBob, s, 2 * s - stepBob);
    ctx.fillRect(cx, legY + (s - stepBob), s, s + stepBob);
  }

  /**
   * Bouncing golden ring and chevron over selected person.
   */
  private drawSelectionIndicator(x: number, y: number, cellSize: number, now: number): void {
    const ctx = this.ctx;
    const cx = x + cellSize * 0.5;
    const cy = y + cellSize * 0.5;

    const pulse = Math.sin(now * 0.008);
    const ringRadius = Math.max(6, cellSize * 0.7) + pulse * 2;

    // Selection ring
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Bouncing chevron arrow above head
    const bounce = Math.abs(Math.sin(now * 0.006)) * 6;
    const arrowY = cy - ringRadius - 6 - bounce;

    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.moveTo(cx, arrowY + 5);
    ctx.lineTo(cx - 5, arrowY);
    ctx.lineTo(cx + 5, arrowY);
    ctx.closePath();
    ctx.fill();
  }
}
