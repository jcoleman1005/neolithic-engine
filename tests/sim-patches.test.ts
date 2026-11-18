import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';
import {
  CARRY_EARTH,
  CARRY_FOOD,
  CARRY_WATER,
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
