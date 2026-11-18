import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';
import { Rules } from '../src/sim/rules';
import { Land } from '../src/sim/land';
import { PRNG } from '../src/sim/prng';
import { DEFAULT_CONFIG } from '../src/sim/config';
import {
  CARRY_EARTH,
  CARRY_FOOD,
  CARRY_WATER,
  HABIT_GENEROSITY,
  slotFromId,
} from '../src/sim/people';

/** Mass-conservation helper: total food across land, piles, and carried food. */
function totalFood(world: World): number {
  let sum = 0;
  for (let i = 0; i < world.land.food.length; i++) {
    sum += world.land.food[i] + world.land.pile[i];
  }
  for (let i = 0; i < world.people.activeCount; i++) {
    const slot = world.people.activeSlots[i];
    if (world.people.carryKind[slot] === CARRY_FOOD) {
      sum += world.people.carry[slot];
    }
  }
  return sum;
}

function totalPileMass(world: World): number {
  let sum = 0;
  for (let i = 0; i < world.land.pile.length; i++) sum += world.land.pile[i];
  return sum;
}

function quietWorld(config: Record<string, number | boolean> = {}): World {
  return new World(
    {
      initialPopulation: 0,
      wolfInitialCount: 0,
      herdInitialCount: 0,
      ...config,
    },
    8
  );
}

function findDryLandCell(w: World): number {
  for (let i = 0; i < 65536; i++) {
    if (w.land.isWater[i] === 0 && w.land.stone[i] === 0 && w.land.fertility[i] > 0.1) return i;
  }
  return -1;
}

describe('Patch 1: carry-kind guards', () => {
  it('does not relabel WATER or EARTH as FOOD in the hoard block', () => {
    for (const kind of [CARRY_WATER, CARRY_EARTH] as const) {
      const w = quietWorld({ stockpilesEnabled: true, waterCarryEnabled: true, earthEnabled: true });
      const cell = findDryLandCell(w);
      expect(cell).toBeGreaterThanOrEqual(0);
      const x = cell & 255;
      const y = cell >> 8;
      w.land.food[cell] = w.land.capacityAt(cell, w.config);
      const slot = slotFromId(
        w.people.spawn(x, y, 95, 0, 0, 0, 0, new Uint8Array(8), new Uint8Array(8), 0)
      );
      w.people.carryKind[slot] = kind;
      w.people.carry[slot] = 19;
      w.people.hydration[slot] = w.config.thirstMax ?? 100;

      const pileBefore = totalPileMass(w);
      w.step();

      expect(w.people.carryKind[slot]).toBe(kind);
      expect(totalPileMass(w)).toBe(pileBefore);
      expect(totalFood(w)).toBeGreaterThan(0);
    }
  });

  it('keeps CARRY_WATER when grazing with farming enabled', () => {
    const w = quietWorld({ farmingEnabled: true, waterCarryEnabled: true });
    const cell = findDryLandCell(w);
    expect(cell).toBeGreaterThanOrEqual(0);
    const x = cell & 255;
    const y = cell >> 8;
    w.land.food[cell] = 50;
    const slot = slotFromId(
      w.people.spawn(x, y, 40, 0, 0, 0, 0, new Uint8Array(8), new Uint8Array(8), 0)
    );
    w.people.carryKind[slot] = CARRY_WATER;
    w.people.carry[slot] = 10;
    w.people.hydration[slot] = w.config.thirstMax ?? 100;

    w.step();
    expect(w.people.carryKind[slot]).toBe(CARRY_WATER);
  });
});

describe('Patch 2: dropFood & dropFoodSpill', () => {
  it('dropFood returns how much was stored when hitting pileCap', () => {
    const w = quietWorld({ pileCap: 200 });
    const cell = findDryLandCell(w);
    const x = cell & 255;
    const y = cell >> 8;
    w.land.pile[cell] = 195;
    const stored = w.land.dropFood(x, y, 20, w.config);
    expect(stored).toBe(5);
    expect(w.land.pile[cell]).toBe(200);
  });

  it('dropFoodSpill overflows onto neighbors and conserves total pile mass', () => {
    const w = quietWorld({ pileCap: 200 });
    let center = -1;
    for (let y = 10; y < 245 && center < 0; y++) {
      for (let x = 10; x < 245 && center < 0; x++) {
        let allLand = true;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (w.land.isWater[((y + dy) << 8) | (x + dx)] === 1) allLand = false;
          }
        }
        if (allLand) center = (y << 8) | x;
      }
    }
    expect(center).toBeGreaterThanOrEqual(0);
    const x = center & 255;
    const y = center >> 8;
    w.land.pile[center] = 200;

    const before = totalPileMass(w);
    const left = w.land.dropFoodSpill(x, y, 35, w.config);
    expect(left).toBe(0);
    expect(totalPileMass(w) - before).toBe(35);
  });

  it('carrier unload keeps remainder when all 9 tiles in reach are full', () => {
    const w = quietWorld({ pileCap: 200, stockpilesEnabled: true, dropWhenFull: true });
    let center = -1;
    for (let y = 10; y < 245 && center < 0; y++) {
      for (let x = 10; x < 245 && center < 0; x++) {
        let allLand = true;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (w.land.isWater[((y + dy) << 8) | (x + dx)] === 1) allLand = false;
          }
        }
        if (allLand) center = (y << 8) | x;
      }
    }
    const x = center & 255;
    const y = center >> 8;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        w.land.pile[((y + dy) << 8) | (x + dx)] = 200;
      }
    }
    const slot = slotFromId(
      w.people.spawn(x, y, 80, 0, 0, 0, 0, new Uint8Array(8), new Uint8Array(8), 0)
    );
    w.people.carryKind[slot] = CARRY_FOOD;
    w.people.carry[slot] = 15;
    w.people.hydration[slot] = w.config.thirstMax ?? 100;
    // Force dir === 4 (stay still) by keeping hunger below search and energy healthy; prevDir = 4
    w.people.prevDir[slot] = 4;

    const before = totalPileMass(w);
    w.step();
    expect(w.people.carryKind[slot]).toBe(CARRY_FOOD);
    expect(w.people.carry[slot]).toBeGreaterThan(0);
    expect(totalPileMass(w)).toBe(before);
  });
});

describe('Patch 3: donor controls sharing', () => {
  it('non-allied pair does not transfer when donor generosity is 100 and recipient generosity is 200', () => {
    const w = quietWorld({ resourceClashEnabled: false });
    const cell = findDryLandCell(w);
    const x = cell & 255;
    const y = cell >> 8;
    const donor = slotFromId(w.people.spawn(x, y, 90, 0, 1, 0, 0, new Uint8Array(8), new Uint8Array(8), 0));
    const recip = slotFromId(w.people.spawn(x, y, 20, 0, 2, 0, 0, new Uint8Array(8), new Uint8Array(8), 0));
    w.people.habits[donor * 8 + HABIT_GENEROSITY] = 100;
    w.people.habits[recip * 8 + HABIT_GENEROSITY] = 200;

    Rules.touch(donor, recip, w.people, w.land, w.fields, w.config, w.prng, w.ledger);
    expect(w.people.energy[donor]).toBe(90);
    expect(w.people.energy[recip]).toBe(20);
  });

  it('non-allied pair transfers when donor generosity is 200', () => {
    const w = quietWorld({ resourceClashEnabled: false });
    const cell = findDryLandCell(w);
    const x = cell & 255;
    const y = cell >> 8;
    const donor = slotFromId(w.people.spawn(x, y, 90, 0, 1, 0, 0, new Uint8Array(8), new Uint8Array(8), 0));
    const recip = slotFromId(w.people.spawn(x, y, 20, 0, 2, 0, 0, new Uint8Array(8), new Uint8Array(8), 0));
    w.people.habits[donor * 8 + HABIT_GENEROSITY] = 200;
    w.people.habits[recip * 8 + HABIT_GENEROSITY] = 50;

    Rules.touch(donor, recip, w.people, w.land, w.fields, w.config, w.prng, w.ledger);
    expect(w.people.energy[donor]).toBeLessThan(90);
    expect(w.people.energy[recip]).toBeGreaterThan(20);
  });

  it('allied pair transfers regardless of generosity', () => {
    const w = quietWorld({ resourceClashEnabled: false });
    const cell = findDryLandCell(w);
    const x = cell & 255;
    const y = cell >> 8;
    const donor = slotFromId(w.people.spawn(x, y, 90, 0, 1, 0, 0, new Uint8Array(8), new Uint8Array(8), 0));
    const recip = slotFromId(w.people.spawn(x, y, 20, 0, 1, 0, 0, new Uint8Array(8), new Uint8Array(8), 0));
    w.people.rootLeaderId[donor] = 1;
    w.people.rootLeaderId[recip] = 1;
    w.people.habits[donor * 8 + HABIT_GENEROSITY] = 0;
    w.people.habits[recip * 8 + HABIT_GENEROSITY] = 0;

    Rules.touch(donor, recip, w.people, w.land, w.fields, w.config, w.prng, w.ledger);
    expect(w.people.energy[donor]).toBeLessThan(90);
    expect(w.people.energy[recip]).toBeGreaterThan(20);
  });
});

describe('Patch 4: cargo drops when someone dies', () => {
  it('killWithCargo drops carried food onto the tile', () => {
    const w = quietWorld();
    const cell = findDryLandCell(w);
    const x = cell & 255;
    const y = cell >> 8;
    const slot = slotFromId(w.people.spawn(x, y, 50, 0, 1, 0, 0, new Uint8Array(8), new Uint8Array(8), 0));
    w.people.carryKind[slot] = CARRY_FOOD;
    w.people.carry[slot] = 12;
    const pileBefore = w.land.pile[cell];

    Rules.killWithCargo(slot, w.people, w.land, w.config);
    expect(w.people.alive[slot]).toBe(0);
    expect(w.land.pile[cell] - pileBefore).toBeCloseTo(12, 6);
  });

  it('old-age death during step drops carried food into a pile', () => {
    const w = quietWorld({ maxAge: 100 });
    const cell = findDryLandCell(w);
    const x = cell & 255;
    const y = cell >> 8;
    const slot = slotFromId(w.people.spawn(x, y, 50, 0, 1, 0, 0, new Uint8Array(8), new Uint8Array(8), 0));
    w.people.carryKind[slot] = CARRY_FOOD;
    w.people.carry[slot] = 12;
    w.people.age[slot] = 100;
    const pileBefore = totalPileMass(w);

    w.step();
    expect(w.people.alive[slot]).toBe(0);
    expect(totalPileMass(w)).toBeGreaterThan(pileBefore + 10);
  });
});

describe('Patch 6: inclusive nextInt fixes', () => {
  it('initCaves produces valid, unique caveCells in 0..65535 for seeds 1..50', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const land = new Land({ ...DEFAULT_CONFIG, seed });
      const seen = new Set<number>();
      for (const cell of land.caveCells) {
        expect(cell).toBeDefined();
        expect(Number.isInteger(cell)).toBe(true);
        expect(cell).toBeGreaterThanOrEqual(0);
        expect(cell).toBeLessThanOrEqual(65535);
        expect(seen.has(cell)).toBe(false);
        seen.add(cell);
      }
    }
  });

  it('copy start offset nextInt(0, side - 1) hits each offset with roughly equal frequency', () => {
    const side = 2 * 6 + 1; // 13
    const counts = new Int32Array(side);
    const prng = new PRNG(42);
    const draws = 10000;
    for (let i = 0; i < draws; i++) {
      const v = prng.nextInt(0, side - 1);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(side);
      counts[v]++;
    }
    const expected = draws / side;
    for (let k = 0; k < side; k++) {
      expect(counts[k]).toBeGreaterThan(expected * 0.75);
      expect(counts[k]).toBeLessThan(expected * 1.25);
    }
  });
});
