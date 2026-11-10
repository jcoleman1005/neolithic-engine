import { type ElevationField, generateElevation } from './elevation';
import { type TerrainField, generateTerrain } from './terrain';
import { PRNG } from './prng';
import type { SimulationConfig } from './types';
import { ContestLog } from './contest-log';

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
  readonly fertility?: readonly number[];
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
  readonly fire?: readonly number[];
  readonly stone?: readonly number[];
  readonly durability?: readonly number[];
  /** Path wear (S2); absent in older saves. */
  readonly wear?: readonly number[];
  /** What built tiles are made of (S3); absent in older saves. */
  readonly material?: readonly number[];
  readonly exposure?: readonly number[];
  /** Carried-water stores (S3w); absent in older saves. */
  readonly waterStore?: readonly number[];
  readonly waterFindable?: readonly number[];
  /** Far-sight block food map; absent in older saves. */
  readonly blockFood?: readonly number[];
  readonly structure?: readonly number[];
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
  private baseFoodCap = 20;
  public readonly berryMax: Float32Array;
  /** 1 on woodland cells (cover 0.5 or more), where brush can be gathered. Derived from the terrain; not saved. */
  public readonly wooded: Uint8Array;
  /** 1 on natural cave cells (hill edges): shelter from the cold. Derived from the elevation and seed; not saved. */
  public readonly cave: Uint8Array;
  /** 1 where a campfire burns its brush heap. Saved. */
  public readonly fire: Uint8Array;
  /** 1 within the warm radius of a burning fire. Derived; rebuilt when the set of fires changes. */
  public readonly fireNear: Uint8Array;
  /** Steps to the nearest burning fire or cave (255 = none within the seek radius). Derived like fireNear. */
  public readonly warmDist: Uint8Array;
  /** Height above the lowland, 0..1 (0 with no elevation). Derived. */
  public readonly upland: Float32Array;
  /** Quarryable stone on rock (hill) cells. Finite. Saved. */
  public readonly stone: Float32Array;
  /** Build progress per cell, 0..durabilityCap; erodes slowly. Saved. */
  public readonly durability: Uint8Array;
  /** Observer only: recent contests for the viewer (not saved, not hashed; see ContestLog). */
  public readonly contests = new ContestLog();
  /** S2: how worn the ground is by feet, 0 to 255. Saved; hashed only while paths are on. */
  public readonly wear: Uint8Array;
  /** S3: what a built tile is made of: 0 nothing, 1 packed earth, 2 stone. */
  public readonly material: Uint8Array;
  /** S3a: how open a tile is to the wind, 0 enclosed to 255 open. Refreshed in slices, so saved. */
  public readonly exposure: Uint8Array;
  /** Shore test 2: mean standing plant food per 16 x 16 block, refreshed on a fixed interval. Saved; hashed when on. */
  public readonly blockFood = new Float32Array(256);
  /** S3w: water poured into a store on this tile. Saved; hashed only while carried water is on. */
  public readonly waterStore: Float32Array;
  /** S3w: 1 while thirsty people can find this store (set at the find level, cleared below half). Saved. */
  public readonly waterFindable: Uint8Array;
  /** S3w: steps to drinkable water: fresh rivers and lakes, plus findable stores. Derived, not saved. */
  public readonly drinkDist: Uint8Array;
  private drinkDirty = true;
  private readonly drinkQueue = new Int32Array(TOTAL_CELLS);
  /** S3a: where the wind comes from this season, as a unit vector. */
  public windX = 0;
  public windY = -1;
  /** 0 none, 1 hut. Set when durability reaches hutDurability, cleared when erosion takes it under hutKeep. Saved. */
  public readonly structure: Uint8Array;
  public hutCount = 0;
  /** Fresh grave marks (viewer only, not saved or hashed): a ring of 64. */
  public readonly graveX = new Uint8Array(64);
  public readonly graveY = new Uint8Array(64);
  public readonly graveLeft = new Uint16Array(64);
  private graveHead = 0;
  /** Violent and wound deaths so far (a tally for reports; not saved or hashed). */
  public violentDeaths = 0;
  public caveCells: number[] = [];
  public fireCount = 0;
  private warmDirty = true;
  /** Seasonal temperature this tick (set by the life system), and the cold thresholds it is judged by. */
  public seasonTemp = 0;
  private coldComfort = -0.4;
  private coldSpan = 0.6;
  private coldLapse = 0.4;

  public terrain: TerrainField | null = null;
  public elevation: ElevationField | null = null;

  constructor(config: Readonly<SimulationConfig>, elevation?: ElevationField | null, terrain?: TerrainField | null) {
    this.baseFoodCap = config.landFoodMax ?? 20.0;
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
    this.cave = new Uint8Array(TOTAL_CELLS);
    this.stone = new Float32Array(TOTAL_CELLS);
    this.durability = new Uint8Array(TOTAL_CELLS);
    this.wear = new Uint8Array(TOTAL_CELLS);
    this.material = new Uint8Array(TOTAL_CELLS);
    this.waterStore = new Float32Array(TOTAL_CELLS);
    this.waterFindable = new Uint8Array(TOTAL_CELLS);
    this.drinkDist = new Uint8Array(TOTAL_CELLS).fill(255);
    this.exposure = new Uint8Array(TOTAL_CELLS).fill(255);
    this.structure = new Uint8Array(TOTAL_CELLS);
    this.fire = new Uint8Array(TOTAL_CELLS);
    this.fireNear = new Uint8Array(TOTAL_CELLS);
    this.warmDist = new Uint8Array(TOTAL_CELLS).fill(255);
    this.upland = new Float32Array(TOTAL_CELLS);

    const gridConfig = (config.gridWidth === GRID_SIZE && config.gridHeight === GRID_SIZE)
      ? config
      : { ...config, gridWidth: GRID_SIZE, gridHeight: GRID_SIZE, worldWidth: GRID_SIZE, worldHeight: GRID_SIZE };
    this.elevation = elevation ?? (config.elevationEnabled ? generateElevation(gridConfig) : null);
    this.terrain = terrain ?? (config.terrainEnabled ? generateTerrain(gridConfig) : null);

    this.initStone(gridConfig);
    this.initFoodCapacities(gridConfig);
    const cover = this.terrain?.cover;
    if (cover) {
      // Woodland is exactly where the viewer draws trees: lowland (below the hill level), not on a shore, cover 0.5 or more.
      const elev = this.elevation;
      for (let i = 0; i < TOTAL_CELLS && i < cover.length; i++) {
        if (this.isWater[i] === 1 || cover[i] < 32768) continue;
        if (elev) {
          const x = i & COORD_MASK, y = i >> 8;
          const h = elev.elevation[i] / 65535;
          const shore = this.isWater[(y << 8) | ((x + 1) & COORD_MASK)] === 1 || this.isWater[(y << 8) | ((x - 1) & COORD_MASK)] === 1 ||
            this.isWater[(((y + 1) & COORD_MASK) << 8) | x] === 1 || this.isWater[(((y - 1) & COORD_MASK) << 8) | x] === 1 ||
            h < elev.seaLevel + 0.015;
          if (shore || h >= (config.elevationHillLevel ?? 0.68)) continue;
        }
        this.wooded[i] = 1;
      }
    }
    this.initWater(config);
    this.initCaves(config);
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
    this.baseFoodCap = baseCap;
    const elev = this.elevation;
    const stoneBarren = config.stoneBarrenEnabled !== false;
    const rockLevel = config.elevationHillLevel ?? 0.68;

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
      const isRock = stoneBarren && (this.stone[i] > 0 || (elev && i < elev.elevation.length && elev.elevation[i] / 65535 >= rockLevel));
      this.fertility[i] = isRock ? 0 : f;

      if (water || isRock) {
        this.maxFood[i] = 0;
        this.food[i] = 0;
      } else {
        const cap = baseCap * this.fertility[i];
        this.maxFood[i] = cap;
        // Start near capacity
        this.food[i] = cap * 0.8;
      }
    }
  }

  /** Food capacity of a cell now: natural capacity, scaled by soil health and the seeds on it. */
  public capacityAt(i: number, config: Readonly<SimulationConfig>): number {
    const max = this.maxFood[i];
    if (max <= 0) return 0;
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
    const tendingOn = config.tendingEnabled !== false && farm;
    const tendingBoost = config.tendingRegrowBoost ?? 0.40;

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

    const fertChange = config.fertilityChangeEnabled !== false;
    const fertMax = config.fertilityMax ?? 1.5;
    const fertPassive = config.fertilityPassiveGain ?? 0.00005;
    const fertCompost = config.fertilityCompostGain ?? 0.0005;
    const baseFoodCap = this.baseFoodCap;
    const berryCapSaved = this.berryCapSaved;

    for (let i = 0; i < TOTAL_CELLS; i++) {
      if (stock && (this.pile[i] > 0 || this.brush[i] > 0 || this.compaction[i] > 0)) {
        let pl = this.pile[i];
        let br = this.brush[i];
        let f = this.form[i];
        const oldPl = pl;
        pl *= 1 - spoil * (f === FORM_GRANARY ? granaryFactor : 1);
        if (pl < 0.05) pl = 0;
        br *= 1 - brushDecay * (f === FORM_NEST ? granaryFactor : 1);
        if (br < 0.05) br = 0;
        this.pile[i] = pl;
        this.brush[i] = br;
        if (fertChange && oldPl > pl && this.isWater[i] === 0) {
          const spoiled = oldPl - pl;
          if (spoiled > 0.01) {
            const curF = this.fertility[i];
            if (curF < fertMax) {
              const compostGain = fertCompost * Math.min(1, spoiled / 5.0);
              const nextF = Math.min(fertMax, curF + compostGain * (1 - curF / fertMax));
              this.fertility[i] = nextF;
              this.maxFood[i] = baseFoodCap * this.fertility[i];
              if (this.berryMax[i] > 0) this.berryMax[i] = berryCapSaved * this.fertility[i];
            }
          }
        }
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
        if (f !== this.form[i] && (f === FORM_NEST || this.form[i] === FORM_NEST) && config.shelterSeekEnabled !== false) {
          this.warmDirty = true;
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
        if (fertChange && t > 0.05 && sd > 0.1 && cur > 0.25 * max && sh > 0.5) {
          const curF = this.fertility[i];
          if (curF < fertMax) {
            const fGain = fertPassive * (1 - curF / fertMax) * (t * sf);
            const nextF = Math.min(fertMax, curF + fGain);
            if (nextF !== curF) {
              this.fertility[i] = nextF;
              this.maxFood[i] = baseFoodCap * this.fertility[i];
              if (this.berryMax[i] > 0) this.berryMax[i] = berryCapSaved * this.fertility[i];
            }
          }
        }
        cap = max * sh * (1 + seedCapBoost * sf);
        const tendBonus = tendingOn && t > 0.25 ? tendingBoost * Math.min(1, t) : 0;
        rate = baseRate * (1 + tillBoost * t + seedRegrow * sf + tendBonus);
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

  /** Stone on hill and rock cells. */
  private initStone(config: Readonly<SimulationConfig>): void {
    const elev = this.elevation;
    if (!elev) return;
    for (let i = 0; i < TOTAL_CELLS; i++) this.upland[i] = elev.upland01(i);
    const rockLevel = config.elevationHillLevel ?? 0.68;
    for (let i = 0; i < TOTAL_CELLS; i++) {
      if (this.isWater[i] === 0 && elev.elevation[i] / 65535 >= rockLevel) this.stone[i] = config.stoneCap ?? 30;
    }
  }

  /** Natural caves built into the sides of hills and mountains, spaced apart, picked with a seeded shuffle. */
  private initCaves(config: Readonly<SimulationConfig>): void {
    const elev = this.elevation;
    if (!elev || config.cavesEnabled === false) return;
    const hill = config.elevationHillLevel ?? 0.68;
    const cands: number[] = [];
    for (let i = 0; i < TOTAL_CELLS; i++) {
      if (this.isWater[i] === 1) continue;
      const h = elev.elevation[i] / 65535;
      // Must be at least in the highland/hill elevations
      if (h < hill) continue;
      const x = i & COORD_MASK, y = i >> 8;
      const ns = [(y << 8) | ((x + 1) & COORD_MASK), (y << 8) | ((x - 1) & COORD_MASK), (((y + 1) & COORD_MASK) << 8) | x, (((y - 1) & COORD_MASK) << 8) | x];
      
      let downhillDrop = false;
      let uphillRockWall = false;
      for (let k = 0; k < 4; k++) {
        const nh = elev.elevation[ns[k]] / 65535;
        // Front drop: adjacent dry land tile that is noticeably lower (cliff face or hill slope)
        if (this.isWater[ns[k]] === 0 && nh <= h - 0.015) downhillDrop = true;
        // Back rock wall: hill or mountain mass rising behind the cave opening
        if (nh >= h + 0.015) uphillRockWall = true;
      }
      // A genuine hillside/mountain cave requires an uphill cliff behind it and a drop in front
      if (downhillDrop && uphillRockWall) cands.push(i);
    }
    const rng = new PRNG(((config.seed ?? 0) ^ 0x5ca5e) >>> 0);
    for (let k = cands.length - 1; k > 0; k--) {
      const j = rng.nextInt(0, k + 1);
      const t = cands[k]; cands[k] = cands[j]; cands[j] = t;
    }
    const want = config.caveCount ?? 40;
    const gap = config.caveSpacing ?? 6;
    for (let k = 0; k < cands.length && this.caveCells.length < want; k++) {
      const c = cands[k];
      const cx = c & COORD_MASK, cy = c >> 8;
      let ok = true;
      for (let m = 0; m < this.caveCells.length && ok; m++) {
        const o = this.caveCells[m];
        const dx = Math.abs(((o & COORD_MASK) - cx + 384) % 256 - 128), dy = Math.abs((((o >> 8) - cy + 384) % 256) - 128);
        if (Math.max(dx, dy) < gap) ok = false;
      }
      if (ok) { this.caveCells.push(c); this.cave[c] = 1; }
    }
    this.caveCells.sort((a, b) => a - b);
  }

  /** Leaves a grave mark where someone died violently or of a wound. */
  public markDeath(x: number, y: number, ticks: number): void {
    this.violentDeaths++;
    const i = this.graveHead++ & 63;
    this.graveX[i] = x & COORD_MASK;
    this.graveY[i] = y & COORD_MASK;
    this.graveLeft[i] = ticks;
  }

  /** Ages grave marks by one tick. */
  public ageGraves(): void {
    for (let i = 0; i < 64; i++) if (this.graveLeft[i] > 0) this.graveLeft[i]--;
  }

  /** Takes up to `want` stone from a rock cell; returns what came away. */
  public quarry(x: number, y: number, want: number): number {
    const i = ((y & COORD_MASK) << 8) | (x & COORD_MASK);
    const got = Math.min(want, this.stone[i]);
    if (got <= 0) return 0;
    this.stone[i] -= got;
    return got;
  }

  /** Sets stone down on a cell: adds durability, and the cell becomes a hut once it holds enough. */
  public build(x: number, y: number, amount: number, config: Readonly<SimulationConfig>, earth = false): void {
    const i = ((y & COORD_MASK) << 8) | (x & COORD_MASK);
    if (this.isWater[i] === 1) return;
    const cap = config.durabilityCap ?? 255;
    const gain = earth ? config.earthBuildGain ?? 2 : config.buildGain ?? 4;
    this.durability[i] = Math.min(cap, Math.round(this.durability[i] + amount * gain));
    // A tile with any stone in it counts as stone; earth only marks a tile that has none.
    if (config.earthBuildingEnabled !== false) this.material[i] = earth ? (this.material[i] === 2 ? 2 : 1) : 2;
    if (this.structure[i] === 0 && this.durability[i] >= (config.hutDurability ?? 60)) {
      this.structure[i] = 1;
      this.hutCount++;
      if (config.shelterSeekEnabled !== false) this.warmDirty = true;
    }
  }

  /** S2: a step onto this tile wears it. */
  public trample(i: number, config: Readonly<SimulationConfig>): void {
    const w = this.wear[i] + (config.wearStep ?? 16);
    this.wear[i] = w > 255 ? 255 : w;
  }

  /** S2: unused ground recovers, one slice of the map a tick, so each tile loses 1 per wearDecaySlices ticks. */
  public wearDown(tick: number, config: Readonly<SimulationConfig>): void {
    const slices = Math.max(1, config.wearDecaySlices ?? 8);
    const wear = this.wear;
    for (let i = tick % slices; i < TOTAL_CELLS; i += slices) {
      if (wear[i] > 0) wear[i]--;
    }
  }

  /** S2: path wear for the viewer, 0 to 7 per tile. */
  public packPaths(out: Uint8Array, config?: Readonly<SimulationConfig>): void {
    // Ground channel: wear in bits 0 to 2, (S3 viewer) build progress on a not-yet-hut tile in bits 3 and 4
    // (0 none, 1 to 3 thirds of hutDurability), packed earth in bit 5, and (S3w) the water store level in bits 6 and 7.
    const cap = config?.waterStoreCap ?? 100;
    const hut = Math.max(1, config?.hutDurability ?? 60);
    for (let i = 0; i < TOTAL_CELLS; i++) {
      const s = this.waterStore[i];
      const lvl = s <= 0 ? 0 : s < cap / 3 ? 1 : s < (2 * cap) / 3 ? 2 : 3;
      const d = this.durability[i];
      const build = d === 0 || this.structure[i] !== 0 ? 0 : Math.min(3, 1 + Math.floor((d * 3) / hut));
      const earth = d !== 0 && this.material[i] === 1 ? 32 : 0;
      out[i] = (this.wear[i] >> 5) | (build << 3) | earth | (lvl << 6);
    }
  }

  /** Wears every built tile down by 1, one slice of the map a tick, so each loses 1 per erosionSlices ticks. */
  public erode(tick: number, config: Readonly<SimulationConfig>): void {
    const slices = Math.max(1, config.erosionSlices ?? 64);
    const keep = config.hutKeep ?? 20;
    for (let i = tick % slices; i < TOTAL_CELLS; i += slices) {
      if (this.durability[i] !== 0) this.wearBuilt(i, keep, config);
    }
    // S3: packed earth also washes away on a faster slice of its own.
    if (config.earthBuildingEnabled !== false) {
      const es = Math.max(1, config.earthErodeSlices ?? 32);
      for (let i = tick % es; i < TOTAL_CELLS; i += es) {
        if (this.material[i] === 1 && this.durability[i] !== 0) this.wearBuilt(i, keep, config);
      }
    }
  }

  /** S3 unit D: someone crossing a wall wears `n` durability off it, with the same hut bookkeeping as erosion. */
  public crossWall(i: number, n: number, config: Readonly<SimulationConfig>): void {
    const keep = config.hutKeep ?? 20;
    for (let k = 0; k < n && this.durability[i] !== 0; k++) this.wearBuilt(i, keep, config);
  }

  private wearBuilt(i: number, keep: number, config: Readonly<SimulationConfig>): void {
    const d = this.durability[i] - 1;
    this.durability[i] = d;
    if (d === 0) this.material[i] = 0;
    if (this.structure[i] === 1 && d < keep) {
      this.structure[i] = 0;
      this.hutCount--;
      if (config.shelterSeekEnabled !== false) this.warmDirty = true;
    }
  }

  /** Shore test 2: recomputes the block food map (mean standing plant food on land per 16 x 16 block). */
  public refreshBlockFood(): void {
    for (let by = 0; by < 16; by++) {
      for (let bx = 0; bx < 16; bx++) {
        let sum = 0, n = 0;
        for (let y = by * 16; y < by * 16 + 16; y++) {
          for (let x = bx * 16; x < bx * 16 + 16; x++) {
            const c = (y << 8) | x;
            if (this.isWater[c] === 1) continue;
            sum += this.food[c];
            n++;
          }
        }
        this.blockFood[by * 16 + bx] = n > 0 ? sum / n : 0;
      }
    }
  }

  /** S3w: rebuilds the drinkable-water distance when a store has been found or lost. */
  public refreshDrink(): void {
    if (!this.drinkDirty) return;
    this.drinkDirty = false;
    const dist = this.drinkDist;
    const queue = this.drinkQueue;
    dist.fill(255);
    let head = 0, tail = 0;
    for (let i = 0; i < TOTAL_CELLS; i++) {
      if (this.waterDist[i] === 0 || this.waterFindable[i] === 1) { dist[i] = 0; queue[tail++] = i; }
    }
    while (head < tail) {
      const c = queue[head++];
      const d = dist[c] + 1;
      if (d > 254) continue;
      const x = c & COORD_MASK, y = c >> 8;
      for (let k = 0; k < 4; k++) {
        const n = k === 0 ? (y << 8) | ((x + 1) & COORD_MASK)
          : k === 1 ? (y << 8) | ((x - 1) & COORD_MASK)
          : k === 2 ? (((y + 1) & COORD_MASK) << 8) | x
          : (((y - 1) & COORD_MASK) << 8) | x;
        if (dist[n] !== 255 || this.isWater[n] === 1) continue;
        dist[n] = d;
        queue[tail++] = n;
      }
    }
  }

  /** S3w: keeps a store's findable state, with hysteresis so it does not flicker. */
  private updateFindable(i: number, config: Readonly<SimulationConfig>): void {
    const min = config.waterStoreFindMin ?? 10;
    const v = this.waterStore[i];
    if (this.waterFindable[i] === 0 && v >= min) { this.waterFindable[i] = 1; this.drinkDirty = true; }
    else if (this.waterFindable[i] === 1 && v < min / 2) { this.waterFindable[i] = 0; this.drinkDirty = true; }
  }

  /** S3w: pours water into a tile's store; returns how much went in. */
  public pourWater(i: number, amount: number, config: Readonly<SimulationConfig>): number {
    const room = (config.waterStoreCap ?? 100) - this.waterStore[i];
    const got = amount < room ? amount : room > 0 ? room : 0;
    this.waterStore[i] += got;
    this.updateFindable(i, config);
    return got;
  }

  /** S3w: takes water from a tile's store to drink; returns how much came out. */
  public takeWater(i: number, want: number, config: Readonly<SimulationConfig>): number {
    const got = want < this.waterStore[i] ? want : this.waterStore[i];
    this.waterStore[i] -= got;
    this.updateFindable(i, config);
    return got;
  }

  /** Neighbour offsets in a fixed order (own tile first), for reaching into the tiles around someone. */
  private static readonly REACH_DX = [0, -1, 0, 1, -1, 1, -1, 0, 1];
  private static readonly REACH_DY = [0, -1, -1, -1, 0, 0, 1, 1, 1];

  /** Food heaped on this tile and the 8 around it. */
  public pileInReach(x: number, y: number): number {
    let sum = 0;
    for (let k = 0; k < 9; k++) sum += this.pile[(((y + Land.REACH_DY[k]) & COORD_MASK) << 8) | ((x + Land.REACH_DX[k]) & COORD_MASK)];
    return sum;
  }

  /** Eats from heaps on this tile first, then the 8 around it in a fixed order. Returns what was eaten. */
  public takePileInReach(x: number, y: number, want: number): number {
    let got = 0;
    for (let k = 0; k < 9 && got < want; k++) {
      got += this.takePile(x + Land.REACH_DX[k], y + Land.REACH_DY[k], want - got);
    }
    return got;
  }

  /** S3w: whether any water store is on this tile or the 8 around it. */
  public waterInReach(x: number, y: number): boolean {
    for (let k = 0; k < 9; k++) {
      if (this.waterStore[(((y + Land.REACH_DY[k]) & COORD_MASK) << 8) | ((x + Land.REACH_DX[k]) & COORD_MASK)] > 0) return true;
    }
    return false;
  }

  /** S3w: drinks from stores on this tile first, then the 8 around it. Returns what was drunk. */
  public drinkInReach(x: number, y: number, want: number, config: Readonly<SimulationConfig>): number {
    let got = 0;
    for (let k = 0; k < 9 && got < want; k++) {
      const c = (((y + Land.REACH_DY[k]) & COORD_MASK) << 8) | ((x + Land.REACH_DX[k]) & COORD_MASK);
      if (this.waterStore[c] > 0) got += this.takeWater(c, want - got, config);
    }
    return got;
  }

  /** S3w: stores dry out, faster when warm, much slower on a built (covered) tile. */
  public evaporateWater(config: Readonly<SimulationConfig>): void {
    const warm = this.seasonTemp > 0 ? this.seasonTemp : 0;
    const base = (config.waterEvaporation ?? 0.05) * (1 + (config.waterEvapWarm ?? 2) * warm);
    const covered = config.waterCoveredEvapMul ?? 0.25;
    const store = this.waterStore;
    for (let i = 0; i < TOTAL_CELLS; i++) {
      if (store[i] <= 0) continue;
      const roof = this.durability[i] > 0 || this.structure[i] === 1 || this.form[i] === FORM_NEST;
      const v = store[i] - base * (roof ? covered : 1);
      store[i] = v > 0 ? v : 0;
      this.updateFindable(i, config);
    }
  }

  /** S3: digs packed earth from trodden ground. Returns what came away. */
  public dig(i: number, want: number, config: Readonly<SimulationConfig>): number {
    if (this.isWater[i] === 1 || this.wooded[i] === 1 || this.stone[i] > 0 || this.durability[i] > 0) return 0;
    if (this.wear[i] < (config.earthWear ?? 64)) return 0;
    return want;
  }

  /** S3a: how much a tile shelters its neighbours: built walls, brush, trees and higher ground. */
  public barrierAt(n: number, from: number, config: Readonly<SimulationConfig>): number {
    let b = this.durability[n] + this.brush[n] * (config.brushBarrier ?? 4);
    const tm = this.treeMax[n];
    if (tm > 0) b += (config.treeBarrier ?? 120) * (this.trees[n] / tm);
    const rise = this.upland[n] - this.upland[from];
    if (rise > 0) b += rise * (config.cliffBarrier ?? 600);
    return b > 255 ? 255 : b;
  }

  /** S3a: weight of the neighbour at (dx, dy): the upwind side counts more. */
  public windWeightTo(dx: number, dy: number, config: Readonly<SimulationConfig>): number {
    const len = dx !== 0 && dy !== 0 ? Math.SQRT2 : 1;
    const along = (dx * this.windX + dy * this.windY) / len;
    return (dx !== 0 && dy !== 0 ? 0.5 : 1) * (1 + (config.windWeight ?? 2) * (along > 0 ? along : 0));
  }

  /** S3a: sets where this season's wind comes from (turning once round the compass a year). */
  public setWind(phase: number): void {
    this.windX = Math.cos(2 * Math.PI * phase);
    this.windY = Math.sin(2 * Math.PI * phase);
  }

  /** S3a: exposure of one tile: 255 less the wind-weighted average barrier around it; caves are covered. */
  public exposureOf(i: number, config: Readonly<SimulationConfig>): number {
    if (this.cave[i] === 1) return 0;
    const x = i & COORD_MASK, y = i >> 8;
    let sum = 0, total = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const w = this.windWeightTo(dx, dy, config);
        sum += w * this.barrierAt((((y + dy) & COORD_MASK) << 8) | ((x + dx) & COORD_MASK), i, config);
        total += w;
      }
    }
    const e = 255 - sum / total;
    let out = e < 0 ? 0 : Math.round(e);
    // Unit C idea 1: walled in on all four sides within roomMaxSpan, so indoors.
    if (config.exposureRaysEnabled !== false) {
      const indoor = config.indoorBaseExposure ?? 15;
      if (out > indoor && this.enclosed(x, y, config)) out = indoor;
    }
    // Unit C idea 2: in the shadow of a wall, cave, wood or rise upwind.
    if (config.windShadowEnabled !== false) {
      const shadow = Math.max(config.windShadowFloor ?? 30, 255 - (config.windbreakReduction ?? 140));
      if (out > shadow && this.inWindShadow(x, y, config)) out = shadow;
    }
    return out;
  }

  /**
   * S3 unit C idea 2: a wall (durability >= wallThreshold), cave, wood or ground higher by more than
   * windShadowRise within windShadowReach tiles upwind. (windX, windY) points to where the wind comes
   * from (setWind), so upwind is along its sign. The ray takes the nearest of the 8 compass steps: a
   * component under sin(22.5 deg) counts as no wind that way (the old 5f code's 0.2 snapped most
   * headings to a diagonal, because main's wind turns smoothly round the year).
   */
  public inWindShadow(x: number, y: number, config: Readonly<SimulationConfig>): boolean {
    const cut = 0.3827; // sin(22.5 deg)
    const ux = this.windX > cut ? 1 : this.windX < -cut ? -1 : 0;
    const uy = this.windY > cut ? 1 : this.windY < -cut ? -1 : 0;
    if (ux === 0 && uy === 0) return false;
    const reach = config.windShadowReach ?? 3;
    const wall = config.wallThreshold ?? 30;
    const rise = this.upland[(y << 8) | x] + (config.windShadowRise ?? 0.05);
    for (let s = 1; s <= reach; s++) {
      const n = (((y + uy * s) & COORD_MASK) << 8) | ((x + ux * s) & COORD_MASK);
      if (this.durability[n] >= wall || this.cave[n] === 1 || this.wooded[n] === 1 || this.upland[n] > rise) return true;
    }
    return false;
  }

  /** S3 unit C idea 1: a wall (durability >= wallThreshold) or a cave within roomMaxSpan tiles straight N, S, W and E. */
  public enclosed(x: number, y: number, config: Readonly<SimulationConfig>): boolean {
    const span = config.roomMaxSpan ?? 4;
    const wall = config.wallThreshold ?? 30;
    // Early exit on the first open side.
    for (let side = 0; side < 4; side++) {
      const sx = side === 2 ? -1 : side === 3 ? 1 : 0;
      const sy = side === 0 ? -1 : side === 1 ? 1 : 0;
      let hit = false;
      for (let d = 1; d <= span; d++) {
        const n = (((y + sy * d) & COORD_MASK) << 8) | ((x + sx * d) & COORD_MASK);
        if (this.durability[n] >= wall || this.cave[n] === 1) { hit = true; break; }
      }
      if (!hit) return false;
    }
    return true;
  }

  /** S3a: refreshes exposure on one slice of the map. */
  public updateExposure(tick: number, config: Readonly<SimulationConfig>): void {
    const slices = Math.max(1, config.exposureSlices ?? 8);
    for (let i = tick % slices; i < TOTAL_CELLS; i += slices) this.exposure[i] = this.exposureOf(i, config);
  }

  /**
   * S3a: the neighbouring tile where `gain` durability would shelter tile (x, y) most, given the wind;
   * -1 when no neighbour would help. Skips water, caves, burning tiles (S3 unit D), occupied tiles and worn routes.
   */
  public bestShelterNeighbour(x: number, y: number, gain: number, occupied: (c: number) => boolean, config: Readonly<SimulationConfig>): number {
    const avoidWear = config.directionalAvoidWear ?? 64;
    const from = (y << 8) | x;
    let best = -1, bestScore = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const n = (((y + dy) & COORD_MASK) << 8) | ((x + dx) & COORD_MASK);
        if (this.isWater[n] === 1 || this.wear[n] >= avoidWear || this.cave[n] === 1 || this.fire[n] === 1 || occupied(n)) continue;
        const room = 255 - this.barrierAt(n, from, config);
        const score = this.windWeightTo(dx, dy, config) * (gain < room ? gain : room);
        if (score > bestScore) { bestScore = score; best = n; }
      }
    }
    return best;
  }

  /** Sets this tick's seasonal temperature and the cold thresholds (called once a tick by the life system). */
  public setSeason(temp: number, config: Readonly<SimulationConfig>): void {
    this.seasonTemp = temp;
    this.coldComfort = config.coldComfort ?? -0.4;
    this.coldSpan = Math.max(1e-6, config.coldSpan ?? 0.6);
    this.coldLapse = config.elevationLapse ?? 0.4;
  }

  /** How cold a cell feels, 0 (comfortable) to 1 (bitter): the season and the height. */
  public coldAt(i: number): number {
    const c = (this.coldComfort - (this.seasonTemp - this.coldLapse * this.upland[i])) / this.coldSpan;
    return c <= 0 ? 0 : c >= 1 ? 1 : c;
  }

  /** Out of the cold: in a cave, beside a burning fire, or standing in a built nest. */
  public sheltered(i: number): boolean {
    return this.cave[i] === 1 || this.fireNear[i] === 1 || this.form[i] === FORM_NEST || this.structure[i] === 1;
  }

  /** Lights a fire on a brush heap that is big enough (and not a built nest). Returns whether it caught. */
  public ignite(i: number, config: Readonly<SimulationConfig>): boolean {
    if (this.fire[i] === 1 || this.isWater[i] === 1 || this.form[i] === FORM_NEST) return false;
    if (this.brush[i] < (config.fireIgniteBrush ?? 6)) return false;
    this.fire[i] = 1;
    this.fireCount++;
    this.warmDirty = true;
    return true;
  }

  /** Burns each fire's brush down; a fire with no brush left goes out. */
  public burnFires(config: Readonly<SimulationConfig>): void {
    if (this.fireCount === 0) return;
    const rate = config.fireBurnRate ?? 0.15;
    for (let i = 0; i < TOTAL_CELLS; i++) {
      if (this.fire[i] === 0) continue;
      const b = this.brush[i] - rate;
      if (b <= 0) {
        this.brush[i] = 0;
        this.fire[i] = 0;
        this.fireCount--;
        this.warmDirty = true;
      } else this.brush[i] = b;
    }
  }

  /** Rebuilds the warm radius mask and the distance to fire or cave, but only when the fires changed. */
  public refreshWarmth(config: Readonly<SimulationConfig>): void {
    if (!this.warmDirty) return;
    this.warmDirty = false;
    const radius = config.fireWarmRadius ?? 2;
    const seek = Math.min(254, config.fireSeekRadius ?? 12);
    this.fireNear.fill(0);
    this.warmDist.fill(255);
    const queue: number[] = [];
    for (let i = 0; i < TOTAL_CELLS; i++) {
      if (this.fire[i] === 1) {
        const x = i & COORD_MASK, y = i >> 8;
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const n = (((y + dy) & COORD_MASK) << 8) | ((x + dx) & COORD_MASK);
            if (this.isWater[n] === 0) this.fireNear[n] = 1;
          }
        }
        this.warmDist[i] = 0;
        queue.push(i);
      }
    }
    for (let k = 0; k < this.caveCells.length; k++) {
      const c = this.caveCells[k];
      this.warmDist[c] = 0;
      queue.push(c);
    }
    // S1: huts and nests lead cold people to them too.
    if (config.shelterSeekEnabled !== false) {
      const nests = config.nestsEnabled !== false;
      for (let i = 0; i < TOTAL_CELLS; i++) {
        if (this.warmDist[i] !== 0 && (this.structure[i] === 1 || (nests && this.form[i] === FORM_NEST))) {
          this.warmDist[i] = 0;
          queue.push(i);
        }
      }
    }
    for (let head = 0; head < queue.length; head++) {
      const c = queue[head];
      const d = this.warmDist[c] + 1;
      if (d > seek) continue;
      const x = c & COORD_MASK, y = c >> 8;
      const ns = [(y << 8) | ((x + 1) & COORD_MASK), (y << 8) | ((x - 1) & COORD_MASK), (((y + 1) & COORD_MASK) << 8) | x, (((y - 1) & COORD_MASK) << 8) | x];
      for (let k = 0; k < 4; k++) {
        const n = ns[k];
        if (this.warmDist[n] !== 255 || this.isWater[n] === 1) continue;
        this.warmDist[n] = d;
        queue.push(n);
      }
    }
  }

  /** Caves and burning fires for the viewer: x, y, kind per entry (16 + facing for a cave, 2 + level for a fire, 8 + level for a hut, 5 for a grave mark). */
  public packFeatures(config: Readonly<SimulationConfig>): Uint8Array {
    const out = new Uint8Array((this.caveCells.length + this.fireCount + this.hutCount + 64) * 3);
    let o = 0;
    for (let k = 0; k < this.caveCells.length; k++) {
      const c = this.caveCells[k];
      // Kind 16 + the way the cave faces: toward the lowest neighbour (0 east, 1 west, 2 south, 3 north).
      let face = 2;
      const elev = this.elevation;
      if (elev) {
        const x = c & COORD_MASK, y = c >> 8;
        const ns = [(y << 8) | ((x + 1) & COORD_MASK), (y << 8) | ((x - 1) & COORD_MASK), (((y + 1) & COORD_MASK) << 8) | x, (((y - 1) & COORD_MASK) << 8) | x];
        let low = Infinity;
        for (let d = 0; d < 4; d++) {
          const e = elev.elevation[ns[d]];
          if (e < low) { low = e; face = d; }
        }
      }
      out[o++] = c & COORD_MASK; out[o++] = c >> 8; out[o++] = 16 + face;
    }
    if (this.fireCount > 0) {
      const scale = Math.max(1e-6, config.fireIgniteBrush ?? 6);
      for (let i = 0; i < TOTAL_CELLS && o < out.length; i++) {
        if (this.fire[i] === 0) continue;
        const lvl = Math.min(2, Math.floor((this.brush[i] / scale) * 1.0));
        out[o++] = i & COORD_MASK; out[o++] = i >> 8; out[o++] = 2 + lvl;
      }
    }
    if (this.hutCount > 0) {
      const span = Math.max(1, (config.durabilityCap ?? 255) - (config.hutDurability ?? 60));
      for (let i = 0; i < TOTAL_CELLS && o < out.length; i++) {
        if (this.structure[i] === 0) continue;
        const lvl = Math.min(3, Math.floor((Math.max(0, this.durability[i] - (config.hutDurability ?? 60)) / span) * 4));
        out[o++] = i & COORD_MASK; out[o++] = i >> 8; out[o++] = 8 + lvl;
      }
    }
    for (let i = 0; i < 64; i++) {
      if (this.graveLeft[i] === 0) continue;
      out[o++] = this.graveX[i]; out[o++] = this.graveY[i]; out[o++] = 5;
    }
    return out.subarray(0, o);
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
  public tamp(x: number, y: number, config: Readonly<SimulationConfig>, workMultiplier = 1.0): void {
    const i = ((y & COORD_MASK) << 8) | (x & COORD_MASK);
    const cap = config.compactionCap ?? 2;
    this.compaction[i] = Math.min(cap, this.compaction[i] + (config.workGain ?? 0.03) * workMultiplier);
    if (config.fertilityChangeEnabled !== false && this.isWater[i] === 0) {
      if ((config.stoneBarrenEnabled !== false) && this.stone[i] > 0) return;
      const fMax = config.fertilityMax ?? 1.5;
      const curF = this.fertility[i];
      if (curF < fMax) {
        const gain = config.fertilityTampGain ?? 0.0008;
        const nextF = Math.min(fMax, curF + gain * (1 - curF / fMax));
        this.fertility[i] = nextF;
        this.maxFood[i] = this.baseFoodCap * this.fertility[i];
        if (this.berryMax[i] > 0) this.berryMax[i] = this.berryCapSaved * this.fertility[i];
      }
    }
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
      if (this.isWater[i] === 1) {
        // Water: how many fish there are (0 none ... 7 full) where they can be fished, i.e. beside land.
        const fm = this.fishMax[i];
        let lvl = 0;
        if (fm > 0 && this.fish[i] > 0.05) {
          const x = i & COORD_MASK, y = i >> 8;
          const shore = this.isWater[(y << 8) | ((x + 1) & COORD_MASK)] === 0 || this.isWater[(y << 8) | ((x - 1) & COORD_MASK)] === 0 ||
            this.isWater[(((y + 1) & COORD_MASK) << 8) | x] === 0 || this.isWater[(((y - 1) & COORD_MASK) << 8) | x] === 0;
          if (shore) lvl = Math.max(1, Math.min(7, Math.ceil((this.fish[i] / fm) * 7)));
        }
        out[i] = lvl;
        continue;
      }
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
    if (this.isWater[i] === 1 || ((config.stoneBarrenEnabled !== false) && this.stone[i] > 0)) return;
    this.seeds[i] = Math.min(config.seedCap ?? 10, this.seeds[i] + amount);
    if (config.fertilityChangeEnabled !== false) {
      const fMax = config.fertilityMax ?? 1.5;
      const curF = this.fertility[i];
      if (curF < fMax) {
        const gain = (config.fertilityActionGain ?? 0.002) * Math.min(1, amount / (config.seedCarryMax ?? 3));
        const nextF = Math.min(fMax, curF + gain * (1 - curF / fMax));
        this.fertility[i] = nextF;
        this.maxFood[i] = this.baseFoodCap * this.fertility[i];
        if (this.berryMax[i] > 0) this.berryMax[i] = this.berryCapSaved * this.fertility[i];
      }
    }
  }

  /** One byte per cell for the viewer: desert 3 bits, farmland 3 bits, seeds 2 bits. */
  public packOverlay(out: Uint8Array, config: Readonly<SimulationConfig>): void {
    const soilMin = config.soilMin ?? 0.2;
    const seedCap = config.seedCap ?? 10;
    const span = Math.max(1e-6, 1 - soilMin);
    const goldenOn = config.goldenCropsEnabled !== false;
    const ripenThreshold = config.cropRipenThreshold ?? 0.70;
    const minFarm = config.cropRipenMinFarmLevel ?? 2;
    for (let i = 0; i < TOTAL_CELLS; i++) {
      if (this.isWater[i] === 1) { out[i] = 0; continue; }
      const dmg = Math.min(7, Math.round(((1 - this.soilHealth[i]) / span) * 7));
      // Square-root scale so lightly worked soil still shows.
      const farmLevel = Math.min(7, Math.round(Math.sqrt(Math.min(1, this.tilled[i])) * 7));
      let seedLevel = Math.min(3, Math.round((this.seeds[i] / seedCap) * 3));
      if (goldenOn && farmLevel >= minFarm && seedLevel === 0) {
        const cap = this.capacityAt(i, config);
        if (cap > 0 && this.food[i] >= cap * ripenThreshold) {
          seedLevel = 3; // Ripe golden crop!
        } else if (cap > 0 && this.food[i] >= cap * (ripenThreshold * 0.75)) {
          seedLevel = 1; // Growing amber shoots
        }
      }
      out[i] = dmg | (farmLevel << 3) | (seedLevel << 6);
    }
  }

  /**
   * Forages plant food from cell (x, y).
   * Returns actual energy harvested (leaves floor intact).
   */
  public graze(x: number, y: number, want: number, config: Readonly<SimulationConfig>, till = true): number {
    const index = (y & COORD_MASK) * GRID_SIZE + (x & COORD_MASK);
    if (this.isWater[index] === 1 || ((config.stoneBarrenEnabled !== false) && this.stone[index] > 0)) return 0;

    const floor = config.landGrazingFloor ?? 1.0;
    const available = this.food[index] - floor;
    if (available <= 0) return 0;

    const take = Math.min(want, available);
    this.food[index] -= take;
    if (config.farmingPhysicsEnabled !== false) {
      // Working a cell tills it; stripping it down wears the soil out.
      if (till) this.tilled[index] += (config.tillGain ?? 0.02) * (1 - this.tilled[index]);
      const stripped = this.food[index] < 0.25 * this.capacityAt(index, config) || this.food[index] <= floor + 0.01;
      if (stripped) {
        const wear = config.soilWearRate ?? 0.004;
        this.soilHealth[index] = Math.max(config.soilMin ?? 0.2, this.soilHealth[index] - wear);
        if (config.fertilityChangeEnabled !== false) {
          const fLoss = config.fertilityDegradeRate ?? 0.0005;
          const fMin = config.fertilityMin ?? 0.05;
          const curF = this.fertility[index];
          if (curF > fMin) {
            const nextF = Math.max(fMin, curF - fLoss);
            this.fertility[index] = nextF;
            this.maxFood[index] = this.baseFoodCap * this.fertility[index];
            if (this.berryMax[index] > 0) this.berryMax[index] = this.berryCapSaved * this.fertility[index];
          }
        }
      } else if (config.tendingEnabled !== false && take > 0) {
        // Primitive 5: Tending - gentle harvesting without stripping raises cultivation and regrowth
        const tendingGain = config.tendingGain ?? 0.03;
        this.tilled[index] = Math.min(1.0, this.tilled[index] + tendingGain * (1 - this.tilled[index]));
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
      fertility: Array.from(this.fertility),
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
      fire: Array.from(this.fire),
      stone: Array.from(this.stone),
      durability: Array.from(this.durability),
      wear: Array.from(this.wear),
      material: Array.from(this.material),
      waterStore: Array.from(this.waterStore),
      waterFindable: Array.from(this.waterFindable),
      blockFood: Array.from(this.blockFood),
      exposure: Array.from(this.exposure),
      structure: Array.from(this.structure),
    };
  }

  public importState(state: LandState): void {
    const len = Math.min(TOTAL_CELLS, state.food.length);
    for (let i = 0; i < len; i++) {
      this.food[i] = state.food[i];
    }
    if (state.fertility) {
      for (let i = 0; i < len; i++) {
        const f = state.fertility[i] ?? this.fertility[i];
        this.fertility[i] = f;
        if (this.isWater[i] === 0) {
          this.maxFood[i] = this.baseFoodCap * this.fertility[i];
          if (this.berryMax[i] > 0) {
            this.berryMax[i] = this.berryCapSaved * this.fertility[i];
          }
        }
      }
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
    this.fireCount = 0;
    if (state.fire) for (let i = 0; i < len; i++) { this.fire[i] = state.fire[i] ?? 0; this.fireCount += this.fire[i]; }
    this.warmDirty = true;
    if (state.stone) for (let i = 0; i < len; i++) this.stone[i] = state.stone[i] ?? 0;
    this.hutCount = 0;
    if (state.durability) for (let i = 0; i < len; i++) this.durability[i] = state.durability[i] ?? 0;
    this.wear.fill(0);
    if (state.wear) for (let i = 0; i < len; i++) this.wear[i] = state.wear[i] ?? 0;
    this.waterStore.fill(0);
    if (state.waterStore) for (let i = 0; i < len; i++) this.waterStore[i] = state.waterStore[i] ?? 0;
    this.waterFindable.fill(0);
    if (state.waterFindable) for (let i = 0; i < len; i++) this.waterFindable[i] = state.waterFindable[i] ?? 0;
    this.drinkDirty = true;
    this.blockFood.fill(0);
    if (state.blockFood) for (let i = 0; i < 256; i++) this.blockFood[i] = state.blockFood[i] ?? 0;
    this.material.fill(0);
    if (state.material) for (let i = 0; i < len; i++) this.material[i] = state.material[i] ?? 0;
    this.exposure.fill(255);
    if (state.exposure) for (let i = 0; i < len; i++) this.exposure[i] = state.exposure[i] ?? 255;
    if (state.structure) for (let i = 0; i < len; i++) { this.structure[i] = state.structure[i] ?? 0; this.hutCount += this.structure[i]; }
  }
}
