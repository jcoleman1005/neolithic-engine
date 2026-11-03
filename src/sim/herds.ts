import { PRNG } from './prng';
import { COORD_MASK, GRID_SIZE, type Land } from './land';
import type { People } from './people';
import type { SimulationConfig } from './types';

const CELLS = GRID_SIZE * GRID_SIZE;

export interface HerdsState {
  readonly prngState: number;
  readonly animals: ReadonlyArray<{ slot: number; x: number; y: number; energy: number; age: number }>;
}

/**
 * Phase 6a: dumb herbivores. Each animal lives in a typed-array slot, takes one tile, grazes the
 * land food, wanders toward richer ground, flees people who come close, breeds when well fed and
 * dies of hunger or age. Their body energy is plant-side (outside the energy ledger), like food
 * heaps. They draw from their own PRNG so people's random stream is the same with herds on or off.
 */
export class Herds {
  public readonly capacity: number;
  public readonly x: Uint8Array;
  public readonly y: Uint8Array;
  public readonly energy: Float32Array;
  public readonly age: Int32Array;
  public readonly alive: Uint8Array;
  /** Slot of the animal on each tile, or -1. At most one animal per tile. */
  public readonly cellSlot: Int16Array;
  public count = 0;
  /** Animals killed by hunters so far (a running tally, not saved). */
  public killed = 0;
  /** Scratch: 1 on tiles with a person this tick. */
  private readonly humanNear = new Uint8Array(CELLS);
  private prng: PRNG;

  constructor(config: Readonly<SimulationConfig>, seed: number) {
    this.capacity = Math.min(32767, config.herdCapacity ?? 1024);
    this.x = new Uint8Array(this.capacity);
    this.y = new Uint8Array(this.capacity);
    this.energy = new Float32Array(this.capacity);
    this.age = new Int32Array(this.capacity);
    this.alive = new Uint8Array(this.capacity);
    this.cellSlot = new Int16Array(CELLS).fill(-1);
    this.prng = new PRNG((seed ^ 0x48455244) >>> 0);
  }

  /** Scatters the founder herds over grassland. */
  public seed(land: Land, config: Readonly<SimulationConfig>): void {
    if (config.herdsEnabled === false) return;
    const want = Math.min(this.capacity, config.herdInitialCount ?? 150);
    const e0 = (config.herdMaxEnergy ?? 50) * 0.6;
    let attempts = 0;
    while (this.count < want && attempts++ < want * 100) {
      const x = this.prng.nextInt(0, GRID_SIZE);
      const y = this.prng.nextInt(0, GRID_SIZE);
      const c = (y << 8) | x;
      if (land.isWater[c] === 1 || land.fertility[c] < 0.3 || this.cellSlot[c] !== -1) continue;
      this.spawn(x, y, e0, this.prng.nextInt(0, 600));
    }
  }

  /** A newborn or founder takes the lowest free slot, so slot order never depends on history. */
  private spawn(x: number, y: number, energy: number, age: number, into = -1): number {
    let slot = into;
    if (slot < 0) {
      slot = 0;
      while (slot < this.capacity && this.alive[slot] === 1) slot++;
      if (slot >= this.capacity) return -1;
    }
    this.x[slot] = x;
    this.y[slot] = y;
    this.energy[slot] = energy;
    this.age[slot] = age;
    this.alive[slot] = 1;
    this.cellSlot[(y << 8) | x] = slot;
    this.count++;
    return slot;
  }

  /** Removes an animal (a death or a kill). */
  public kill(slot: number): void {
    if (this.alive[slot] === 0) return;
    this.alive[slot] = 0;
    this.cellSlot[(this.y[slot] << 8) | this.x[slot]] = -1;
    this.count--;
  }

  /** A random draw from the herds' own stream (hunting uses it so people's stream is untouched). */
  public roll(): number {
    return this.prng.next();
  }

  private canEnter(land: Land, c: number): boolean {
    return land.isWater[c] === 0 && this.cellSlot[c] === -1;
  }

  private move(slot: number, nx: number, ny: number): void {
    this.cellSlot[(this.y[slot] << 8) | this.x[slot]] = -1;
    this.x[slot] = nx;
    this.y[slot] = ny;
    this.cellSlot[(ny << 8) | nx] = slot;
  }

  public step(land: Land, people: People, config: Readonly<SimulationConfig>): void {
    if (config.herdsEnabled === false || this.count === 0) return;
    const maxE = config.herdMaxEnergy ?? 50;
    const upkeep = config.herdUpkeep ?? 0.1;
    const moveCost = config.herdMoveCost ?? 0.02;
    const bite = config.herdGrazeBite ?? 1.0;
    const maxAge = config.herdMaxAge ?? 3600;
    const adultAge = config.herdAdultAge ?? 180;
    const breedE = config.herdBreedEnergy ?? 35;
    const birthE = config.herdBirthEnergy ?? 12;
    // Crowding slows breeding: the herd's own carrying capacity (herds also compete for grass).
    const breedChance = (config.herdBreedChance ?? 0.03) * Math.max(0, 1 - this.count / (config.herdSoftCap ?? 300));
    const fleeR = config.herdFleeRadius ?? 2;
    const fleeChance = config.herdFleeChance ?? 0.6;
    const stayFrac = config.herdStayFraction ?? 0.5;
    const wander = config.herdWander ?? 0.1;
    const prng = this.prng;

    // Where people stand this tick (an index of its own, so a loaded save steps identically).
    const near = this.humanNear;
    near.fill(0);
    const px = people.x, py = people.y, palive = people.alive;
    for (let s = 0; s < people.capacity; s++) if (palive[s] === 1) near[(py[s] << 8) | px[s]] = 1;

    const cap = this.capacity;
    for (let slot = 0; slot < cap; slot++) {
      if (this.alive[slot] === 0) continue;
      this.age[slot]++;
      let e = this.energy[slot] - upkeep;
      if (e <= 0 || this.age[slot] >= maxAge) { this.kill(slot); continue; }

      const x = this.x[slot], y = this.y[slot];
      let c = (y << 8) | x;

      // Graze where it stands.
      if (e < maxE) {
        const got = land.graze(x, y, Math.min(bite, maxE - e), config, false);
        e += got;
      }

      // Flee the nearest person within reach, otherwise settle or drift toward richer ground.
      let nx = x, ny = y;
      let hx = 0, hy = 0, best = 1e9;
      for (let dy = -fleeR; dy <= fleeR; dy++) {
        for (let dx = -fleeR; dx <= fleeR; dx++) {
          if (near[(((y + dy) & COORD_MASK) << 8) | ((x + dx) & COORD_MASK)] === 1) {
            const d = Math.abs(dx) + Math.abs(dy);
            if (d < best) { best = d; hx = dx; hy = dy; }
          }
        }
      }
      let moved = false;
      if (best < 1e9 && prng.next() < fleeChance) {
        // The step that ends farthest from the person.
        let bestD = -1, bdx = 0, bdy = 0;
        for (let d = 0; d < 4; d++) {
          const sx = d === 0 ? 1 : d === 1 ? -1 : 0;
          const sy = d === 2 ? 1 : d === 3 ? -1 : 0;
          const tc = (((y + sy) & COORD_MASK) << 8) | ((x + sx) & COORD_MASK);
          if (!this.canEnter(land, tc)) continue;
          const dist = Math.abs(sx - hx) + Math.abs(sy - hy);
          if (dist > bestD) { bestD = dist; bdx = sx; bdy = sy; }
        }
        if (bestD > best) { nx = (x + bdx) & COORD_MASK; ny = (y + bdy) & COORD_MASK; moved = true; }
      } else if (best >= 1e9) {
        const max = land.capacityAt(c, config);
        const settled = max > 0 && land.food[c] >= stayFrac * max;
        if (!settled || prng.next() < wander) {
          let bestFood = settled ? -1 : land.food[c] * 1.1;
          const start = prng.nextInt(0, 4);
          for (let k = 0; k < 4; k++) {
            const d = (start + k) & 3;
            const sx = d === 0 ? 1 : d === 1 ? -1 : 0;
            const sy = d === 2 ? 1 : d === 3 ? -1 : 0;
            const tx = (x + sx) & COORD_MASK, ty = (y + sy) & COORD_MASK;
            const tc = (ty << 8) | tx;
            if (!this.canEnter(land, tc)) continue;
            if (land.food[tc] > bestFood) { bestFood = land.food[tc]; nx = tx; ny = ty; moved = true; }
          }
        }
      }
      if (moved) {
        this.move(slot, nx, ny);
        e -= moveCost;
        c = (ny << 8) | nx;
      }

      // Breed into a free neighbouring tile; the newborn's energy comes out of the parent's.
      if (e >= breedE && this.age[slot] >= adultAge && this.count < this.capacity && prng.next() < breedChance) {
        const start = prng.nextInt(0, 4);
        for (let k = 0; k < 4; k++) {
          const d = (start + k) & 3;
          const bx = (this.x[slot] + (d === 0 ? 1 : d === 1 ? -1 : 0)) & COORD_MASK;
          const by = (this.y[slot] + (d === 2 ? 1 : d === 3 ? -1 : 0)) & COORD_MASK;
          if (this.canEnter(land, (by << 8) | bx)) {
            this.spawn(bx, by, birthE, 0);
            e -= birthE;
            break;
          }
        }
      }
      this.energy[slot] = e;
    }
  }

  public exportState(): HerdsState {
    const animals: Array<{ slot: number; x: number; y: number; energy: number; age: number }> = [];
    for (let s = 0; s < this.capacity; s++) {
      if (this.alive[s] === 1) animals.push({ slot: s, x: this.x[s], y: this.y[s], energy: this.energy[s], age: this.age[s] });
    }
    return { prngState: this.prng.getState(), animals };
  }

  public importState(state: HerdsState): void {
    for (let s = 0; s < this.capacity; s++) if (this.alive[s] === 1) this.kill(s);
    this.prng.setState(state.prngState);
    for (const a of state.animals) this.spawn(a.x, a.y, a.energy, a.age, a.slot);
  }
}
