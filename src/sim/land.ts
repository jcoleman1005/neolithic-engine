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
  readonly tilled?: readonly number[];
  readonly seeds?: readonly number[];
  readonly soilHealth?: readonly number[];
}

export class Land {
  public readonly width = GRID_SIZE;
  public readonly height = GRID_SIZE;
  public readonly food: Float32Array;
  public readonly maxFood: Float32Array;
  public readonly fertility: Float32Array;
  public readonly isWater: Uint8Array;
  /** How worked a cell's soil is, 0 to 1: raised by grazing, fades with time. */
  public readonly tilled: Float32Array;
  /** Seeds lying on a cell, 0 to seedCap. */
  public readonly seeds: Float32Array;
  /** 1 for healthy soil, down to soilMin for stripped land. */
  public readonly soilHealth: Float32Array;

  public terrain: TerrainField | null = null;
  public elevation: ElevationField | null = null;

  constructor(config: Readonly<SimulationConfig>, elevation?: ElevationField | null, terrain?: TerrainField | null) {
    this.food = new Float32Array(TOTAL_CELLS);
    this.maxFood = new Float32Array(TOTAL_CELLS);
    this.fertility = new Float32Array(TOTAL_CELLS);
    this.isWater = new Uint8Array(TOTAL_CELLS);
    this.tilled = new Float32Array(TOTAL_CELLS);
    this.seeds = new Float32Array(TOTAL_CELLS);
    this.soilHealth = new Float32Array(TOTAL_CELLS).fill(1);

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

  /** Food capacity of a cell now: natural capacity, scaled by soil health and the seeds on it. */
  public capacityAt(i: number, config: Readonly<SimulationConfig>): number {
    const max = this.maxFood[i];
    if (config.farmingPhysicsEnabled === false) return max;
    const sf = Math.min(1, this.seeds[i] / (config.seedCap ?? 10));
    return max * this.soilHealth[i] * (1 + (config.seedCapacityBoost ?? 0.6) * sf);
  }

  /**
   * Advances plant food regrowth across all cells.
   * Regrowth follows a logistic recovery curve above the grazing floor. With farming physics
   * on, worked soil and seeds speed it up, seeds raise capacity, and stripped soil recovers
   * slowly when left alone.
   */
  public step(config: Readonly<SimulationConfig>, growthFactor = 1): void {
    const baseRate = (config.landRegrowthRate ?? 0.05) * growthFactor;
    const floor = config.landGrazingFloor ?? 1.0;
    const farm = config.farmingPhysicsEnabled !== false;
    const tillKeep = 1 - (config.tillDecay ?? 0.001);
    const tillBoost = config.tillRegrowBoost ?? 1.0;
    const seedKeep = 1 - (config.seedDecay ?? 0.002);
    const seedCap = config.seedCap ?? 10;
    const seedRegrow = config.seedRegrowBoost ?? 1.5;
    const seedCapBoost = config.seedCapacityBoost ?? 0.6;
    const soilRec = config.soilRecoveryRate ?? 0.0006;

    for (let i = 0; i < TOTAL_CELLS; i++) {
      if (this.isWater[i] === 1) continue;
      let cur = this.food[i];
      const max = this.maxFood[i];
      let cap = max;
      let rate = baseRate;

      if (farm) {
        let t = this.tilled[i];
        if (t > 0) {
          t *= tillKeep;
          if (t < 1e-4) t = 0;
          this.tilled[i] = t;
        }
        let sd = this.seeds[i];
        if (sd > 0) {
          sd *= seedKeep;
          if (sd < 1e-3) sd = 0;
          this.seeds[i] = sd;
        }
        const sf = sd > 0 ? Math.min(1, sd / seedCap) : 0;
        let sh = this.soilHealth[i];
        // Soil recovers only while the cell still holds food (it is not being stripped).
        if (sh < 1 && cur > 0.5 * max * sh) {
          sh += soilRec * (1 - sh);
          this.soilHealth[i] = sh;
        }
        cap = max * sh * (1 + seedCapBoost * sf);
        rate = baseRate * (1 + tillBoost * t + seedRegrow * sf);
        if (cur > cap) {
          cur = cap;
          this.food[i] = cur;
        }
      }

      if (cur < cap) {
        // Growth is healthiest above floor, but still recovers slowly from below floor
        const effectiveCur = Math.max(floor * 0.1, cur);
        const delta = rate * effectiveCur * (1 - cur / cap);
        this.food[i] = Math.min(cap, cur + Math.max(0.01, delta));
      }
    }
  }

  /** A resting person drops carried seeds on their own cell. */
  public dropSeeds(x: number, y: number, amount: number, config: Readonly<SimulationConfig>): void {
    const i = ((y & COORD_MASK) << 8) | (x & COORD_MASK);
    if (this.isWater[i] === 1) return;
    this.seeds[i] = Math.min(config.seedCap ?? 10, this.seeds[i] + amount);
  }

  /** One byte per cell for the viewer: desert 3 bits, farmland 3 bits, seeds 2 bits. */
  public packOverlay(out: Uint8Array, config: Readonly<SimulationConfig>): void {
    const soilMin = config.soilMin ?? 0.2;
    const seedCap = config.seedCap ?? 10;
    const span = Math.max(1e-6, 1 - soilMin);
    for (let i = 0; i < TOTAL_CELLS; i++) {
      if (this.isWater[i] === 1) { out[i] = 0; continue; }
      const dmg = Math.min(7, Math.round(((1 - this.soilHealth[i]) / span) * 7));
      const farmLevel = Math.min(7, Math.round(Math.min(1, this.tilled[i]) * 7));
      const seedLevel = Math.min(3, Math.round((this.seeds[i] / seedCap) * 3));
      out[i] = dmg | (farmLevel << 3) | (seedLevel << 6);
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
    if (config.farmingPhysicsEnabled !== false) {
      // Working a cell tills it; stripping it down wears the soil out.
      this.tilled[index] += (config.tillGain ?? 0.02) * (1 - this.tilled[index]);
      if (this.food[index] < 0.25 * this.capacityAt(index, config)) {
        const wear = config.soilWearRate ?? 0.004;
        this.soilHealth[index] = Math.max(config.soilMin ?? 0.2, this.soilHealth[index] - wear);
      }
    }
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
      tilled: Array.from(this.tilled),
      seeds: Array.from(this.seeds),
      soilHealth: Array.from(this.soilHealth),
    };
  }

  public importState(state: LandState): void {
    const len = Math.min(TOTAL_CELLS, state.food.length);
    for (let i = 0; i < len; i++) {
      this.food[i] = state.food[i];
    }
    // Older saves have no farming state: leave it at its defaults.
    if (state.tilled) for (let i = 0; i < len; i++) this.tilled[i] = state.tilled[i] ?? 0;
    if (state.seeds) for (let i = 0; i < len; i++) this.seeds[i] = state.seeds[i] ?? 0;
    if (state.soilHealth) for (let i = 0; i < len; i++) this.soilHealth[i] = state.soilHealth[i] ?? 1;
  }
}
