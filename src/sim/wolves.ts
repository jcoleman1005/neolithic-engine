import { PRNG } from './prng';
import { COORD_MASK, GRID_SIZE, type Land } from './land';
import type { People } from './people';
import type { Herds } from './herds';
import type { ScentFields } from './fields';
import type { EnergyLedger } from './ledger';
import type { SimulationConfig } from './types';

const CELLS = GRID_SIZE * GRID_SIZE;

export interface WolvesState {
  readonly prngState: number;
  readonly animals: ReadonlyArray<{ slot: number; x: number; y: number; energy: number; age: number; dir: number }>;
}

/**
 * Phase 6a-4: simple wolves. They wander (keeping their heading), turn toward herd animals they
 * can sense, kill adjacent prey for its energy, breed when well fed and starve when prey runs out.
 * Each tick a wolf leaves danger scent, which people and herds avoid; a lone person beside a wolf
 * may be killed. No packs, no scripted hunts. Own PRNG, like the herds, so people's random stream
 * is the same with wolves on or off.
 */
export class Wolves {
  public readonly capacity: number;
  public readonly x: Uint8Array;
  public readonly y: Uint8Array;
  public readonly energy: Float32Array;
  public readonly age: Int32Array;
  public readonly dir: Uint8Array;
  public readonly alive: Uint8Array;
  /** Slot of the wolf on each tile, or -1. */
  public readonly cellSlot: Int16Array;
  public count = 0;
  /** Tallies since the world began (not saved). */
  public killedHerd = 0;
  public killedPeople = 0;
  private readonly peopleHere = new Uint8Array(CELLS);
  private prng: PRNG;

  constructor(config: Readonly<SimulationConfig>, seed: number) {
    this.capacity = Math.min(32767, config.wolfCapacity ?? 128);
    this.x = new Uint8Array(this.capacity);
    this.y = new Uint8Array(this.capacity);
    this.energy = new Float32Array(this.capacity);
    this.age = new Int32Array(this.capacity);
    this.dir = new Uint8Array(this.capacity);
    this.alive = new Uint8Array(this.capacity);
    this.cellSlot = new Int16Array(CELLS).fill(-1);
    this.prng = new PRNG((seed ^ 0x574f4c46) >>> 0);
  }

  /** Founders start a few tiles from herd animals (when there are any), so they find prey before they starve. */
  public seed(land: Land, config: Readonly<SimulationConfig>, herds?: Herds): void {
    if (config.wolvesEnabled === false) return;
    const want = Math.min(this.capacity, config.wolfInitialCount ?? 20);
    const e0 = (config.wolfMaxEnergy ?? 80) * 0.6;
    let attempts = 0;
    while (this.count < want && attempts++ < want * 100) {
      let x = this.prng.nextInt(0, GRID_SIZE - 1);
      let y = this.prng.nextInt(0, GRID_SIZE - 1);
      if (herds && herds.count > 0) {
        let s = this.prng.nextInt(0, herds.capacity);
        while (herds.alive[s] === 0) s = (s + 1) % herds.capacity;
        x = (herds.x[s] + this.prng.nextInt(-4, 5)) & COORD_MASK;
        y = (herds.y[s] + this.prng.nextInt(-4, 5)) & COORD_MASK;
      }
      const c = (y << 8) | x;
      if (land.isWater[c] === 1 || (land.elevation && land.elevation.water[c] > 0) || land.fertility[c] < 0.3 || this.cellSlot[c] !== -1) continue;
      this.spawn(x, y, e0, this.prng.nextInt(0, 800), this.prng.nextInt(0, 3));
    }
  }

  private spawn(x: number, y: number, energy: number, age: number, dir: number, into = -1): number {
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
    this.dir[slot] = dir;
    this.alive[slot] = 1;
    this.cellSlot[(y << 8) | x] = slot;
    this.count++;
    return slot;
  }

  public kill(slot: number): void {
    if (this.alive[slot] === 0) return;
    this.alive[slot] = 0;
    this.cellSlot[(this.y[slot] << 8) | this.x[slot]] = -1;
    this.count--;
  }

  /** True when the one person on this tile has no one else within `r` tiles (people in a group are safe). */
  private isAlone(x: number, y: number, r: number): boolean {
    let n = 0;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        n += this.peopleHere[(((y + dy) & COORD_MASK) << 8) | ((x + dx) & COORD_MASK)];
        if (n > 1) return false;
      }
    }
    return true;
  }

  private canEnter(land: Land, c: number): boolean {
    return land.isWater[c] === 0 && this.cellSlot[c] === -1;
  }

  public step(land: Land, people: People, herds: Herds, fields: ScentFields, ledger: EnergyLedger, config: Readonly<SimulationConfig>): void {
    if (config.wolvesEnabled === false || this.count === 0) return;
    const maxE = config.wolfMaxEnergy ?? 80;
    const upkeep = config.wolfUpkeep ?? 0.25;
    const moveCost = config.wolfMoveCost ?? 0.03;
    const maxAge = config.wolfMaxAge ?? 5400;
    const adultAge = config.wolfAdultAge ?? 360;
    const breedE = config.wolfBreedEnergy ?? 60;
    const birthE = config.wolfBirthEnergy ?? 25;
    const breedChance = (config.wolfBreedChance ?? 0.02) * Math.max(0, 1 - this.count / (config.wolfSoftCap ?? 40));
    const killChance = config.wolfKillChance ?? 0.35;
    const meatFactor = config.wolfMeatFactor ?? 1.2;
    const leftMeat = config.wolfLeaveMeat ?? 0.3;
    const attackChance = config.wolfAttackChance ?? 0.04;
    const danger = config.wolfDanger ?? 2;
    const sense = config.wolfSenseRadius ?? 6;
    const persist = config.wolfPersist ?? 0.75;
    const loneR = config.wolfLoneRadius ?? 2;
    const dangerDeath = config.scentDangerDeath ?? 10;
    const stock = config.stockpilesEnabled !== false;
    const prng = this.prng;

    // Where people stand this tick (an index of its own, so a loaded save steps identically).
    const here = this.peopleHere;
    here.fill(0);
    const px = people.x, py = people.y, palive = people.alive;
    for (let s = 0; s < people.capacity; s++) if (palive[s] === 1) { const c = (py[s] << 8) | px[s]; if (here[c] < 255) here[c]++; }

    for (let slot = 0; slot < this.capacity; slot++) {
      if (this.alive[slot] === 0) continue;
      this.age[slot]++;
      let e = this.energy[slot] - upkeep;
      if (e <= 0 || this.age[slot] >= maxAge) { this.kill(slot); continue; }
      const x = this.x[slot], y = this.y[slot];
      fields.depositDanger(x, y, danger);

      // Strike: prefer herd prey on or beside the tile, else a lone person beside it.
      let struck = false;
      const nbX = [x, (x + 1) & COORD_MASK, (x - 1) & COORD_MASK, x, x];
      const nbY = [y, y, y, (y + 1) & COORD_MASK, (y - 1) & COORD_MASK];
      for (let k = 0; k < 5 && !struck; k++) {
        const prey = herds.cellSlot[(nbY[k] << 8) | nbX[k]];
        if (prey >= 0 && prng.next() < killChance) {
          const meat = herds.energy[prey];
          e = Math.min(maxE, e + meat * meatFactor);
          if (stock && leftMeat > 0) {
            land.dropFood(nbX[k], nbY[k], meat * leftMeat, config);
            herds.addCarcass(nbX[k], nbY[k], config.carcassTicks ?? 120);
          }
          herds.kill(prey);
          this.killedHerd++;
          struck = true;
        }
      }
      for (let k = 1; k < 5 && !struck; k++) {
        const c = (nbY[k] << 8) | nbX[k];
        if (here[c] === 1 && prng.next() < attackChance && this.isAlone(nbX[k], nbY[k], loneR)) {
          // A lone person (nobody else on that tile or the wolf's): the wolf bites. The bite takes energy
          // and wounds; a person with nothing left falls, otherwise they get away hurt and may bleed out.
          for (let s = 0; s < people.capacity; s++) {
            if (palive[s] === 1 && px[s] === nbX[k] && py[s] === nbY[k]) {
              const bite = Math.min(people.energy[s], config.wolfBiteEnergy ?? 25);
              people.energy[s] -= bite;
              ledger.deathFat += bite;
              if (config.injuryEnabled !== false) people.injury[s] = Math.min(255, people.injury[s] + (config.wolfInjury ?? 150));
              e = Math.min(maxE, e + bite);
              fields.depositDanger(nbX[k], nbY[k], dangerDeath);
              if (people.energy[s] <= 0) {
                land.markDeath(nbX[k], nbY[k], config.graveTicks ?? 150);
                people.kill(s);
                here[c] = 0;
                e = Math.min(maxE, e + (config.wolfPersonMeal ?? 20));
                this.killedPeople++;
              }
              struck = true;
              break;
            }
          }
        }
      }

      // Move: toward the nearest herd animal within sense range, else keep the heading (and
      // sometimes turn).
      let d = this.dir[slot];
      if (!struck) {
        let best = 1e9, bx = 0, by = 0;
        for (let dy = -sense; dy <= sense; dy++) {
          for (let dx = -sense; dx <= sense; dx++) {
            if (herds.cellSlot[(((y + dy) & COORD_MASK) << 8) | ((x + dx) & COORD_MASK)] >= 0) {
              const dist = Math.abs(dx) + Math.abs(dy);
              if (dist < best) { best = dist; bx = dx; by = dy; }
            }
          }
        }
        if (best < 1e9) d = Math.abs(bx) >= Math.abs(by) ? (bx > 0 ? 0 : 1) : (by > 0 ? 2 : 3);
        else if (prng.next() > persist) d = prng.nextInt(0, 4);
      }
      let moved = false;
      if (!struck) {
        for (let k = 0; k < 4 && !moved; k++) {
          const dd = (d + k) & 3;
          const nx = (x + (dd === 0 ? 1 : dd === 1 ? -1 : 0)) & COORD_MASK;
          const ny = (y + (dd === 2 ? 1 : dd === 3 ? -1 : 0)) & COORD_MASK;
          if (this.canEnter(land, (ny << 8) | nx)) {
            this.cellSlot[(y << 8) | x] = -1;
            this.x[slot] = nx;
            this.y[slot] = ny;
            this.cellSlot[(ny << 8) | nx] = slot;
            this.dir[slot] = dd;
            e -= moveCost;
            moved = true;
          }
        }
      }

      // Breed into a free neighbouring tile; the pup's energy comes out of the parent's.
      if (e >= breedE && this.age[slot] >= adultAge && this.count < this.capacity && prng.next() < breedChance) {
        for (let k = 0; k < 4; k++) {
          const bx = (this.x[slot] + (k === 0 ? 1 : k === 1 ? -1 : 0)) & COORD_MASK;
          const by = (this.y[slot] + (k === 2 ? 1 : k === 3 ? -1 : 0)) & COORD_MASK;
          if (this.canEnter(land, (by << 8) | bx)) { this.spawn(bx, by, birthE, 0, this.dir[slot]); e -= birthE; break; }
        }
      }
      this.energy[slot] = e;
    }
  }

  public exportState(): WolvesState {
    const animals: Array<{ slot: number; x: number; y: number; energy: number; age: number; dir: number }> = [];
    for (let s = 0; s < this.capacity; s++) {
      if (this.alive[s] === 1) animals.push({ slot: s, x: this.x[s], y: this.y[s], energy: this.energy[s], age: this.age[s], dir: this.dir[s] });
    }
    return { prngState: this.prng.getState(), animals };
  }

  public importState(state: WolvesState): void {
    for (let s = 0; s < this.capacity; s++) if (this.alive[s] === 1) this.kill(s);
    this.prng.setState(state.prngState);
    for (const a of state.animals) this.spawn(a.x, a.y, a.energy, a.age, a.dir, a.slot);
  }
}
