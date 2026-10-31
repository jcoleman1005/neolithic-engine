import { PRNG } from '../sim/prng';
import {
  ACTIONS,
  ACTION_COUNT,
  GENOME_LENGTH,
  HERE_START,
  HIDDEN_COUNT,
  INPUT_COUNT,
  MEMORY_COUNT,
  MEMORY_START,
  NEIGHBOUR_FEATURES,
  OUTPUT_COUNT,
  OWN_INPUTS,
  forward,
  outputBiasIndex,
} from './brain';
import { DEFAULT_CORE_CONFIG, type CoreConfig } from './config';
import { Hasher } from './hash';
import { noiseField } from './noise';

/** 0 N, 1 NE, 2 E, 3 SE, 4 S, 5 SW, 6 W, 7 NW. Odd indices are diagonals. */
const DX = [0, 1, 1, 1, 0, -1, -1, -1];
const DY = [-1, -1, 0, 1, 1, 1, 0, -1];

/** Cumulative energy flows across the boundary of the animals' stored energy (rule 28). */
export interface CoreFlows {
  /** In: energy gained from plants. */
  plantMeal: number;
  /** Out: everything below. */
  upkeep: number;
  move: number;
  birthLoss: number;
  deathLoss: number;
  carrionMealLoss: number;
  carrionRot: number;
  overCap: number;
}

export interface CoreTotals {
  births: number;
  deaths: number;
  starved: number;
  aged: number;
}

export interface CoreState {
  config: CoreConfig;
  tick: number;
  nextId: number;
  rngState: number;
  totals: CoreTotals;
  terrain: number[];
  fertility: number[];
  food: number[];
  corpse: number[];
  corpseAge: number[];
  freeSlots: number[];
  alive: number[];
  ids: number[];
  parent: number[];
  x: number[];
  y: number[];
  energy: number[];
  age: number[];
  born: number[];
  lastOk: number[];
  lastMoveDir: number[];
  lastAte: number[];
  tag: number[];
  memory: number[];
  weights: number[];
}

export class CoreWorld {
  readonly config: CoreConfig;
  readonly width: number;
  readonly height: number;
  readonly capacity: number;
  tick = 0;
  nextId = 1;
  readonly rng: PRNG;
  readonly totals: CoreTotals = { births: 0, deaths: 0, starved: 0, aged: 0 };
  readonly flows: CoreFlows = {
    plantMeal: 0,
    upkeep: 0,
    move: 0,
    birthLoss: 0,
    deathLoss: 0,
    carrionMealLoss: 0,
    carrionRot: 0,
    overCap: 0,
  };

  // Cells
  readonly terrain: Uint8Array; // 0 open, 1 wall
  readonly fertility: Float64Array; // food capacity of each cell
  readonly food: Float64Array;
  readonly corpse: Float64Array; // energy lying in each cell
  readonly corpseAge: Uint32Array;
  readonly occupant: Int32Array; // slot of the organism in each cell, or -1
  private readonly neighbours: Int32Array; // 8 per cell, -1 if none

  // Organisms, struct of arrays by slot
  readonly alive: Uint8Array;
  readonly ids: Uint32Array;
  readonly parent: Uint32Array;
  readonly x: Int16Array;
  readonly y: Int16Array;
  readonly energy: Float64Array;
  readonly age: Uint32Array;
  readonly born: Uint32Array;
  readonly lastOk: Uint8Array;
  /** Direction of the last successful move (this tick's, once resolved), or -1. Sensed by neighbours next tick. */
  readonly lastMoveDir: Int8Array;
  readonly lastAte: Uint8Array;
  /** Inherited colour tag in [0, 1] with no function of its own (rule 98). */
  readonly tag: Float32Array;
  /** Recurrent state, one life long, zero at birth (rule 179). */
  readonly memory: Float32Array;
  readonly weights: Float32Array;
  private freeSlots: number[] = [];

  /** Test hook: slot -> action to take next tick instead of the controller's choice. */
  readonly forcedActions = new Map<number, number>();

  private readonly inputs = new Float64Array(INPUT_COUNT);
  private readonly hidden = new Float64Array(HIDDEN_COUNT);
  private readonly scores = new Float64Array(OUTPUT_COUNT);
  /** Observer: how often each action was chosen (rule 120). Not state, not hashed. */
  readonly actionCounts = new Float64Array(ACTION_COUNT);

  constructor(config: Partial<CoreConfig> = {}, populate = true) {
    this.config = { ...DEFAULT_CORE_CONFIG, ...config };
    const c = this.config;
    this.width = c.width;
    this.height = c.height;
    this.capacity = c.maxPopulation;
    this.rng = new PRNG(c.seed);
    const cells = this.width * this.height;
    this.terrain = new Uint8Array(cells);
    this.fertility = new Float64Array(cells);
    this.food = new Float64Array(cells);
    this.corpse = new Float64Array(cells);
    this.corpseAge = new Uint32Array(cells);
    this.occupant = new Int32Array(cells).fill(-1);
    this.neighbours = new Int32Array(cells * 8).fill(-1);
    const n = this.capacity;
    this.alive = new Uint8Array(n);
    this.ids = new Uint32Array(n);
    this.parent = new Uint32Array(n);
    this.x = new Int16Array(n);
    this.y = new Int16Array(n);
    this.energy = new Float64Array(n);
    this.age = new Uint32Array(n);
    this.born = new Uint32Array(n);
    this.lastOk = new Uint8Array(n);
    this.lastMoveDir = new Int8Array(n).fill(-1);
    this.lastAte = new Uint8Array(n);
    this.tag = new Float32Array(n);
    this.memory = new Float32Array(n * MEMORY_COUNT);
    this.weights = new Float32Array(n * GENOME_LENGTH);
    for (let s = n - 1; s >= 0; s--) this.freeSlots.push(s);
    this.buildTerrain();
    this.buildNeighbours();
    if (populate) this.populate();
  }

  // ---------------------------------------------------------------- set-up

  private buildTerrain(): void {
    const c = this.config;
    const w = this.width;
    const h = this.height;
    const fert = noiseField(w, h, c.noiseScale, `${c.seed}:fertility`);
    const walls = noiseField(w, h, c.noiseScale, `${c.seed}:walls`);
    for (let i = 0; i < w * h; i++) {
      if (c.wallsEnabled && walls[i] > c.wallThreshold) this.terrain[i] = 1;
      this.fertility[i] = this.terrain[i] === 1 ? 0 : fert[i] * fert[i] * c.foodCapMax;
      this.food[i] = this.fertility[i];
    }
  }

  private buildNeighbours(): void {
    const w = this.width;
    const h = this.height;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        for (let d = 0; d < 8; d++) {
          let nx = x + DX[d];
          let ny = y + DY[d];
          if (this.config.wrap) {
            nx = (nx + w) % w;
            ny = (ny + h) % h;
          } else if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          this.neighbours[(y * w + x) * 8 + d] = ny * w + nx;
        }
      }
    }
  }

  private populate(): void {
    const c = this.config;
    for (let k = 0; k < c.founders; k++) {
      const cell = this.randomFreeCell();
      if (cell < 0) break;
      const slot = this.takeSlot();
      const base = slot * GENOME_LENGTH;
      for (let g = 0; g < GENOME_LENGTH; g++) this.weights[base + g] = this.rng.nextGaussian(0, c.founderWeightSd);
      this.weights[base + outputBiasIndex(ACTIONS.EAT)] += c.founderEatBias;
      this.weights[base + outputBiasIndex(ACTIONS.REPRODUCE)] += c.founderReproduceBias;
      this.place(slot, cell, 0, c.founderEnergy, this.rng.next());
    }
  }

  private randomFreeCell(): number {
    for (let tries = 0; tries < 200; tries++) {
      const cell = this.rng.nextInt(0, this.width * this.height - 1);
      if (this.terrain[cell] === 0 && this.occupant[cell] < 0) return cell;
    }
    return -1;
  }

  private takeSlot(): number {
    return this.freeSlots.pop() as number;
  }

  private place(slot: number, cell: number, parentId: number, energy: number, tag: number): void {
    this.alive[slot] = 1;
    this.ids[slot] = this.nextId++;
    this.parent[slot] = parentId;
    this.x[slot] = cell % this.width;
    this.y[slot] = Math.floor(cell / this.width);
    this.energy[slot] = energy;
    this.age[slot] = 0;
    this.born[slot] = this.tick;
    this.lastOk[slot] = 0;
    this.lastMoveDir[slot] = -1;
    this.lastAte[slot] = 0;
    this.tag[slot] = tag;
    this.memory.fill(0, slot * MEMORY_COUNT, (slot + 1) * MEMORY_COUNT);
    this.occupant[cell] = slot;
  }

  // ---------------------------------------------------------------- queries

  cellOf(slot: number): number {
    return this.y[slot] * this.width + this.x[slot];
  }

  neighbour(cell: number, dir: number): number {
    return this.neighbours[cell * 8 + dir];
  }

  population(): number {
    return this.capacity - this.freeSlots.length;
  }

  /** The energy the animals hold: every body plus every corpse (rule 28). */
  storedEnergy(): number {
    let sum = 0;
    for (let s = 0; s < this.capacity; s++) if (this.alive[s]) sum += this.energy[s];
    for (let i = 0; i < this.corpse.length; i++) sum += this.corpse[i];
    return sum;
  }

  /** Rule 64: illegal actions are impossible; the controller only scores legal ones. */
  legalActions(slot: number, out: Uint8Array): void {
    const c = this.config;
    const cell = this.cellOf(slot);
    out.fill(0);
    for (let d = 0; d < 8; d++) out[ACTIONS.MOVE_0 + d] = this.canMove(cell, d) ? 1 : 0;
    out[ACTIONS.EAT] = this.food[cell] >= c.minBite ? 1 : 0;
    out[ACTIONS.STAY] = 1;
    out[ACTIONS.EAT_CORPSE] = c.corpsesEnabled && this.corpse[cell] > 1e-9 ? 1 : 0;
    let free = false;
    for (let d = 0; d < 8; d++) {
      const n = this.neighbour(cell, d);
      if (n >= 0 && this.terrain[n] === 0 && this.occupant[n] < 0) free = true;
    }
    out[ACTIONS.REPRODUCE] =
      free && this.freeSlots.length > 0 && this.energy[slot] >= c.reproduceThreshold && this.energy[slot] >= c.reproduceCost
        ? 1
        : 0;
  }

  /** Rules 6, 7, 13: free, open, and (for diagonals) not cutting a wall corner. */
  private canMove(cell: number, dir: number): boolean {
    const n = this.neighbour(cell, dir);
    if (n < 0 || this.terrain[n] !== 0 || this.occupant[n] >= 0) return false;
    if (dir & 1) {
      const a = this.neighbour(cell, (dir + 7) & 7);
      const b = this.neighbour(cell, (dir + 1) & 7);
      if (a < 0 || b < 0 || this.terrain[a] !== 0 || this.terrain[b] !== 0) return false;
    }
    return true;
  }

  // ---------------------------------------------------------------- tick

  step(): void {
    const c = this.config;
    const n = this.capacity;
    const actions = new Int8Array(n).fill(-1);
    const legal = new Uint8Array(ACTION_COUNT);

    // Rule 3: every decision is made from the pre-tick snapshot.
    for (let s = 0; s < n; s++) {
      if (!this.alive[s]) continue;
      this.legalActions(s, legal);
      this.think(s);
      const forced = this.forcedActions.get(s);
      actions[s] = forced !== undefined && legal[forced] ? forced : this.choose(legal);
      this.actionCounts[actions[s]]++;
    }
    this.forcedActions.clear();
    // What neighbours sense next tick is what each did this tick.
    for (let s = 0; s < n; s++) {
      if (!this.alive[s]) continue;
      this.lastMoveDir[s] = -1;
      this.lastAte[s] = 0;
    }

    this.resolveMoves(actions);

    for (let s = 0; s < n; s++) {
      if (!this.alive[s]) continue;
      const a = actions[s];
      if (a === ACTIONS.EAT) this.eat(s);
      else if (a === ACTIONS.EAT_CORPSE) this.eatCorpse(s);
      else if (a === ACTIONS.STAY) this.lastOk[s] = 1;
    }

    this.resolveReproduction(actions);

    for (let s = 0; s < n; s++) {
      if (!this.alive[s] || this.born[s] === this.tick) continue;
      this.age[s]++;
      this.spend(s, c.upkeep, 'upkeep');
      if (this.energy[s] <= 0) this.die(s, true);
      else if (this.age[s] >= c.maxAge) this.die(s, false);
    }

    this.updateCells();
    this.tick++;
  }

  /** Everything one organism senses this tick: itself, its 8 neighbours, its cell, its memory (rules 42 to 45). */
  senseInputs(slot: number, inp: Float64Array): void {
    const c = this.config;
    const cell = this.cellOf(slot);
    inp[0] = this.energy[slot] / c.maxEnergy;
    inp[1] = Math.min(this.age[slot] / c.maxAge, 1);
    inp[2] = this.lastOk[slot];
    const myTag = this.tag[slot];
    for (let d = 0; d < 8; d++) {
      const nb = this.neighbour(cell, d);
      const k = OWN_INPUTS + d * NEIGHBOUR_FEATURES;
      inp.fill(0, k, k + NEIGHBOUR_FEATURES);
      if (nb < 0 || this.terrain[nb] === 1) {
        inp[k + 2] = 1;
        continue;
      }
      inp[k] = this.food[nb] / c.foodCapMax;
      const o = this.occupant[nb];
      if (o < 0) continue;
      inp[k + 1] = 1;
      const m = this.lastMoveDir[o];
      if (m >= 0) {
        inp[k + 3] = DX[m];
        inp[k + 4] = DY[m];
        inp[k + 5] = 1;
      }
      inp[k + 6] = this.lastAte[o];
      inp[k + 7] = 1 - Math.abs(this.tag[o] - myTag);
    }
    inp[HERE_START] = this.food[cell] / c.foodCapMax;
    inp[HERE_START + 1] = Math.min(this.corpse[cell] / c.maxEnergy, 1);
    for (let m = 0; m < MEMORY_COUNT; m++) {
      inp[MEMORY_START + m] = c.memoryEnabled ? this.memory[slot * MEMORY_COUNT + m] : 0;
    }
  }

  /** Senses, scores every action, and rewrites memory from the extra outputs (rule 179). */
  private think(slot: number): void {
    this.senseInputs(slot, this.inputs);
    forward(this.weights, slot * GENOME_LENGTH, this.inputs, this.hidden, this.scores);
    if (this.config.memoryEnabled) {
      for (let m = 0; m < MEMORY_COUNT; m++) this.memory[slot * MEMORY_COUNT + m] = Math.tanh(this.scores[ACTION_COUNT + m]);
    }
  }

  private choose(legal: Uint8Array): number {
    // Highest legal score wins; exact ties are broken by a seeded draw (rule 4).
    let best = -1;
    let ties = 0;
    for (let a = 0; a < ACTION_COUNT; a++) {
      if (!legal[a]) continue;
      if (best < 0 || this.scores[a] > this.scores[best]) {
        best = a;
        ties = 1;
      } else if (this.scores[a] === this.scores[best]) {
        ties++;
        if (this.rng.nextInt(1, ties) === 1) best = a;
      }
    }
    return best;
  }

  /** Rule 4: several movers into one cell: a seeded reservoir draw picks the winner. */
  private resolveMoves(actions: Int8Array): void {
    const claims = new Map<number, { winner: number; count: number }>();
    for (let s = 0; s < this.capacity; s++) {
      if (!this.alive[s] || actions[s] < 0 || actions[s] > 7) continue;
      const target = this.neighbour(this.cellOf(s), actions[s]);
      const claim = claims.get(target);
      if (!claim) claims.set(target, { winner: s, count: 1 });
      else {
        claim.count++;
        if (this.rng.nextInt(1, claim.count) === 1) claim.winner = s;
      }
    }
    for (let s = 0; s < this.capacity; s++) {
      if (!this.alive[s] || actions[s] < 0 || actions[s] > 7) continue;
      this.lastOk[s] = 0;
    }
    for (const [target, claim] of claims) {
      const s = claim.winner;
      const dir = actions[s];
      this.occupant[this.cellOf(s)] = -1;
      this.x[s] = target % this.width;
      this.y[s] = Math.floor(target / this.width);
      this.occupant[target] = s;
      this.lastOk[s] = 1;
      this.lastMoveDir[s] = dir;
      // Rule 32: moving costs energy only when the move succeeds.
      const cost = this.config.moveCost * (dir & 1 ? this.config.diagonalMoveCost : 1);
      this.spend(s, cost, 'move');
    }
  }

  private eat(slot: number): void {
    const c = this.config;
    const cell = this.cellOf(slot);
    const bite = Math.min(c.biteSize, this.food[cell]);
    this.food[cell] -= bite;
    this.gain(slot, bite * c.digestEfficiency);
    this.flows.plantMeal += bite * c.digestEfficiency;
    this.lastOk[slot] = bite > 0 ? 1 : 0;
    this.lastAte[slot] = this.lastOk[slot];
  }

  private eatCorpse(slot: number): void {
    const c = this.config;
    const cell = this.cellOf(slot);
    const bite = Math.min(c.biteSize, this.corpse[cell]);
    this.corpse[cell] -= bite;
    if (this.corpse[cell] <= 1e-12) {
      this.flows.carrionRot += this.corpse[cell];
      this.corpse[cell] = 0;
    }
    const gained = bite * c.meatEfficiency;
    this.flows.carrionMealLoss += bite - gained;
    this.gain(slot, gained);
    this.lastOk[slot] = bite > 0 ? 1 : 0;
    this.lastAte[slot] = this.lastOk[slot];
  }

  /** Energy rises up to the cap; anything above is discarded and booked (rule 29). */
  private gain(slot: number, amount: number): void {
    const next = this.energy[slot] + amount;
    if (next > this.config.maxEnergy) {
      this.flows.overCap += next - this.config.maxEnergy;
      this.energy[slot] = this.config.maxEnergy;
    } else this.energy[slot] = next;
  }

  /** Spend at most what the body holds, so energy never goes below zero. */
  private spend(slot: number, amount: number, flow: 'upkeep' | 'move'): void {
    const paid = Math.min(amount, this.energy[slot]);
    this.energy[slot] -= paid;
    this.flows[flow] += paid;
  }

  /** Rules 71 to 75: a clone costs energy; the child inherits the weights with mutation. */
  private resolveReproduction(actions: Int8Array): void {
    const c = this.config;
    const parents: number[] = [];
    for (let s = 0; s < this.capacity; s++) if (this.alive[s] && actions[s] === ACTIONS.REPRODUCE) parents.push(s);
    // Shuffle so nobody wins crowded space by slot order.
    for (let i = parents.length - 1; i > 0; i--) {
      const j = this.rng.nextInt(0, i);
      [parents[i], parents[j]] = [parents[j], parents[i]];
    }
    const free: number[] = [];
    for (const p of parents) {
      free.length = 0;
      const cell = this.cellOf(p);
      for (let d = 0; d < 8; d++) {
        const nb = this.neighbour(cell, d);
        if (nb >= 0 && this.terrain[nb] === 0 && this.occupant[nb] < 0) free.push(nb);
      }
      if (free.length === 0 || this.freeSlots.length === 0 || this.energy[p] < c.reproduceCost) continue;
      const target = free[this.rng.nextInt(0, free.length - 1)];
      this.energy[p] -= c.reproduceCost;
      const childEnergy = c.reproduceCost * (1 - c.birthLoss);
      this.flows.birthLoss += c.reproduceCost - childEnergy;
      const child = this.takeSlot();
      const from = p * GENOME_LENGTH;
      const to = child * GENOME_LENGTH;
      for (let g = 0; g < GENOME_LENGTH; g++) {
        let w = this.weights[from + g];
        if (this.rng.next() < c.mutationRate) w += this.rng.nextGaussian(0, c.mutationStep);
        this.weights[to + g] = w;
      }
      const childTag = Math.min(1, Math.max(0, this.tag[p] + this.rng.nextGaussian(0, c.tagStep)));
      this.place(child, target, this.ids[p], childEnergy, childTag);
      this.lastOk[p] = 1;
      this.totals.births++;
    }
  }

  /** Rules 24, 25: a body leaves a corpse holding a share of its energy. */
  private die(slot: number, starved: boolean): void {
    const c = this.config;
    const cell = this.cellOf(slot);
    const e = this.energy[slot];
    const toCorpse = c.corpsesEnabled ? e * c.corpseFraction : 0;
    if (toCorpse > 0) {
      this.corpse[cell] += toCorpse;
      this.corpseAge[cell] = 0;
    }
    this.flows.deathLoss += e - toCorpse;
    this.energy[slot] = 0;
    this.alive[slot] = 0;
    this.occupant[cell] = -1;
    this.freeSlots.push(slot);
    this.totals.deaths++;
    if (starved) this.totals.starved++;
    else this.totals.aged++;
  }

  /** Rules 16, 19, 25: food regrows logistically from a floor; corpses rot away. */
  private updateCells(): void {
    const c = this.config;
    for (let i = 0; i < this.food.length; i++) {
      const cap = this.fertility[i];
      if (cap > 0) {
        const f = this.food[i];
        const room = 1 - f / cap;
        this.food[i] = Math.min(cap, f + (c.foodRegrowth * f + c.foodFloorRate * cap) * room);
      }
      if (this.corpse[i] > 0 && ++this.corpseAge[i] >= c.corpseLifetime) {
        this.flows.carrionRot += this.corpse[i];
        this.corpse[i] = 0;
      }
    }
  }

  // ---------------------------------------------------------------- state

  /** Rule 124: equal hashes must continue identically. Counters and flows are not state. */
  stateHash(): string {
    const h = new Hasher();
    h.num(this.tick);
    h.num(this.nextId);
    h.num(this.rng.getState() >>> 0); // the PRNG reports signed, restores unsigned
    h.array(this.terrain);
    h.array(this.food);
    h.array(this.corpse);
    h.array(this.corpseAge);
    h.array(this.occupant);
    h.array(this.freeSlots);
    for (let s = 0; s < this.capacity; s++) {
      if (!this.alive[s]) continue;
      h.num(s);
      h.num(this.ids[s]);
      h.num(this.parent[s]);
      h.num(this.x[s]);
      h.num(this.y[s]);
      h.num(this.energy[s]);
      h.num(this.age[s]);
      h.num(this.born[s]);
      h.num(this.lastOk[s]);
      h.num(this.lastMoveDir[s]);
      h.num(this.lastAte[s]);
      h.num(this.tag[s]);
      h.array(this.memory.subarray(s * MEMORY_COUNT, (s + 1) * MEMORY_COUNT));
      h.array(this.weights.subarray(s * GENOME_LENGTH, (s + 1) * GENOME_LENGTH));
    }
    return h.digest();
  }

  /** Rule 126: snapshot and restore bit-identically. */
  exportState(): CoreState {
    return {
      config: { ...this.config },
      tick: this.tick,
      nextId: this.nextId,
      rngState: this.rng.getState(),
      totals: { ...this.totals },
      terrain: Array.from(this.terrain),
      fertility: Array.from(this.fertility),
      food: Array.from(this.food),
      corpse: Array.from(this.corpse),
      corpseAge: Array.from(this.corpseAge),
      freeSlots: [...this.freeSlots],
      alive: Array.from(this.alive),
      ids: Array.from(this.ids),
      parent: Array.from(this.parent),
      x: Array.from(this.x),
      y: Array.from(this.y),
      energy: Array.from(this.energy),
      age: Array.from(this.age),
      born: Array.from(this.born),
      lastOk: Array.from(this.lastOk),
      lastMoveDir: Array.from(this.lastMoveDir),
      lastAte: Array.from(this.lastAte),
      tag: Array.from(this.tag),
      memory: Array.from(this.memory),
      weights: Array.from(this.weights),
    };
  }

  static fromState(state: CoreState): CoreWorld {
    const w = new CoreWorld(state.config, false);
    w.tick = state.tick;
    w.nextId = state.nextId;
    w.rng.setState(state.rngState);
    Object.assign(w.totals, state.totals);
    w.terrain.set(state.terrain);
    w.fertility.set(state.fertility);
    w.food.set(state.food);
    w.corpse.set(state.corpse);
    w.corpseAge.set(state.corpseAge);
    w.freeSlots = [...state.freeSlots];
    w.alive.set(state.alive);
    w.ids.set(state.ids);
    w.parent.set(state.parent);
    w.x.set(state.x);
    w.y.set(state.y);
    w.energy.set(state.energy);
    w.age.set(state.age);
    w.born.set(state.born);
    w.lastOk.set(state.lastOk);
    w.lastMoveDir.set(state.lastMoveDir);
    w.lastAte.set(state.lastAte);
    w.tag.set(state.tag);
    w.memory.set(state.memory);
    w.weights.set(state.weights);
    w.occupant.fill(-1);
    for (let s = 0; s < w.capacity; s++) if (w.alive[s]) w.occupant[w.cellOf(s)] = s;
    return w;
  }
}
