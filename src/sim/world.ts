import { normalizeConfig } from './config';
import { type ElevationField, type ElevationState } from './elevation';
import { type TerrainField, type TerrainState } from './terrain';
import { HistoryTracker } from './history';
import { PRNG } from './prng';
import { StateHasher } from './state-hash';
import { Land, type LandState } from './land';
import { ScentFields, type FieldsState } from './fields';
import {
  People,
  type PeopleState,
  makePersonId,
  slotFromId,
  genFromId,
  GENE_STRENGTH,
  GENE_BRAVERY,
  GENE_GREED,
  GENE_PIETY,
  GENE_CHARISMA,
  GENE_CURIOSITY,
  GENE_WISDOM,
  GENE_CRUELTY,
  GENE_COUNT,
  HABIT_FORAGE,
  HABIT_CAUTION,
  HABIT_GENEROSITY,
  HABIT_BELLIGERENCE,
  HABIT_DEVOTION,
  HABIT_ROAMING,
  HABIT_LOYALTY,
  HABIT_INDUSTRY,
  HABIT_COUNT,
} from './people';
import { SpatialIndex } from './spatial';
import { Herds, type HerdsState } from './herds';
import { Wolves, type WolvesState } from './wolves';
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
  readonly fields?: FieldsState;
  readonly people?: PeopleState;
  readonly herds?: HerdsState;
  readonly wolves?: WolvesState;
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
  public fields: ScentFields;
  public people: People;
  public spatial: SpatialIndex;
  public herds: Herds;
  public wolves: Wolves;
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
    this.fields = new ScentFields();
    this.people = new People();
    this.spatial = new SpatialIndex();
    this.herds = new Herds(this.config, this.seed);
    this.wolves = new Wolves(this.config, this.seed);
    this.ledger = new EnergyLedger();

    this.init();
  }

  private init(): void {
    LifeSystem.seedFounders(this.people, this.land, this.ledger, this.config, this.prng);
    this.herds.seed(this.land, this.config);
    this.wolves.seed(this.land, this.config, this.herds);
    this.population = this.people.count;
    this.ledger.begin(this.people.totalEnergy(), this.tick);
  }

  public step(): void {
    LifeSystem.step(
      this.people,
      this.land,
      this.fields,
      this.spatial,
      this.ledger,
      this.config,
      this.prng,
      this.tick,
      this.herds
    );
    this.herds.ageCarcasses(this.land);
    this.herds.step(this.land, this.people, this.config, this.wolves);
    this.wolves.step(this.land, this.people, this.herds, this.fields, this.ledger, this.config);
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
    this.fields.reset();
    this.people = new People();
    this.spatial = new SpatialIndex();
    this.herds = new Herds(this.config, this.seed);
    this.wolves = new Wolves(this.config, this.seed);
    this.ledger.reset();

    this.init();
  }

  public getMetrics(): WorldMetrics {
    const ticksPerYear = this.config.ticksPerYear || 360;
    const people = this.people;
    const cap = people.capacity;
    const alive = people.alive;
    const rootLeaderId = people.rootLeaderId;

    const bandSizes = new Map<number, number>();
    for (let slot = 0; slot < cap; slot++) {
      if (alive[slot] === 1) {
        let rId = rootLeaderId[slot];
        if (rId === 0) rId = people.idOf(slot);
        bandSizes.set(rId, (bandSizes.get(rId) ?? 0) + 1);
      }
    }

    let bandCount = 0;
    let largestBand = 0;
    for (const size of bandSizes.values()) {
      if (size >= 2) bandCount++;
      if (size > largestBand) largestBand = size;
    }

    return {
      tick: this.tick,
      year: Math.floor(this.tick / ticksPerYear),
      population: this.population,
      bandCount,
      largestBand,
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

  private overlayBuffer = new Uint8Array(256 * 256);

  /** Desert, farmland and seed levels for the viewer, base64 (see Land.packOverlay). */
  public packLandOverlay(): string {
    this.land.packOverlay(this.overlayBuffer, this.config);
    return fastBase64Encode(this.overlayBuffer);
  }

  private structuresBuffer = new Uint8Array(256 * 256);

  /** Heap sizes and forms (heap, granary floor) for the viewer, base64 (see Land.packStructures). */
  public packLandStructures(): string {
    this.land.packStructures(this.structuresBuffer, this.config);
    return fastBase64Encode(this.structuresBuffer);
  }

  private frameBuffer: Uint8Array = new Uint8Array(2048 * PERSON_FRAME_BYTES);

  /** Herd positions for the viewer: two bytes (x, y) per animal, base64. */
  public packHerdsFrame(): string {
    const h = this.herds;
    const buf = new Uint8Array(h.count * 2);
    let o = 0;
    for (let s = 0; s < h.capacity; s++) {
      if (h.alive[s] === 1) { buf[o++] = h.x[s]; buf[o++] = h.y[s]; }
    }
    return fastBase64Encode(buf);
  }

  /** Wolf positions for the viewer: two bytes (x, y) per wolf, base64. */
  public packWolvesFrame(): string {
    const w = this.wolves;
    const buf = new Uint8Array(w.count * 2);
    let o = 0;
    for (let s = 0; s < w.capacity; s++) {
      if (w.alive[s] === 1) { buf[o++] = w.x[s]; buf[o++] = w.y[s]; }
    }
    return fastBase64Encode(buf);
  }

  /** Caves and burning fires for the viewer: three bytes (x, y, kind) per entry, base64. */
  public packFeaturesFrame(): string {
    return fastBase64Encode(this.land.packFeatures(this.config));
  }

  /** Fresh kills for the viewer: two bytes (x, y) per carcass, base64. */
  public packCarcassFrame(): string {
    const h = this.herds;
    const buf = new Uint8Array(256);
    let o = 0;
    for (let i = 0; i < 128; i++) {
      if (h.carcassLeft[i] > 0) { buf[o++] = h.carcassX[i]; buf[o++] = h.carcassY[i]; }
    }
    return fastBase64Encode(buf.subarray(0, o));
  }

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
    const pslotgen = people.slotGenerations;
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
        buf[offset++] = pslotgen[slot] & 0xff;

        const rId = people.rootLeaderId[slot] || people.idOf(slot);
        buf[offset++] = rId & 0xff;
        buf[offset++] = (rId >> 8) & 0xff;
        buf[offset++] = (rId >> 16) & 0xff;
        buf[offset++] = (rId >>> 24) & 0xff;
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
    const gOff = slot * GENE_COUNT;
    const hOff = slot * HABIT_COUNT;
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
      mateId: people.mateId[slot],
      motherId: people.motherId[slot],
      fatherId: people.fatherId[slot],
      leaderId: people.leaderId[slot],
      rootLeaderId: people.rootLeaderId[slot],
      genes: {
        strength: people.genes[gOff + GENE_STRENGTH],
        bravery: people.genes[gOff + GENE_BRAVERY],
        greed: people.genes[gOff + GENE_GREED],
        piety: people.genes[gOff + GENE_PIETY],
        charisma: people.genes[gOff + GENE_CHARISMA],
        curiosity: people.genes[gOff + GENE_CURIOSITY],
        wisdom: people.genes[gOff + GENE_WISDOM],
        cruelty: people.genes[gOff + GENE_CRUELTY],
      },
      habits: {
        forage: people.habits[hOff + HABIT_FORAGE],
        caution: people.habits[hOff + HABIT_CAUTION],
        generosity: people.habits[hOff + HABIT_GENEROSITY],
        belligerence: people.habits[hOff + HABIT_BELLIGERENCE],
        devotion: people.habits[hOff + HABIT_DEVOTION],
        roaming: people.habits[hOff + HABIT_ROAMING],
        loyalty: people.habits[hOff + HABIT_LOYALTY],
        industry: people.habits[hOff + HABIT_INDUSTRY],
      },
    };
  }

  public stateHash(): string {
    const h = new StateHasher();

    // 1. Tick, seed, PRNG internal state, and alive count
    h.updateInt(this.tick);
    h.updateInt(this.seed);
    h.updateInt(this.prng.getState());
    h.updateInt(this.people.count);

    // 2. Every per-person array for living people
    const people = this.people;
    const cap = people.capacity;
    const alive = people.alive;
    const px = people.x;
    const py = people.y;
    const energy = people.energy;
    const sex = people.sex;
    const age = people.age;
    const gen = people.generation;
    const preg = people.pregnant;
    const mateId = people.mateId;
    const mom = people.motherId;
    const dad = people.fatherId;
    const slotGen = people.slotGenerations;
    const leaderId = people.leaderId;
    const genes = people.genes;
    const habits = people.habits;

    for (let slot = 0; slot < cap; slot++) {
      if (alive[slot] === 1) {
        h.updateInt(slot);
        h.updateInt(slotGen[slot]);
        h.updateInt(px[slot]);
        h.updateInt(py[slot]);
        h.updateFloat(energy[slot]);
        h.updateInt(sex[slot]);
        h.updateInt(age[slot]);
        h.updateInt(gen[slot]);
        h.updateInt(preg[slot]);
        h.updateInt(mateId[slot]);
        h.updateInt(mom[slot]);
        h.updateInt(dad[slot]);
        h.updateInt(leaderId[slot]);
        h.updateInt(people.rootLeaderId[slot]);
        h.updateInt(people.prevDir[slot]);
        h.updateFloat(people.carry[slot]);
        h.updateInt(people.carryKind[slot]);
        h.updateFloat(people.hydration[slot]);
        const gOff = slot * GENE_COUNT;
        for (let g = 0; g < GENE_COUNT; g++) h.updateInt(genes[gOff + g]);
        const hOff = slot * HABIT_COUNT;
        for (let hb = 0; hb < HABIT_COUNT; hb++) h.updateInt(habits[hOff + hb]);
      }
    }

    // Herds
    const herds = this.herds;
    for (let s = 0; s < herds.capacity; s++) {
      if (herds.alive[s] === 1) {
        h.updateInt(s);
        h.updateInt(herds.x[s]);
        h.updateInt(herds.y[s]);
        h.updateFloat(herds.energy[s]);
        h.updateInt(herds.age[s]);
      }
    }

    const wolves = this.wolves;
    for (let s = 0; s < wolves.capacity; s++) {
      if (wolves.alive[s] === 1) {
        h.updateInt(s);
        h.updateInt(wolves.x[s]);
        h.updateInt(wolves.y[s]);
        h.updateFloat(wolves.energy[s]);
        h.updateInt(wolves.age[s]);
        h.updateInt(wolves.dir[s]);
      }
    }

    // 3. Every land array
    const land = this.land;
    h.updateFloatArray(land.food);
    h.updateFloatArray(land.maxFood);
    h.updateFloatArray(land.fertility);
    h.updateFloatArray(land.tilled);
    h.updateFloatArray(land.seeds);
    h.updateFloatArray(land.soilHealth);
    h.updateFloatArray(land.pile);
    h.updateFloatArray(land.compaction);
    h.updateIntArray(land.form);
    h.updateFloatArray(land.brush);
    h.updateFloatArray(land.trees);
    h.updateFloatArray(land.fish);
    h.updateFloatArray(land.stumpAge);
    h.updateIntArray(land.cleared);
    h.updateIntArray(land.fire);
    h.updateFloatArray(land.stone);
    h.updateIntArray(land.durability);
    h.updateIntArray(land.structure);
    h.updateFloatArray(land.berries);
    h.updateIntArray(land.isWater);

    // 4. Scent fields
    h.updateFloatArray(this.fields.foodCurrent);
    h.updateFloatArray(this.fields.dangerCurrent);

    return h.digest();
  }

  public exportState(): WorldState {
    return {
      formatVersion: 1,
      tick: this.tick,
      seed: this.seed,
      prngState: this.prng.getState(),
      config: { ...this.config },
      land: this.land.exportState(),
      fields: this.fields.exportState(),
      people: this.people.exportState(),
      herds: this.herds.exportState(),
      wolves: this.wolves.exportState(),
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
    if (state.fields) {
      world.fields.importState(state.fields);
    }
    if (state.people) {
      world.people.importState(state.people);
      world.population = world.people.count;
    }
    if (state.herds) world.herds.importState(state.herds);
    if (state.wolves) world.wolves.importState(state.wolves);
    world.ledger.reset();
    world.ledger.begin(world.people.totalEnergy(), world.tick);
    return world;
  }
}
