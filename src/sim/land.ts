import { type ElevationField, generateElevation } from './elevation';
import { type TerrainField, generateTerrain } from './terrain';
import type { SimulationConfig } from './types';

export const GRID_SIZE = 256;
export const TOTAL_CELLS = GRID_SIZE * GRID_SIZE; // 65536
export const COORD_MASK = 255;

/**
 * Shortest signed difference between a and b on a 256-ring [-128, 127].
 * (b + wrapDiff(a, b)) & 255 === a & 255.
 */
export function wrapDiff(a: number, b: number): number {
  const diff = (a - b) & COORD_MASK;
  return diff >= 128 ? diff - 256 : diff;
}

/**
 * Squared toroidal distance between (x1, y1) and (x2, y2).
 */
export function distSqWrap(x1: number, y1: number, x2: number, y2: number): number {
  const dx = wrapDiff(x1, x2);
  const dy = wrapDiff(y1, y2);
  return dx * dx + dy * dy;
}

export interface LandState {
  readonly width: number;
  readonly height: number;
  readonly food: readonly number[];
}

export class Land {
  public readonly width = GRID_SIZE;
  public readonly height = GRID_SIZE;
  public readonly food: Float32Array;
  public readonly maxFood: Float32Array;
  public readonly fertility: Float32Array;
  public readonly isWater: Uint8Array;

  public terrain: TerrainField | null = null;
  public elevation: ElevationField | null = null;

  constructor(config: Readonly<SimulationConfig>, elevation?: ElevationField | null, terrain?: TerrainField | null) {
    this.food = new Float32Array(TOTAL_CELLS);
    this.maxFood = new Float32Array(TOTAL_CELLS);
    this.fertility = new Float32Array(TOTAL_CELLS);
    this.isWater = new Uint8Array(TOTAL_CELLS);

    const gridConfig = (config.gridWidth === GRID_SIZE && config.gridHeight === GRID_SIZE)
      ? config
      : { ...config, gridWidth: GRID_SIZE, gridHeight: GRID_SIZE, worldWidth: GRID_SIZE, worldHeight: GRID_SIZE };
    this.elevation = elevation ?? (config.elevationEnabled ? generateElevation(gridConfig) : null);
    this.terrain = terrain ?? (config.terrainEnabled ? generateTerrain(gridConfig) : null);

    this.initFoodCapacities(gridConfig);
  }

  private initFoodCapacities(config: Readonly<SimulationConfig>): void {
    const baseCap = config.landFoodMax ?? 20.0;
    const elev = this.elevation;

    for (let i = 0; i < TOTAL_CELLS; i++) {
      let f = 0.5; // default moderate fertility
      let water = false;

      if (elev && i < elev.water.length) {
        if (elev.water[i] > 0) {
          water = true;
        }
        // Riparian & fertility lift
        const rip = elev.riparian && i < elev.riparian.length ? elev.riparian[i] / 255 : 0;
        const fert = elev.fertility && i < elev.fertility.length ? elev.fertility[i] / 255 : 0.5;
        f = Math.max(0.05, Math.min(1.0, fert * 0.7 + rip * 0.3));
      }

      this.isWater[i] = water ? 1 : 0;
      this.fertility[i] = f;

      if (water) {
        this.maxFood[i] = 0;
        this.food[i] = 0;
      } else {
        const cap = baseCap * f;
        this.maxFood[i] = cap;
        // Start near capacity
        this.food[i] = cap * 0.8;
      }
    }
  }

  /**
   * Advances plant food regrowth across all cells.
   * Regrowth follows a logistic recovery curve above the grazing floor.
   */
  public step(config: Readonly<SimulationConfig>): void {
    const rate = config.landRegrowthRate ?? 0.05;
    const floor = config.landGrazingFloor ?? 1.0;

    for (let i = 0; i < TOTAL_CELLS; i++) {
      if (this.isWater[i] === 1) continue;
      const cur = this.food[i];
      const max = this.maxFood[i];
      if (cur < max) {
        // Growth is healthiest above floor, but still recovers slowly from below floor
        const effectiveCur = Math.max(floor * 0.1, cur);
        const delta = rate * effectiveCur * (1 - cur / max);
        this.food[i] = Math.min(max, cur + Math.max(0.01, delta));
      }
    }
  }

  /**
   * Forages plant food from cell (x, y).
   * Returns actual energy harvested (leaves floor intact).
   */
  public graze(x: number, y: number, want: number, config: Readonly<SimulationConfig>): number {
    const index = (y & COORD_MASK) * GRID_SIZE + (x & COORD_MASK);
    if (this.isWater[index] === 1) return 0;

    const floor = config.landGrazingFloor ?? 1.0;
    const available = this.food[index] - floor;
    if (available <= 0) return 0;

    const take = Math.min(want, available);
    this.food[index] -= take;
    return take;
  }

  public getFoodAt(x: number, y: number): number {
    return this.food[(y & COORD_MASK) * GRID_SIZE + (x & COORD_MASK)];
  }

  public getMaxFoodAt(x: number, y: number): number {
    return this.maxFood[(y & COORD_MASK) * GRID_SIZE + (x & COORD_MASK)];
  }

  public isWaterAt(x: number, y: number): boolean {
    return this.isWater[(y & COORD_MASK) * GRID_SIZE + (x & COORD_MASK)] === 1;
  }

  public totalPlantFood(): number {
    let sum = 0;
    for (let i = 0; i < TOTAL_CELLS; i++) {
      sum += this.food[i];
    }
    return sum;
  }

  public exportState(): LandState {
    return {
      width: this.width,
      height: this.height,
      food: Array.from(this.food),
    };
  }

  public importState(state: LandState): void {
    const len = Math.min(TOTAL_CELLS, state.food.length);
    for (let i = 0; i < len; i++) {
      this.food[i] = state.food[i];
    }
  }
}
