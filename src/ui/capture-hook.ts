/**
 * The hook that scripts/capture.ts and scripts/visual-check.ts drive the page through. It is only
 * installed when the URL has `?capture`, and it only reads state or sends the same commands the
 * buttons send, so it changes no simulation outcome.
 */
import type { CanvasRenderer } from '../render/renderer';
import { buildTerraces, createTerraceData } from '../render/terrace';
import type { SavedWorld } from '../sim/protocol';
import type { AutoCamera } from './auto-camera';
import type { SimulationClient } from './simulation-client';

export interface Landmark {
  readonly x: number;
  readonly y: number;
  /** Cells of that kind within the window the spot was chosen for. */
  readonly score: number;
}

export interface CaptureDeps {
  readonly sim: SimulationClient;
  readonly renderer: CanvasRenderer;
  readonly camera: AutoCamera;
  readonly canvas: HTMLCanvasElement;
}

/** Half-width of the window a landmark is scored over: the spot with the most cliff or shore in 13 x 13 cells. */
const WINDOW = 6;
/** Landmarks stay this far from the world edge, where the camera clamps and the view cannot centre. */
const EDGE = 40;

export function installCaptureHook(d: CaptureDeps): void {
  const { sim, renderer, camera, canvas } = d;

  /** The cell with the highest count of flagged cells in a window around it. */
  function best(flag: Uint8Array): Landmark | null {
    const n = 256;
    // Summed-area table, so each window costs four reads.
    const sat = new Int32Array((n + 1) * (n + 1));
    for (let y = 0; y < n; y++) {
      let row = 0;
      for (let x = 0; x < n; x++) {
        row += flag[y * n + x];
        sat[(y + 1) * (n + 1) + x + 1] = sat[y * (n + 1) + x + 1] + row;
      }
    }
    let out: Landmark | null = null;
    for (let y = EDGE; y < n - EDGE; y++) {
      for (let x = EDGE; x < n - EDGE; x++) {
        const x0 = x - WINDOW;
        const y0 = y - WINDOW;
        const x1 = x + WINDOW + 1;
        const y1 = y + WINDOW + 1;
        const s = sat[y1 * (n + 1) + x1] - sat[y0 * (n + 1) + x1] - sat[y1 * (n + 1) + x0] + sat[y0 * (n + 1) + x0];
        if (!out || s > out.score) out = { x, y, score: s };
      }
    }
    return out && out.score > 0 ? out : null;
  }

  /**
   * Where the renderer draws cliffs (a land cell on tier 2 or above with lower ground or water to
   * its south, east or west) and shoreline (water with land beside it).
   */
  function landmarks(): { cliff: Landmark | null; shore: Landmark | null; waterCells: number; cliffCells: number } {
    const e = sim.elevation;
    if (!e) return { cliff: null, shore: null, waterCells: 0, cliffCells: 0 };
    const terrace = createTerraceData();
    buildTerraces(e.elevation, terrace);
    const tiers = terrace.tiers;
    const water = e.water;
    const cliff = new Uint8Array(65536);
    const shore = new Uint8Array(65536);
    let waterCells = 0;
    let cliffCells = 0;
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        const i = y * 256 + x;
        const isWater = water[i] > 0;
        const at = (dx: number, dy: number): number => ((y + dy) & 255) * 256 + ((x + dx) & 255);
        if (isWater) {
          waterCells++;
          if (water[at(1, 0)] === 0 || water[at(-1, 0)] === 0 || water[at(0, 1)] === 0 || water[at(0, -1)] === 0) shore[i] = 1;
        } else if (tiers[i] > 1) {
          const t = tiers[i];
          const drops = [at(0, 1), at(1, 0), at(-1, 0)].some((j) => t > tiers[j] || water[j] > 0);
          if (drops) {
            cliff[i] = 1;
            cliffCells++;
          }
        }
      }
    }
    return { cliff: best(cliff), shore: best(shore), waterCells, cliffCells };
  }

  const api = {
    // Used by scripts/capture.ts.
    goTo: (x: number, y: number) => renderer.goTo(x, y),
    cellSize: () => renderer.cellSize,
    /** The latest contest batch (x, y, kind, tick, ...), for finding a fight to frame. */
    contests: () => Array.from(sim.contests),
    /** A copy of the config the host last sent (for checking feature switches end to end). */
    config: () => ({ ...sim.config }),
    /** Contest marks the renderer is showing now: [x, y, kind, age ms]. */
    contestMarks: () => renderer.liveContestMarks(),
    /** Up to `limit` cells, as [x, y], whose ground-channel byte has any of `mask`'s bits (8 | 16: being built). */
    groundCells: (mask: number, limit = 50) => {
      const g = sim.landPaths;
      const out: [number, number][] = [];
      if (!g) return out;
      for (let i = 0; i < g.length && out.length < limit; i++) if ((g[i] & mask) !== 0) out.push([i & 255, i >> 8]);
      return out;
    },
    settlementHitBoxes: () => renderer.settlementHitBoxes(),

    /** The view in cells: where the middle of the usable canvas is, and the raw pan. */
    view: () => {
      const s = renderer.cameraState();
      const rect = canvas.parentElement?.getBoundingClientRect() ?? canvas.getBoundingClientRect();
      const availW = Math.max(100, rect.width - s.insets.left - s.insets.right);
      const availH = Math.max(100, rect.height - s.insets.top - s.insets.bottom);
      return {
        cellSize: s.cellSize,
        panX: s.panX,
        panY: s.panY,
        centerX: (s.insets.left + availW / 2 - s.panX) / s.cellSize,
        centerY: (s.insets.top + availH / 2 - s.panY) / s.cellSize,
        availW,
        availH,
        insetLeft: s.insets.left,
        insetTop: s.insets.top,
        gliding: s.gliding,
        target: s.target,
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
        canvasLeft: canvas.getBoundingClientRect().left,
        canvasTop: canvas.getBoundingClientRect().top,
      };
    },

    state: () => ({
      seed: sim.config.seed,
      tick: sim.tick,
      running: sim.running,
      population: sim.getMetrics()?.population ?? null,
      terrainReady: sim.terrain !== null && sim.elevation !== null,
      bands: sim.bands.length,
      cameraEnabled: camera.enabled,
      shot: camera.currentShot(),
      holdSeconds: sim.config.cameraHoldSeconds ?? null,
      chronicle: sim.worldEvents.flatMap((e) =>
        e.kind === 'chronicle' ? [{ seq: e.seq, tick: e.tick, type: e.type, priority: e.priority, x: e.x, y: e.y, band: e.band, text: e.text }] : []
      ),
    }),

    landmarks,

    /** The tracked bands the auto-camera chooses between. */
    bandViews: () => sim.bands.map((b) => ({ id: b.id, size: b.size, cx: b.cx, cy: b.cy })),

    // Same commands as the Settings box and the playback pill.
    reset: (seed: number) => sim.reset(seed),
    load: (saved: SavedWorld) => sim.load(saved),
    pause: () => sim.pause(),
    step: (n: number) => {
      for (let i = 0; i < n; i++) sim.step();
    },
  };

  (window as unknown as { __capture: typeof api }).__capture = api;
}
