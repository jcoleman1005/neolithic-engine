import { normalizeConfig } from './config';
import { type ElevationField, type ElevationState } from './elevation';
import { type TerrainField, type TerrainState } from './terrain';
import { HistoryTracker } from './history';
import { PRNG } from './prng';
import { hashString } from './state-hash';
import { Land, type LandState } from './land';
import {
  People,
  type PeopleState,
  makePersonId,
  slotFromId,
  genFromId,
} from './people';
import { SpatialIndex } from './spatial';
import { LifeSystem } from './life';
import { EnergyLedger } from './ledger';
import {
  PERSON_FRAME_BYTES,
  LOOK_STAGE_CHILD,
  LOOK_STAGE_ADULT,
  LOOK_STAGE_ELDER,
  encodeLookByte,
  type PersonDetail,
} from './protocol';
import { fastBase64Encode } from './base64';
import type { FoodPatch, FoodRegion, SimulationConfig, WorldMetrics } from './types';

export interface WorldState {
  readonly formatVersion: 1;
  readonly tick: number;
  readonly seed: number;
  readonly prngState?: number;
  readonly config: SimulationConfig;
  readonly land?: LandState;
  readonly people?: PeopleState;
  readonly terrain?: TerrainState | null;
  readonly elevation?: ElevationState | null;
}

export class World {
  public config: SimulationConfig;
  public tick = 0;
  public population = 0;
  public seed: number;
  public prng: PRNG;
  public history: HistoryTracker;

  public land: Land;
  public people: People;
  public spatial: SpatialIndex;
  public ledger: EnergyLedger;

  // Stubs for protocol compatibility
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
    this.land = new Land(this.config);
    this.people = new People();
    this.spatial = new SpatialIndex();
    this.ledger = new EnergyLedger();

    this.init();
  }

  private init(): void {
    LifeSystem.seedFounders(this.people, this.land, this.ledger, this.config, this.prng);
    this.population = this.people.count;
    this.ledger.begin(this.people.totalEnergy(), this.tick);
  }

  public step(): void {
    LifeSystem.step(this.people, this.land, this.spatial, this.ledger, this.config, this.prng);
    this.population = this.people.count;
    this.tick++;

    if (this.tick % 10 === 0) {
      this.history.record(this.getMetrics());
      this.ledger.check(this.people.totalEnergy(), this.tick);
    }
  }

  public reset(seed?: number | string): void {
    if (seed !== undefined) {
      this.seed = typeof seed === 'number' ? seed : PRNG.hashString(seed);
      this.config.seed = this.seed;
    }
    this.tick = 0;
    this.prng = new PRNG(this.seed);
    this.history.clear();
    this.land = new Land(this.config);
    this.people = new People();
    this.spatial = new SpatialIndex();
    this.ledger.reset();

    this.init();
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
    return this.land.terrain;
  }

  public getElevation(): ElevationField | null {
    return this.land.elevation;
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

  private frameBuffer: Uint8Array = new Uint8Array(2048 * PERSON_FRAME_BYTES);

  public packPeopleFrame(): { base64: string; count: number } {
    const people = this.people;
    const count = people.count;
    const requiredSize = count * PERSON_FRAME_BYTES;
    if (this.frameBuffer.length < requiredSize) {
      this.frameBuffer = new Uint8Array(Math.max(requiredSize, this.frameBuffer.length * 2));
    }

    const buf = this.frameBuffer;
    const alive = people.alive;
    const px = people.x;
    const py = people.y;
    const psex = people.sex;
    const page = people.age;
    const ppreg = people.pregnant;
    const pener = people.energy;
    const cap = people.capacity;

    const adultAge = this.config.adultAge ?? 5760;
    const elderAge = Math.floor((this.config.maxAge ?? 21600) * 0.75);
    const maxEnergy = this.config.maxEnergy ?? 100;

    let offset = 0;
    for (let slot = 0; slot < cap; slot++) {
      if (alive[slot] === 1) {
        buf[offset++] = slot & 0xff;
        buf[offset++] = (slot >> 8) & 0xff;
        buf[offset++] = px[slot];
        buf[offset++] = py[slot];

        const age = page[slot];
        const stage = age < adultAge ? LOOK_STAGE_CHILD : age >= elderAge ? LOOK_STAGE_ELDER : LOOK_STAGE_ADULT;
        const pregnant = ppreg[slot] >= 0;
        buf[offset++] = encodeLookByte(psex[slot], pregnant, stage, pener[slot], maxEnergy);
      }
    }

    const base64 = fastBase64Encode(buf.subarray(0, offset));
    return { base64, count };
  }

  public getPersonRecord(idOrSlot: number | string): PersonDetail | null {
    const num = typeof idOrSlot === 'string' ? parseInt(idOrSlot, 10) : idOrSlot;
    if (isNaN(num)) return null;

    const people = this.people;
    let slot: number;
    let expectedGen: number | null = null;

    if (num >= people.capacity) {
      slot = slotFromId(num);
      expectedGen = genFromId(num);
    } else {
      slot = num;
    }

    if (slot < 0 || slot >= people.capacity || people.alive[slot] !== 1) {
      return null;
    }

    const currentGen = people.slotGenerations[slot];
    if (expectedGen !== null && currentGen !== expectedGen) {
      return null;
    }

    const ticksPerYear = this.config.ticksPerYear || 360;
    return {
      id: makePersonId(slot, currentGen),
      slot,
      generation: people.generation[slot],
      x: people.x[slot],
      y: people.y[slot],
      energy: Math.round(people.energy[slot] * 10) / 10,
      sex: people.sex[slot] === 1 ? 'male' : 'female',
      ageTicks: people.age[slot],
      ageYears: Math.floor(people.age[slot] / ticksPerYear),
      pregnant: people.pregnant[slot] >= 0,
      pregnancyTicks: Math.max(0, people.pregnant[slot]),
      mateSlot: people.mateSlot[slot],
      motherId: people.motherId[slot],
      fatherId: people.fatherId[slot],
    };
  }

  public stateHash(): string {
    let personSample = 0;
    const alive = this.people.alive;
    const px = this.people.x;
    const py = this.people.y;
    const cap = this.people.capacity;

    for (let slot = 0; slot < cap; slot++) {
      if (alive[slot] === 1) {
        personSample = (personSample * 31 + ((py[slot] << 8) | px[slot])) | 0;
      }
    }

    const raw = `${this.tick}:${this.seed}:${this.population}:${personSample}:${this.people.totalEnergy().toFixed(1)}:${this.land.totalPlantFood().toFixed(1)}`;
    return hashString(raw);
  }

  public exportState(): WorldState {
    return {
      formatVersion: 1,
      tick: this.tick,
      seed: this.seed,
      prngState: this.prng.getState(),
      config: { ...this.config },
      land: this.land.exportState(),
      people: this.people.exportState(),
      terrain: this.land.terrain ? this.land.terrain.exportState(true) : null,
      elevation: this.land.elevation ? this.land.elevation.exportView() : null,
    };
  }

  public static fromState(state: WorldState): World {
    if (state.formatVersion !== 1) {
      throw new Error(`Unknown format version: ${(state as any).formatVersion ?? (state as any).version}`);
    }
    const world = new World(state.config, state.seed);
    world.tick = state.tick;
    if (state.prngState !== undefined) {
      world.prng.setState(state.prngState);
    }
    if (state.land) {
      world.land.importState(state.land);
    }
    if (state.people) {
      world.people.importState(state.people);
      world.population = world.people.count;
    }
    world.ledger.reset();
    world.ledger.begin(world.people.totalEnergy(), world.tick);
    return world;
  }
}
