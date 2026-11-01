import type { SimulationConfig } from './types';

export const FIELD_SIZE = 256;
export const FIELD_CELLS = FIELD_SIZE * FIELD_SIZE; // 65,536
export const FIELD_MASK = FIELD_SIZE - 1; // 255

export interface FieldsState {
  readonly food: readonly number[];
  readonly danger: readonly number[];
}

export class ScentFields {
  // Food scent: double-buffered
  public foodCurrent: Float32Array;
  public foodNext: Float32Array;

  // Danger scent: double-buffered
  public dangerCurrent: Float32Array;
  public dangerNext: Float32Array;

  constructor() {
    this.foodCurrent = new Float32Array(FIELD_CELLS);
    this.foodNext = new Float32Array(FIELD_CELLS);
    this.dangerCurrent = new Float32Array(FIELD_CELLS);
    this.dangerNext = new Float32Array(FIELD_CELLS);
  }

  public reset(): void {
    this.foodCurrent.fill(0);
    this.foodNext.fill(0);
    this.dangerCurrent.fill(0);
    this.dangerNext.fill(0);
  }

  public depositFood(x: number, y: number, amount: number): void {
    const idx = ((y & FIELD_MASK) << 8) | (x & FIELD_MASK);
    this.foodCurrent[idx] = Math.min(255, this.foodCurrent[idx] + amount);
  }

  public depositDanger(x: number, y: number, amount: number): void {
    const idx = ((y & FIELD_MASK) << 8) | (x & FIELD_MASK);
    this.dangerCurrent[idx] = Math.min(255, this.dangerCurrent[idx] + amount);
  }

  public getFood(x: number, y: number): number {
    return this.foodCurrent[((y & FIELD_MASK) << 8) | (x & FIELD_MASK)];
  }

  public getDanger(x: number, y: number): number {
    return this.dangerCurrent[((y & FIELD_MASK) << 8) | (x & FIELD_MASK)];
  }

  /**
   * Advances diffusion and evaporation across the torus.
   * Allocates zero memory.
   */
  public step(config: Readonly<SimulationConfig>): void {
    const diffRate = config.scentDiffusionRate ?? 0.1;
    const decayRate = config.scentEvaporationRate ?? 0.02;

    const fc = this.foodCurrent;
    const fn = this.foodNext;
    const dc = this.dangerCurrent;
    const dn = this.dangerNext;

    // Weight factor for center cell
    const retain = 1.0 - decayRate - 4.0 * diffRate;

    for (let y = 0; y < FIELD_SIZE; y++) {
      const yUp = ((y - 1) & FIELD_MASK) << 8;
      const yDown = ((y + 1) & FIELD_MASK) << 8;
      const yRow = y << 8;

      for (let x = 0; x < FIELD_SIZE; x++) {
        const xLeft = (x - 1) & FIELD_MASK;
        const xRight = (x + 1) & FIELD_MASK;
        const idx = yRow | x;

        // Food diffusion
        const foodNeighbors =
          fc[yUp | x] + fc[yDown | x] + fc[yRow | xLeft] + fc[yRow | xRight];
        const newFood = fc[idx] * retain + foodNeighbors * diffRate;
        fn[idx] = newFood > 0.001 ? (newFood < 255 ? newFood : 255) : 0;

        // Danger diffusion
        const dangerNeighbors =
          dc[yUp | x] + dc[yDown | x] + dc[yRow | xLeft] + dc[yRow | xRight];
        const newDanger = dc[idx] * retain + dangerNeighbors * diffRate;
        dn[idx] = newDanger > 0.001 ? (newDanger < 255 ? newDanger : 255) : 0;
      }
    }

    // Swap buffers
    this.foodCurrent = fn;
    this.foodNext = fc;
    this.dangerCurrent = dn;
    this.dangerNext = dc;
  }

  /**
   * Evaluates the gradient (dx, dy) of food scent at (x, y).
   * Positive dx means higher food to the east.
   * Wraps around map boundaries.
   */
  public getFoodGradient(x: number, y: number, out: Float32Array): void {
    const cx = x & FIELD_MASK;
    const cy = y & FIELD_MASK;
    const yRow = cy << 8;
    const east = this.foodCurrent[yRow | ((cx + 1) & FIELD_MASK)];
    const west = this.foodCurrent[yRow | ((cx - 1) & FIELD_MASK)];
    const south = this.foodCurrent[(((cy + 1) & FIELD_MASK) << 8) | cx];
    const north = this.foodCurrent[(((cy - 1) & FIELD_MASK) << 8) | cx];

    out[0] = east - west;
    out[1] = south - north;
  }

  /**
   * Evaluates the gradient (dx, dy) of danger scent at (x, y).
   * Wraps around map boundaries.
   */
  public getDangerGradient(x: number, y: number, out: Float32Array): void {
    const cx = x & FIELD_MASK;
    const cy = y & FIELD_MASK;
    const yRow = cy << 8;
    const east = this.dangerCurrent[yRow | ((cx + 1) & FIELD_MASK)];
    const west = this.dangerCurrent[yRow | ((cx - 1) & FIELD_MASK)];
    const south = this.dangerCurrent[(((cy + 1) & FIELD_MASK) << 8) | cx];
    const north = this.dangerCurrent[(((cy - 1) & FIELD_MASK) << 8) | cx];

    out[0] = east - west;
    out[1] = south - north;
  }

  public exportState(): FieldsState {
    return {
      food: Array.from(this.foodCurrent),
      danger: Array.from(this.dangerCurrent),
    };
  }

  public importState(state: FieldsState): void {
    if (state.food && state.food.length === FIELD_CELLS) {
      this.foodCurrent.set(state.food);
      this.foodNext.fill(0);
    }
    if (state.danger && state.danger.length === FIELD_CELLS) {
      this.dangerCurrent.set(state.danger);
      this.dangerNext.fill(0);
    }
  }
}
