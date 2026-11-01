import { normalizeConfig } from './config';
import { generateElevation, ElevationField, type ElevationState } from './elevation';
import { generateTerrain, TerrainField, type TerrainState } from './terrain';
import { HistoryTracker } from './history';
import { PRNG } from './prng';
import { hashString } from './state-hash';
import type { FoodPatch, FoodRegion, SimulationConfig, WorldMetrics } from './types';

export interface WorldState {
  readonly formatVersion: 1;
  readonly tick: number;
  readonly seed: number;
  readonly config: SimulationConfig;
  readonly terrain?: TerrainState | null;
  readonly elevation?: ElevationState | null;
}

/**
 * World stub for Phase 0: 256x256 land grid with no people.
 */
export class World {
  public config: SimulationConfig;
  public tick = 0;
  public population = 0;
  public seed: number;
  public prng: PRNG;
  public history: HistoryTracker;

  public terrain: TerrainField | null = null;
  public elevation: ElevationField | null = null;

  // Stubs for protocol/viewer compatibility
  public readonly obstacles = new Set<string>();
  public readonly foodRegions: readonly FoodRegion[] = [];
  public readonly organisms = new Map<string, never>();
  public readonly foodPatches = new Map<string, FoodPatch>();
  public readonly carrion = new Map<string, never>();
  public readonly eggs = new Map<string, never>();
  public readonly deathPulses: readonly never[] = [];

  constructor(config: Partial<SimulationConfig> = {}, seed?: number) {
    this.config = normalizeConfig(config);
    if (seed !== undefined) {
      this.seed = seed;
      this.config.seed = seed;
    } else {
      this.seed = this.config.seed;
    }
    this.prng = new PRNG(this.seed);
    this.history = new HistoryTracker();
    this.initLand();
  }

  private initLand(): void {
    if (this.config.terrainEnabled) {
      this.terrain = generateTerrain(this.config);
    }
    if (this.config.elevationEnabled) {
      this.elevation = generateElevation(this.config);
    }
  }

  public step(): void {
    this.tick++;
    if (this.tick % 10 === 0) {
      this.history.record(this.getMetrics());
    }
  }

  public reset(seed?: number | string): void {
    if (seed !== undefined) {
      this.seed = typeof seed === 'number' ? seed : PRNG.hashString(seed);
      this.config.seed = this.seed;
    }
    this.tick = 0;
    this.population = 0;
    this.prng = new PRNG(this.seed);
    this.history.clear();
    this.initLand();
  }

  public getMetrics(): WorldMetrics {
    const ticksPerYear = this.config.ticksPerYear || 360;
    return {
      tick: this.tick,
      year: Math.floor(this.tick / ticksPerYear),
      population: this.population,
    };
  }

  public getTerrain(): TerrainField | null {
    return this.terrain;
  }

  public getElevation(): ElevationField | null {
    return this.elevation;
  }

  public getOrganism(_id: string): undefined {
    return undefined;
  }

  public getEgg(_id: string): undefined {
    return undefined;
  }

  public getAncestry(_id: string): readonly never[] {
    return [];
  }

  public rocks(): string[] {
    return [];
  }

  public stateHash(): string {
    const raw = `${this.tick}:${this.seed}:${this.population}:${this.config.worldWidth}x${this.config.worldHeight}`;
    return hashString(raw);
  }

  public exportState(): WorldState {
    return {
      formatVersion: 1,
      tick: this.tick,
      seed: this.seed,
      config: { ...this.config },
      terrain: this.terrain ? this.terrain.exportState(true) : null,
      elevation: this.elevation ? this.elevation.exportView() : null,
    };
  }

  public static fromState(state: WorldState): World {
    if (state.formatVersion !== 1) {
      throw new Error(`Unknown format version: ${(state as any).formatVersion ?? (state as any).version}`);
    }
    const world = new World(state.config, state.seed);
    world.tick = state.tick;
    if (state.terrain) {
      world.terrain = TerrainField.fromState(state.terrain, world.config);
    }
    if (state.elevation) {
      world.elevation = ElevationField.forView(state.elevation);
    }
    return world;
  }
}
