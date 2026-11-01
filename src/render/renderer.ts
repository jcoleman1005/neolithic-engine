import type { WorldView } from '../sim/protocol';
import { type TerrainField } from '../sim/terrain';
import { type ElevationField } from '../sim/elevation';
import { paintTerrain } from './terrain-paint';
import { paintElevation } from './elevation-paint';

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
  private world: WorldView;
  private insets: ViewInsets = { top: 0, bottom: 0, left: 0, right: 0 };

  private panX = 0;
  private panY = 0;
  private zoom = 1;
  private baseCell = 4;
  private cellSize = 4;

  private terrainLayer: HTMLCanvasElement | null = null;
  private terrainLayerFor: TerrainField | null = null;
  private elevationLayer: HTMLCanvasElement | null = null;
  private elevationLayerFor: ElevationField | null = null;

  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragStartPanX = 0;
  private dragStartPanY = 0;
  private pinchStartDist = 0;
  private pinchStartZoom = 1;

  constructor(canvas: HTMLCanvasElement, world: WorldView) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.world = world;

    this.setupEvents();
    this.resize();
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
    this.ctx.scale(dpr, dpr);

    const w = this.world.config.worldWidth || 256;
    const h = this.world.config.worldHeight || 256;
    const availW = Math.max(100, rect.width - this.insets.left - this.insets.right);
    const availH = Math.max(100, rect.height - this.insets.top - this.insets.bottom);
    this.baseCell = Math.min(availW / w, availH / h);
    this.cellSize = this.baseCell * this.zoom;
  }

  public setWorld(world: WorldView): void {
    this.world = world;
  }

  public setMotionStyle(_style: MotionStyle): void {}
  public setColorMode(_mode: ColorMode): void {}
  public setOverlay(_mode: OverlayMode): void {}
  public setHighlightSpecies(_id: number | null): void {}
  public setSpeciesLookup(_fn: ((id: string) => number) | null): void {}

  private setupEvents(): void {
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
      this.zoom = Math.max(0.5, Math.min(16, this.zoom * zoomFactor));
      this.cellSize = this.baseCell * this.zoom;
      this.render();
    }, { passive: false });

    this.canvas.addEventListener('pointerdown', (e) => {
      this.isDragging = true;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      this.dragStartPanX = this.panX;
      this.dragStartPanY = this.panY;
      this.canvas.setPointerCapture(e.pointerId);
    });

    this.canvas.addEventListener('pointermove', (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.dragStartX;
      const dy = e.clientY - this.dragStartY;
      this.panX = this.dragStartPanX + dx;
      this.panY = this.dragStartPanY + dy;
      this.render();
    });

    const pointerUp = (e: PointerEvent) => {
      if (this.isDragging) {
        this.isDragging = false;
        try {
          this.canvas.releasePointerCapture(e.pointerId);
        } catch {}
      }
    };
    this.canvas.addEventListener('pointerup', pointerUp);
    this.canvas.addEventListener('pointercancel', pointerUp);

    // Touch pinch zoom
    this.canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        this.pinchStartDist = Math.hypot(dx, dy);
        this.pinchStartZoom = this.zoom;
      }
    });

    this.canvas.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        if (this.pinchStartDist > 0) {
          const factor = dist / this.pinchStartDist;
          this.zoom = Math.max(0.5, Math.min(16, this.pinchStartZoom * factor));
          this.cellSize = this.baseCell * this.zoom;
          this.render();
        }
      }
    }, { passive: false });
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

  public render(): void {
    const dpr = window.devicePixelRatio || 1;
    const width = this.canvas.width / dpr;
    const height = this.canvas.height / dpr;

    this.ctx.fillStyle = '#10141a';
    this.ctx.fillRect(0, 0, width, height);

    const w = this.world.config.worldWidth || 256;
    const h = this.world.config.worldHeight || 256;
    const worldPxW = w * this.cellSize;
    const worldPxH = h * this.cellSize;

    this.ctx.save();
    this.ctx.translate(this.panX, this.panY);

    // Render terrain and elevation layers
    this.updateLayers();
    if (this.terrainLayer) {
      this.ctx.imageSmoothingEnabled = false;
      this.ctx.drawImage(this.terrainLayer, 0, 0, worldPxW, worldPxH);
    }
    if (this.elevationLayer) {
      this.ctx.imageSmoothingEnabled = false;
      this.ctx.drawImage(this.elevationLayer, 0, 0, worldPxW, worldPxH);
    }

    // World border
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(0, 0, worldPxW, worldPxH);

    this.ctx.restore();
  }

  private updateLayers(): void {
    const terrain = this.world.terrain;
    const elevation = this.world.elevation;
    if (terrain && terrain !== this.terrainLayerFor) {
      const pix = paintTerrain(terrain, 1, false, elevation?.water);
      const c = document.createElement('canvas');
      c.width = pix.width;
      c.height = pix.height;
      const ctx = c.getContext('2d')!;
      const imgData = new ImageData(pix.data, pix.width, pix.height);
      ctx.putImageData(imgData, 0, 0);
      this.terrainLayer = c;
      this.terrainLayerFor = terrain;
    }

    if (elevation && elevation !== this.elevationLayerFor) {
      const pix = paintElevation(
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
      const c = document.createElement('canvas');
      c.width = pix.width;
      c.height = pix.height;
      const ctx = c.getContext('2d')!;
      const imgData = new ImageData(pix.data, pix.width, pix.height);
      ctx.putImageData(imgData, 0, 0);
      this.elevationLayer = c;
      this.elevationLayerFor = elevation;
    }
  }

  public frameStart(): void {}
  public frameDone(): void {
    this.render();
  }
}
