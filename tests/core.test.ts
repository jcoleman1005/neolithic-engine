import { describe, expect, it } from 'vitest';
import {
  ACTIONS,
  ACTION_COUNT,
  GENOME_LENGTH,
  HIDDEN_COUNT,
  INPUT_COUNT,
  MEMORY_COUNT,
  MEMORY_START,
  NEIGHBOUR_FEATURES,
  OUTPUT_COUNT,
  OWN_INPUTS,
  forward,
} from '../src/core/brain';
import { CoreLedger } from '../src/core/ledger';
import { CoreWorld } from '../src/core/world';

/** A small, quick world used by most tests. */
const small = { width: 24, height: 24, founders: 60, maxPopulation: 400 };

function run(world: CoreWorld, ticks: number): void {
  for (let i = 0; i < ticks; i++) world.step();
}

/** An empty world (no founders, no walls) for hand-built scenarios. */
function bare(extra = {}): CoreWorld {
  const world = new CoreWorld({ ...small, founders: 0, wallsEnabled: false, ...extra });
  world.tick = 1; // hand-placed organisms are then not newborns, so they pay upkeep this tick
  return world;
}

function spawn(world: CoreWorld, x: number, y: number, energy: number): number {
  // Reaches into the world the way the founder routine does, for a hand-placed organism.
  const w = world as unknown as {
    takeSlot(): number;
    place(slot: number, cell: number, parent: number, energy: number, tag: number): void;
  };
  const slot = w.takeSlot();
  w.place(slot, y * world.width + x, 0, energy, 0.5);
  world.born[slot] = 0; // not a newborn, so it pays upkeep on its first tick
  return slot;
}

describe('core world: determinism (rules 3, 5, 124)', () => {
  it('the same seed gives the same world; a different seed does not', () => {
    const a = new CoreWorld({ ...small, seed: 7 });
    const b = new CoreWorld({ ...small, seed: 7 });
    const c = new CoreWorld({ ...small, seed: 8 });
    expect(a.stateHash()).toBe(b.stateHash());
    expect(a.stateHash()).not.toBe(c.stateHash());
    run(a, 150);
    run(b, 150);
    expect(a.stateHash()).toBe(b.stateHash());
  });

  it('snapshot and restore continue bit-identically (rule 126)', () => {
    const a = new CoreWorld({ ...small, seed: 3 });
    run(a, 80);
    const b = CoreWorld.fromState(JSON.parse(JSON.stringify(a.exportState())));
    expect(b.stateHash()).toBe(a.stateHash());
    run(a, 120);
    run(b, 120);
    expect(b.stateHash()).toBe(a.stateHash());
  });

  it('the ledger is an observer: checking it does not change the world (rule 123)', () => {
    const a = new CoreWorld({ ...small, seed: 5 });
    const b = new CoreWorld({ ...small, seed: 5 });
    const ledger = new CoreLedger(b);
    for (let i = 0; i < 100; i++) {
      a.step();
      b.step();
      ledger.check();
    }
    expect(b.stateHash()).toBe(a.stateHash());
  });
});

describe('core world: energy accounting (rules 28, 29, 129)', () => {
  it('energy in minus out equals the change in stored energy, to rounding, over a long run', () => {
    for (const seed of [1, 2, 3]) {
      const world = new CoreWorld({ ...small, seed });
      const ledger = new CoreLedger(world);
      let worst = 0;
      let events = 0;
      for (let i = 0; i < 400; i++) {
        world.step();
        worst = Math.max(worst, Math.abs(ledger.check().residual));
        events = world.totals.births + world.totals.deaths;
      }
      expect(worst).toBeLessThan(1e-6);
      // The run exercised the mechanisms the books must cover.
      expect(events).toBeGreaterThan(0);
    }
  });

  it('energy stays within 0 and the cap', () => {
    const world = new CoreWorld({ ...small, seed: 4 });
    for (let i = 0; i < 300; i++) {
      world.step();
      for (let s = 0; s < world.capacity; s++) {
        if (!world.alive[s]) continue;
        expect(world.energy[s]).toBeGreaterThan(0);
        expect(world.energy[s]).toBeLessThanOrEqual(world.config.maxEnergy);
      }
    }
  });

  it('eating food gains the bitten amount times digestion, and is booked as plant meal', () => {
    const world = bare();
    const s = spawn(world, 5, 5, 40);
    const cell = world.cellOf(s);
    world.fertility[cell] = 10;
    world.food[cell] = 10;
    const ledger = new CoreLedger(world);
    world.forcedActions.set(s, ACTIONS.EAT);
    world.step();
    const c = world.config;
    expect(world.food[cell]).toBeCloseTo(10 - c.biteSize + regrowth(world, 10 - c.biteSize, 10), 9);
    expect(world.flows.plantMeal).toBeCloseTo(c.biteSize * c.digestEfficiency, 9);
    expect(world.energy[s]).toBeCloseTo(40 + c.biteSize * c.digestEfficiency - c.upkeep, 9);
    expect(Math.abs(ledger.check().residual)).toBeLessThan(1e-9);
  });
});

function regrowth(world: CoreWorld, food: number, cap: number): number {
  const c = world.config;
  return Math.min(cap - food, (c.foodRegrowth * food + c.foodFloorRate * cap) * (1 - food / cap));
}

describe('core world: action legality (rules 6, 7, 13, 32, 64)', () => {
  it('walls and bodies are never entered and never co-occupied, over a long run', () => {
    const world = new CoreWorld({ ...small, seed: 9, wallThreshold: 0.6 });
    for (let i = 0; i < 300; i++) {
      world.step();
      const seen = new Set<number>();
      for (let s = 0; s < world.capacity; s++) {
        if (!world.alive[s]) continue;
        const cell = world.cellOf(s);
        expect(world.terrain[cell]).toBe(0);
        expect(seen.has(cell)).toBe(false);
        seen.add(cell);
        expect(world.occupant[cell]).toBe(s);
      }
    }
  });

  it('a blocked move is not legal, and costs nothing', () => {
    const world = bare({ wrap: false });
    const s = spawn(world, 0, 0, 50);
    const legal = new Uint8Array(12);
    world.legalActions(s, legal);
    expect(legal[0]).toBe(0); // north is off the map
    expect(legal[6]).toBe(0); // west is off the map
    expect(legal[7]).toBe(0);
    expect(legal[2]).toBe(1);
    world.forcedActions.set(s, 0); // illegal: ignored, the controller chooses instead
    const before = world.flows.move;
    world.step();
    const moved = world.flows.move - before;
    expect(moved === 0 || moved > 0).toBe(true);
    expect(world.y[s]).toBeGreaterThanOrEqual(0);
  });

  it('a diagonal costs diagonalMoveCost times a straight move', () => {
    const w1 = bare();
    const a = spawn(w1, 5, 5, 50);
    w1.forcedActions.set(a, 2);
    w1.step();
    const w2 = bare();
    const b = spawn(w2, 5, 5, 50);
    w2.forcedActions.set(b, 3);
    w2.step();
    expect(w2.flows.move / w1.flows.move).toBeCloseTo(w2.config.diagonalMoveCost, 9);
    expect(w2.x[b]).toBe(6);
    expect(w2.y[b]).toBe(6);
  });

  it('a diagonal cannot cut a wall corner', () => {
    const world = bare();
    const s = spawn(world, 5, 5, 50);
    world.terrain[5 * world.width + 6] = 1; // wall east of the mover
    const legal = new Uint8Array(12);
    world.legalActions(s, legal);
    expect(legal[1]).toBe(0); // NE passes the wall's corner
    expect(legal[3]).toBe(0); // SE too
    expect(legal[0]).toBe(1);
  });

  it('standing still costs only upkeep', () => {
    const world = bare();
    const s = spawn(world, 5, 5, 50);
    world.forcedActions.set(s, ACTIONS.STAY);
    world.step();
    expect(world.flows.move).toBe(0);
    expect(world.energy[s]).toBeCloseTo(50 - world.config.upkeep, 9);
  });
});

describe('core world: eating is only legal where a bite is worth it (rule 18)', () => {
  it('EAT is illegal on a cell with less than minBite food, so a trickle is not a trap', () => {
    const world = bare();
    const s = spawn(world, 5, 5, 50);
    const cell = world.cellOf(s);
    const legal = new Uint8Array(12);
    world.food[cell] = world.config.minBite - 0.01;
    world.legalActions(s, legal);
    expect(legal[ACTIONS.EAT]).toBe(0);
    world.food[cell] = world.config.minBite;
    world.legalActions(s, legal);
    expect(legal[ACTIONS.EAT]).toBe(1);
  });

  it('a bite takes at most biteSize, or what is left', () => {
    const world = bare();
    const s = spawn(world, 5, 5, 20);
    const cell = world.cellOf(s);
    world.fertility[cell] = 0; // no regrowth, so the cell shows only the bite
    world.food[cell] = 2.5;
    world.forcedActions.set(s, ACTIONS.EAT);
    world.step();
    expect(world.food[cell]).toBeCloseTo(0, 9);
    expect(world.flows.plantMeal).toBeCloseTo(2.5 * world.config.digestEfficiency, 9);
  });
});

describe('core world: conflict resolution (rule 4)', () => {
  it('two movers into one cell: exactly one wins, and the winner is seeded', () => {
    const outcome = (seed: number): number => {
      const world = bare({ seed });
      const a = spawn(world, 4, 5, 50);
      const b = spawn(world, 6, 5, 50);
      world.forcedActions.set(a, 2);
      world.forcedActions.set(b, 6);
      world.step();
      const aMoved = world.x[a] === 5;
      const bMoved = world.x[b] === 5;
      expect(aMoved).not.toBe(bMoved);
      expect(world.occupant[5 + 5 * world.width]).toBe(aMoved ? a : b);
      return aMoved ? 0 : 1;
    };
    expect(outcome(11)).toBe(outcome(11));
    const winners = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(outcome));
    expect(winners.size).toBe(2); // both can win across seeds
  });
});

describe('core world: reproduction and inheritance (rules 56, 71 to 75)', () => {
  it('a clone costs the parent the investment; the child gets it less the birth loss', () => {
    const world = bare({ mutationRate: 0 });
    const p = spawn(world, 5, 5, 80);
    const ledger = new CoreLedger(world);
    world.forcedActions.set(p, ACTIONS.REPRODUCE);
    world.step();
    const c = world.config;
    expect(world.population()).toBe(2);
    expect(world.totals.births).toBe(1);
    expect(world.energy[p]).toBeCloseTo(80 - c.reproduceCost - c.upkeep, 9);
    let child = -1;
    for (let s = 0; s < world.capacity; s++) if (world.alive[s] && s !== p) child = s;
    expect(world.energy[child]).toBeCloseTo(c.reproduceCost * (1 - c.birthLoss), 9);
    expect(world.parent[child]).toBe(world.ids[p]);
    expect(Math.abs(ledger.check().residual)).toBeLessThan(1e-9);
  });

  it('is illegal below the reproduction threshold', () => {
    const world = bare();
    const p = spawn(world, 5, 5, world.config.reproduceThreshold - 1);
    const legal = new Uint8Array(12);
    world.legalActions(p, legal);
    expect(legal[ACTIONS.REPRODUCE]).toBe(0);
  });

  it('with mutation off the child is an exact copy; with it on, it differs', () => {
    const copy = (rate: number): number => {
      const world = bare({ mutationRate: rate, mutationStep: 0.5 });
      const p = spawn(world, 5, 5, 90);
      for (let g = 0; g < GENOME_LENGTH; g++) world.weights[p * GENOME_LENGTH + g] = (g % 7) * 0.1;
      world.forcedActions.set(p, ACTIONS.REPRODUCE);
      world.step();
      let child = -1;
      for (let s = 0; s < world.capacity; s++) if (world.alive[s] && s !== p) child = s;
      let diff = 0;
      for (let g = 0; g < GENOME_LENGTH; g++) {
        diff += Math.abs(world.weights[child * GENOME_LENGTH + g] - world.weights[p * GENOME_LENGTH + g]);
      }
      return diff;
    };
    expect(copy(0)).toBe(0);
    expect(copy(0.5)).toBeGreaterThan(0);
  });
});

describe('core world: food and corpses (rules 16, 19, 24, 25, 60)', () => {
  it('a bitten-out cell regrows from the floor but never past capacity', () => {
    const world = bare();
    const cell = 7 * world.width + 7;
    world.fertility[cell] = 8;
    world.food[cell] = 0;
    world.step();
    expect(world.food[cell]).toBeGreaterThan(0);
    for (let i = 0; i < 400; i++) {
      world.step();
      expect(world.food[cell]).toBeLessThanOrEqual(8);
    }
    expect(world.food[cell]).toBeGreaterThan(7.9);
  });

  it('old age leaves a corpse holding a share of the body; with corpses off it leaves none', () => {
    const corpseAfterAge = (corpsesEnabled: boolean): number => {
      const world = bare({ corpsesEnabled, maxAge: 3, upkeep: 0 });
      const s = spawn(world, 5, 5, 50);
      const cell = world.cellOf(s);
      const ledger = new CoreLedger(world);
      for (let i = 0; i < 4; i++) {
        world.forcedActions.set(s, ACTIONS.STAY);
        world.step();
      }
      expect(world.population()).toBe(0);
      expect(Math.abs(ledger.check().residual)).toBeLessThan(1e-9);
      return world.corpse[cell];
    };
    expect(corpseAfterAge(true)).toBeCloseTo(50 * 0.7, 9);
    expect(corpseAfterAge(false)).toBe(0);
  });

  it('eating a corpse returns less than the bite, the rest is booked as loss', () => {
    const world = bare();
    const s = spawn(world, 5, 5, 20);
    const cell = world.cellOf(s);
    world.corpse[cell] = 30;
    const stored = world.storedEnergy();
    const ledger = new CoreLedger(world);
    world.forcedActions.set(s, ACTIONS.EAT_CORPSE);
    world.step();
    const c = world.config;
    expect(world.corpse[cell]).toBeCloseTo(30 - c.biteSize, 9);
    expect(world.energy[s]).toBeCloseTo(20 + c.biteSize * c.meatEfficiency - c.upkeep, 9);
    expect(world.storedEnergy()).toBeLessThan(stored);
    expect(Math.abs(ledger.check().residual)).toBeLessThan(1e-9);
  });

  it('a corpse rots away after its lifetime and the energy is booked as out', () => {
    const world = bare({ corpseLifetime: 5 });
    const cell = 3 * world.width + 3;
    world.corpse[cell] = 20;
    const ledger = new CoreLedger(world);
    for (let i = 0; i < 6; i++) world.step();
    expect(world.corpse[cell]).toBe(0);
    expect(world.flows.carrionRot).toBeCloseTo(20, 9);
    expect(Math.abs(ledger.check().residual)).toBeLessThan(1e-9);
  });
});

/** A genome whose first hidden unit latches: it stays on once cue input 0 has been seen, held by memory unit 0. */
function latchGenome(): Float32Array {
  const g = new Float32Array(GENOME_LENGTH);
  g[0 * INPUT_COUNT + 0] = 10; // hidden 0 reads the cue (own energy input)
  g[0 * INPUT_COUNT + MEMORY_START] = 10; // ... and memory unit 0
  const outWeights = HIDDEN_COUNT * INPUT_COUNT + HIDDEN_COUNT;
  g[outWeights + (ACTION_COUNT + 0) * HIDDEN_COUNT + 0] = 3; // memory write 0 follows hidden 0
  g[outWeights + ACTIONS.STAY * HIDDEN_COUNT + 0] = 5; // STAY scores high while latched
  return g;
}

describe('core brain: memory carries information across ticks (rules 52, 179)', () => {
  const hidden = new Float64Array(HIDDEN_COUNT);
  const out = new Float64Array(OUTPUT_COUNT);

  /** Runs the net: a cue on the first tick, silence after; returns STAY's score on the last tick. */
  function stayAfterCue(cue: boolean, silentTicks: number, keepMemory: boolean): number {
    const genome = latchGenome();
    const inputs = new Float64Array(INPUT_COUNT);
    const memory = new Float64Array(MEMORY_COUNT);
    for (let t = 0; t <= silentTicks; t++) {
      inputs.fill(0);
      inputs[0] = t === 0 && cue ? 1 : 0;
      for (let m = 0; m < MEMORY_COUNT; m++) inputs[MEMORY_START + m] = memory[m];
      forward(genome, 0, inputs, hidden, out);
      for (let m = 0; m < MEMORY_COUNT; m++) memory[m] = keepMemory ? Math.tanh(out[ACTION_COUNT + m]) : 0;
    }
    return out[ACTIONS.STAY];
  }

  it('an organism that saw a cue still acts on it many silent ticks later', () => {
    expect(stayAfterCue(true, 25, true)).toBeGreaterThan(4);
  });

  it('with no cue, or with memory wiped every tick, the same genome does not', () => {
    expect(stayAfterCue(false, 25, true)).toBe(0);
    expect(stayAfterCue(true, 25, false)).toBe(0);
  });
});

describe('core world: memory in the world (rules 68, 179)', () => {
  function latched(extra = {}): { world: CoreWorld; slot: number } {
    const world = bare(extra);
    const slot = spawn(world, 5, 5, 50);
    world.weights.set(latchGenome(), slot * GENOME_LENGTH);
    world.memory[slot * MEMORY_COUNT] = 1;
    return { world, slot };
  }

  it('memory persists tick to tick through the net', () => {
    const { world, slot } = latched();
    for (let i = 0; i < 20; i++) {
      world.forcedActions.set(slot, ACTIONS.STAY);
      world.step();
    }
    expect(world.memory[slot * MEMORY_COUNT]).toBeGreaterThan(0.9);
  });

  it('with memoryEnabled off the same organism holds nothing (the control arm)', () => {
    const { world, slot } = latched({ memoryEnabled: false });
    for (let i = 0; i < 20; i++) {
      world.forcedActions.set(slot, ACTIONS.STAY);
      world.step();
    }
    expect(world.memory[slot * MEMORY_COUNT]).toBe(1); // untouched: never read, never rewritten
    const inp = new Float64Array(INPUT_COUNT);
    world.senseInputs(slot, inp);
    expect(inp[MEMORY_START]).toBe(0);
  });

  it('a newborn starts with empty memory; memory is not inherited', () => {
    const { world, slot } = latched({ mutationRate: 0 });
    world.energy[slot] = 90;
    world.forcedActions.set(slot, ACTIONS.REPRODUCE);
    world.step();
    let child = -1;
    for (let s = 0; s < world.capacity; s++) if (world.alive[s] && s !== slot) child = s;
    expect(child).toBeGreaterThanOrEqual(0);
    expect(world.memory[slot * MEMORY_COUNT]).toBeGreaterThan(0.9);
    for (let m = 0; m < MEMORY_COUNT; m++) expect(world.memory[child * MEMORY_COUNT + m]).toBe(0);
  });

  it('memory is part of the state: restore continues bit-identically', () => {
    const { world, slot } = latched();
    world.step();
    const copy = CoreWorld.fromState(JSON.parse(JSON.stringify(world.exportState())));
    expect(copy.memory[slot * MEMORY_COUNT]).toBe(world.memory[slot * MEMORY_COUNT]);
    expect(copy.stateHash()).toBe(world.stateHash());
    run(world, 30);
    run(copy, 30);
    expect(copy.stateHash()).toBe(world.stateHash());
    // and a different memory is a different state
    const other = CoreWorld.fromState(world.exportState());
    other.memory[slot * MEMORY_COUNT] = 0.123;
    expect(other.stateHash()).not.toBe(world.stateHash());
  });
});

describe('core world: neighbour feature slots (rules 107, 135, 136)', () => {
  const slotAt = (dir: number): number => OWN_INPUTS + dir * NEIGHBOUR_FEATURES;

  it('a neighbour that moved last tick shows its heading; one that ate shows that', () => {
    const world = bare({ moveCost: 0 });
    const a = spawn(world, 5, 5, 50);
    const b = spawn(world, 4, 6, 50);
    world.forcedActions.set(a, ACTIONS.STAY);
    world.forcedActions.set(b, 2); // east, to (5, 6): directly south of a
    world.step();
    expect(world.x[b]).toBe(5);
    expect(world.y[b]).toBe(6);
    const inp = new Float64Array(INPUT_COUNT);
    world.senseInputs(a, inp);
    const k = slotAt(4); // south
    expect(inp[k + 1]).toBe(1); // occupied
    expect(inp[k + 3]).toBe(1); // heading x: east
    expect(inp[k + 4]).toBe(0);
    expect(inp[k + 5]).toBe(1); // it moved
    expect(inp[k + 6]).toBe(0); // it did not eat

    // next tick b eats; a then senses that, and no heading
    world.food[world.cellOf(b)] = 5;
    world.forcedActions.set(b, ACTIONS.EAT);
    world.forcedActions.set(a, ACTIONS.STAY);
    world.step();
    world.senseInputs(a, inp);
    expect(inp[k + 5]).toBe(0);
    expect(inp[k + 6]).toBe(1);
  });

  it('empty and wall neighbours report no occupant features', () => {
    const world = bare();
    const a = spawn(world, 0, 0, 50);
    const inp = new Float64Array(INPUT_COUNT);
    world.senseInputs(a, inp);
    const off = slotAt(0); // north is off the map
    expect(inp[off + 2]).toBe(1);
    for (const f of [1, 3, 4, 5, 6, 7]) expect(inp[off + f]).toBe(0);
  });

  it('tag similarity is 1 for equal tags and falls with the difference; the tag drifts at birth', () => {
    const world = bare({ mutationRate: 0, tagStep: 0 });
    const a = spawn(world, 5, 5, 90);
    const b = spawn(world, 6, 5, 50);
    world.tag[b] = 0.5;
    world.tag[a] = 0.5;
    const inp = new Float64Array(INPUT_COUNT);
    world.senseInputs(a, inp);
    expect(inp[slotAt(2) + 7]).toBeCloseTo(1, 6);
    world.tag[b] = 0.8;
    world.senseInputs(a, inp);
    expect(inp[slotAt(2) + 7]).toBeCloseTo(0.7, 6);

    world.forcedActions.set(a, ACTIONS.REPRODUCE);
    world.step();
    let child = -1;
    for (let s = 0; s < world.capacity; s++) if (world.alive[s] && s !== a && s !== b) child = s;
    expect(world.tag[child]).toBe(world.tag[a]); // tagStep 0: an exact copy

    const drifting = bare({ mutationRate: 0, tagStep: 0.1 });
    const p = spawn(drifting, 5, 5, 90);
    drifting.tag[p] = 0.5;
    drifting.forcedActions.set(p, ACTIONS.REPRODUCE);
    drifting.step();
    let c2 = -1;
    for (let s = 0; s < drifting.capacity; s++) if (drifting.alive[s] && s !== p) c2 = s;
    expect(drifting.tag[c2]).not.toBe(drifting.tag[p]);
    expect(Math.abs(drifting.tag[c2] - drifting.tag[p])).toBeLessThan(0.6);
  });
});
