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

export const FORM_NONE = 0;
export const FORM_HEAP = 1;
export const FORM_GRANARY = 2;
export const FORM_NEST = 3;

export interface LandState {
  readonly width: number;
  readonly height: number;
  readonly food: readonly number[];
  readonly tilled?: readonly number[];
  readonly seeds?: readonly number[];
  readonly soilHealth?: readonly number[];
  readonly pile?: readonly number[];
  readonly compaction?: readonly number[];
  readonly form?: readonly number[];
  readonly brush?: readonly number[];
  readonly trees?: readonly number[];
  readonly fish?: readonly number[];
  readonly stumpAge?: readonly number[];
  readonly cleared?: readonly number[];
  readonly berries?: readonly number[];
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
  /** Food heaped on a cell (plant-side energy: outside the ledger until eaten). */
  public readonly pile: Float32Array;
  /** How tamped down the heap is, 0 up to compactionCap. */
  public readonly compaction: Float32Array;
  /** FORM_NONE, FORM_HEAP or FORM_GRANARY, derived from pile and compaction. */
  public readonly form: Uint8Array;
  /** Brush heaped on a cell (building material, not energy). */
  public readonly brush: Float32Array;
  /** Wood stock on wooded tiles; brush gathering uses it up. */
  public readonly trees: Float32Array;
  /** Wild berries on open fertile tiles. */
  public readonly berries: Float32Array;
  /** Per tile ceilings for trees and berries (derived at construction, not saved). */
  public readonly treeMax: Float32Array;
  /** Fish in water tiles; shore dwellers take them. */
  public readonly fish: Float32Array;
  public readonly fishMax: Float32Array;
  /** Steps from a land tile to the nearest fresh water (1 = beside it); 255 when none or thirst is off. Derived. */
  public readonly waterDist: Uint8Array;
  /** Ticks since a stripped stand became stumps (0 = not stumps). Stumps block regrowth, then rot to field. */
  public readonly stumpAge: Float32Array;
  /** 1 once stumps have rotted away: bare open field where the wood was. */
  public readonly cleared: Uint8Array;
  private berryCapSaved = 15;
  public readonly berryMax: Float32Array;
  /** 1 on woodland cells (cover 0.5 or more), where brush can be gathered. Derived from the terrain; not saved. */
  public readonly wooded: Uint8Array;

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
    this.pile = new Float32Array(TOTAL_CELLS);
    this.compaction = new Float32Array(TOTAL_CELLS);
    this.form = new Uint8Array(TOTAL_CELLS);
    this.brush = new Float32Array(TOTAL_CELLS);
    this.trees = new Float32Array(TOTAL_CELLS);
    this.berries = new Float32Array(TOTAL_CELLS);
    this.treeMax = new Float32Array(TOTAL_CELLS);
    this.fish = new Float32Array(TOTAL_CELLS);
    this.fishMax = new Float32Array(TOTAL_CELLS);
    this.waterDist = new Uint8Array(TOTAL_CELLS).fill(255);
    this.stumpAge = new Float32Array(TOTAL_CELLS);
    this.cleared = new Uint8Array(TOTAL_CELLS);
    this.berryMax = new Float32Array(TOTAL_CELLS);
    this.wooded = new Uint8Array(TOTAL_CELLS);

    const gridConfig = (config.gridWidth === GRID_SIZE && config.gridHeight === GRID_SIZE)
      ? config
      : { ...config, gridWidth: GRID_SIZE, gridHeight: GRID_SIZE, worldWidth: GRID_SIZE, worldHeight: GRID_SIZE };
    this.elevation = elevation ?? (config.elevationEnabled ? generateElevation(gridConfig) : null);
    this.terrain = terrain ?? (config.terrainEnabled ? generateTerrain(gridConfig) : null);

    this.initFoodCapacities(gridConfig);
    const cover = this.terrain?.cover;
    if (cover) {
      for (let i = 0; i < TOTAL_CELLS && i < cover.length; i++) {
        if (this.isWater[i] === 0 && cover[i] >= 32768) this.wooded[i] = 1;
      }
    }
    this.initWater(config);
    const treeCap = config.treeCap ?? 100;
    const berryCap = config.berryCap ?? 15;
    this.berryCapSaved = berryCap;
    for (let i = 0; i < TOTAL_CELLS; i++) {
      if (this.isWater[i] === 1) continue;
      const cf = cover && i < cover.length ? cover[i] / 65535 : 0;
      if (this.wooded[i] === 1) this.treeMax[i] = treeCap * cf;
      else if (this.fertility[i] >= 0.3 && cf < 0.5) this.berryMax[i] = berryCap * this.fertility[i];
      this.trees[i] = this.treeMax[i];
      this.berries[i] = this.berryMax[i];
    }
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

    const finite = config.finiteResourcesEnabled !== false;
    const treeRegrow = (config.treeRegrowRate ?? 0.0005) * growthFactor;
    const stumpBelow = config.stumpBelow ?? 0.08;
    const stumpRot = config.stumpRotTicks ?? 1080;
    const fishRegrow = (config.fishRegrowRate ?? 0.02) * growthFactor;
    const berryRegrow = (config.berryRegrowRate ?? 0.04) * growthFactor;
    const stock = config.stockpilesEnabled !== false;
    const spoil = config.pileSpoil ?? 0.003;
    const granaryFactor = config.granarySpoilFactor ?? 0.2;
    const compDecay = config.compactionDecay ?? 0.0005;
    const heapMin = config.heapMin ?? 2;
    const gMass = config.granaryMass ?? 15;
    const gComp = config.granaryCompaction ?? 1;
    const gKeepMass = config.granaryKeepMass ?? 3;
    const gKeepComp = config.granaryKeepCompaction ?? 0.5;
    const nests = config.nestsEnabled !== false;
    const brushDecay = config.brushDecay ?? 0.002;
    const hMass = config.nestMass ?? 12;
    const hComp = config.nestCompaction ?? 1;
    const hKeepMass = config.nestKeepMass ?? 3;
    const hKeepComp = config.nestKeepCompaction ?? 0.5;

    for (let i = 0; i < TOTAL_CELLS; i++) {
      if (stock && (this.pile[i] > 0 || this.brush[i] > 0 || this.compaction[i] > 0)) {
        let pl = this.pile[i];
        let br = this.brush[i];
        let f = this.form[i];
        pl *= 1 - spoil * (f === FORM_GRANARY ? granaryFactor : 1);
        if (pl < 0.05) pl = 0;
        br *= 1 - brushDecay * (f === FORM_NEST ? granaryFactor : 1);
        if (br < 0.05) br = 0;
        this.pile[i] = pl;
        this.brush[i] = br;
        let c = this.compaction[i];
        c *= 1 - compDecay * (pl < heapMin && br < heapMin ? 10 : 1);
        if (c < 1e-3) c = 0;
        this.compaction[i] = c;
        // A built form stays while it holds enough and is kept tamped; otherwise it falls back.
        if (f === FORM_GRANARY && (pl < gKeepMass || c < gKeepComp)) f = FORM_NONE;
        if (f === FORM_NEST && (br < hKeepMass || c < hKeepComp)) f = FORM_NONE;
        if (f === FORM_NONE || f === FORM_HEAP) {
          const gran = pl >= gMass && c >= gComp;
          const hov = nests && br >= hMass && c >= hComp;
          if (gran && hov) f = pl >= br ? FORM_GRANARY : FORM_NEST;
          else if (gran) f = FORM_GRANARY;
          else if (hov) f = FORM_NEST;
          else f = pl >= heapMin || br >= heapMin ? FORM_HEAP : FORM_NONE;
        }
        this.form[i] = f;
      }
      if (this.isWater[i] === 1) {
        const fm = this.fishMax[i];
        if (finite && fm > 0 && this.fish[i] < fm) this.fish[i] = Math.min(fm, this.fish[i] + fishRegrow * fm);
        continue;
      }
      if (finite) {
        const tm = this.treeMax[i];
        if (tm > 0) {
          if (this.stumpAge[i] > 0) {
            // Stumps shade out saplings: no regrowth until they rot away and leave open field.
            this.stumpAge[i] += 1;
            if (this.stumpAge[i] >= stumpRot) this.clearCell(i, config);
          } else {
            if (this.trees[i] < stumpBelow * tm) this.stumpAge[i] = 1;
            else if (this.trees[i] < tm) this.trees[i] = Math.min(tm, this.trees[i] + treeRegrow * tm);
          }
        }
        const bm = this.berryMax[i];
        if (bm > 0 && this.berries[i] < bm) this.berries[i] = Math.min(bm, this.berries[i] + berryRegrow * bm);
      }
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

  /** Heaps food on a cell (a carrier unloading). */
  public dropFood(x: number, y: number, amount: number, config: Readonly<SimulationConfig>): void {
    const i = ((y & COORD_MASK) << 8) | (x & COORD_MASK);
    if (this.isWater[i] === 1) return;
    this.pile[i] = Math.min(config.pileCap ?? 200, this.pile[i] + amount);
  }

  /** Fish stocks, and the distance to fresh water (lakes and rivers above sea level; the sea is salt). */
  private initWater(config: Readonly<SimulationConfig>): void {
    const elev = this.elevation;
    const fishCap = config.fishCap ?? 20;
    const queue = new Int32Array(TOTAL_CELLS);
    let head = 0, tail = 0;
    const dist = this.waterDist;
    for (let i = 0; i < TOTAL_CELLS; i++) {
      if (this.isWater[i] === 0) continue;
      const fresh = !!elev && elev.elevation[i] / 65535 > elev.seaLevel;
      this.fishMax[i] = fishCap * (fresh ? 1 : 0.7);
      this.fish[i] = this.fishMax[i];
      if (fresh) { dist[i] = 0; queue[tail++] = i; }
    }
    if (tail === 0) return; // no fresh water anywhere: thirst stays off (waterDist 255)
    while (head < tail) {
      const c = queue[head++];
      const x = c & COORD_MASK, y = c >> 8;
      const d = dist[c] + 1;
      if (d > 254) continue;
      const ns = [((y << 8) | ((x + 1) & COORD_MASK)), ((y << 8) | ((x - 1) & COORD_MASK)), ((((y + 1) & COORD_MASK) << 8) | x), ((((y - 1) & COORD_MASK) << 8) | x)];
      for (let k = 0; k < 4; k++) {
        const n = ns[k];
        if (dist[n] !== 255 || this.isWater[n] === 1) continue;
        dist[n] = d;
        queue[tail++] = n;
      }
    }
  }

  /** Takes fish from a water tile beside (x, y); returns the food got. Beside = the four neighbours, in a fixed order. */
  public catchFish(x: number, y: number, want: number): number {
    const ns = [((y & COORD_MASK) << 8) | ((x + 1) & COORD_MASK), ((y & COORD_MASK) << 8) | ((x - 1) & COORD_MASK), (((y + 1) & COORD_MASK) << 8) | (x & COORD_MASK), (((y - 1) & COORD_MASK) << 8) | (x & COORD_MASK)];
    for (let k = 0; k < 4; k++) {
      const n = ns[k];
      if (this.isWater[n] === 1 && this.fish[n] > 0) {
        const got = Math.min(want, this.fish[n]);
        this.fish[n] -= got;
        return got;
      }
    }
    return 0;
  }

  /** Stumps have rotted: the stand is gone for good and the ground is open field with berries. */
  private clearCell(i: number, config: Readonly<SimulationConfig>): void {
    this.cleared[i] = 1;
    this.stumpAge[i] = 0;
    this.treeMax[i] = 0;
    this.trees[i] = 0;
    if (this.fertility[i] >= 0.3) {
      this.berryMax[i] = (config.berryCap ?? 15) * this.fertility[i];
    }
  }

  /** Takes up to `want` brush from the wood on a cell, using up trees; returns the brush got. */
  public cutBrush(x: number, y: number, want: number, config: Readonly<SimulationConfig>): number {
    if (config.finiteResourcesEnabled === false) return want;
    const i = ((y & COORD_MASK) << 8) | (x & COORD_MASK);
    const cost = config.treeBrushCost ?? 0.5;
    const got = Math.min(want, this.trees[i] / cost);
    if (got <= 0) return 0;
    this.trees[i] -= got * cost;
    return got;
  }

  /** Picks up to `want` wild berries on a cell; returns the food energy got. */
  public pickBerries(x: number, y: number, want: number): number {
    const i = ((y & COORD_MASK) << 8) | (x & COORD_MASK);
    const got = Math.min(want, this.berries[i]);
    if (got <= 0) return 0;
    this.berries[i] -= got;
    return got;
  }

  /** Heaps brush on a cell (a carrier unloading). */
  public dropBrush(x: number, y: number, amount: number, config: Readonly<SimulationConfig>): void {
    const i = ((y & COORD_MASK) << 8) | (x & COORD_MASK);
    if (this.isWater[i] === 1) return;
    this.brush[i] = Math.min(config.brushCap ?? 100, this.brush[i] + amount);
  }

  /** Takes up to `want` food from the heap on a cell; returns what came away. */
  public takePile(x: number, y: number, want: number): number {
    const i = ((y & COORD_MASK) << 8) | (x & COORD_MASK);
    const take = Math.min(want, this.pile[i]);
    if (take > 0) this.pile[i] -= take;
    return take > 0 ? take : 0;
  }

  /** One person tamps the heap underfoot. */
  public tamp(x: number, y: number, config: Readonly<SimulationConfig>): void {
    const i = ((y & COORD_MASK) << 8) | (x & COORD_MASK);
    const cap = config.compactionCap ?? 2;
    this.compaction[i] = Math.min(cap, this.compaction[i] + (config.workGain ?? 0.03));
  }

  /**
   * One byte per cell for the viewer: food heap size 3 bits, form 2 bits, then 3 bits that mean
   * brush heap size on open ground and woodland thinning (0 full stand, 7 stripped) on wooded
   * cells. Brush is never unloaded among trees, so the two never collide.
   */
  public packStructures(out: Uint8Array, config: Readonly<SimulationConfig>): void {
    const foodScale = Math.max(1e-6, config.pileScale ?? 60);
    const brushScale = Math.max(1e-6, config.brushScale ?? 30);
    for (let i = 0; i < TOTAL_CELLS; i++) {
      const p = this.pile[i];
      const b = this.brush[i];
      const tm = this.treeMax[i];
      // 0 full stand ... 5 nearly stripped, 6 stumps, 7 open field where the wood was.
      const thin = this.cleared[i] === 1 ? 7 : this.stumpAge[i] > 0 ? 6 : tm > 0 ? Math.min(5, Math.round((1 - this.trees[i] / tm) * 5)) : 0;
      if (p <= 0 && b <= 0 && this.form[i] === 0 && thin === 0) { out[i] = 0; continue; }
      const level = Math.min(7, Math.round(Math.sqrt(Math.min(1, p / foodScale)) * 7));
      const bLevel = this.wooded[i] === 1 ? thin : Math.min(7, Math.round(Math.sqrt(Math.min(1, b / brushScale)) * 7));
      out[i] = level | (this.form[i] << 3) | (bLevel << 5);
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
      // Square-root scale so lightly worked soil still shows.
      const farmLevel = Math.min(7, Math.round(Math.sqrt(Math.min(1, this.tilled[i])) * 7));
      const seedLevel = Math.min(3, Math.round((this.seeds[i] / seedCap) * 3));
      out[i] = dmg | (farmLevel << 3) | (seedLevel << 6);
    }
  }

  /**
   * Forages plant food from cell (x, y).
   * Returns actual energy harvested (leaves floor intact).
   */
  public graze(x: number, y: number, want: number, config: Readonly<SimulationConfig>, till = true): number {
    const index = (y & COORD_MASK) * GRID_SIZE + (x & COORD_MASK);
    if (this.isWater[index] === 1) return 0;

    const floor = config.landGrazingFloor ?? 1.0;
    const available = this.food[index] - floor;
    if (available <= 0) return 0;

    const take = Math.min(want, available);
    this.food[index] -= take;
    if (config.farmingPhysicsEnabled !== false) {
      // Working a cell tills it; stripping it down wears the soil out.
      if (till) this.tilled[index] += (config.tillGain ?? 0.02) * (1 - this.tilled[index]);
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
      pile: Array.from(this.pile),
      compaction: Array.from(this.compaction),
      form: Array.from(this.form),
      brush: Array.from(this.brush),
      trees: Array.from(this.trees),
      fish: Array.from(this.fish),
      stumpAge: Array.from(this.stumpAge),
      cleared: Array.from(this.cleared),
      berries: Array.from(this.berries),
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
    if (state.pile) for (let i = 0; i < len; i++) this.pile[i] = state.pile[i] ?? 0;
    if (state.compaction) for (let i = 0; i < len; i++) this.compaction[i] = state.compaction[i] ?? 0;
    if (state.form) for (let i = 0; i < len; i++) this.form[i] = state.form[i] ?? 0;
    if (state.brush) for (let i = 0; i < len; i++) this.brush[i] = state.brush[i] ?? 0;
    if (state.fish) for (let i = 0; i < len; i++) this.fish[i] = state.fish[i] ?? 0;
    if (state.trees) for (let i = 0; i < len; i++) this.trees[i] = state.trees[i] ?? 0;
    if (state.stumpAge) for (let i = 0; i < len; i++) this.stumpAge[i] = state.stumpAge[i] ?? 0;
    if (state.cleared) {
      for (let i = 0; i < len; i++) {
        if ((state.cleared[i] ?? 0) === 1) { this.cleared[i] = 1; this.treeMax[i] = 0; this.stumpAge[i] = 0; if (this.fertility[i] >= 0.3) this.berryMax[i] = this.berryCapSaved * this.fertility[i]; }
      }
    }
    if (state.berries) for (let i = 0; i < len; i++) this.berries[i] = state.berries[i] ?? 0;
  }
}
