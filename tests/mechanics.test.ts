import { describe, expect, it } from 'vitest';
import { World, type WorldState } from '../src/sim/world';
import { wrapDiff, distSqWrap } from '../src/sim/land';
import { slotFromId, genFromId } from '../src/sim/people';

describe('Phase 1 Invariants & Mechanics', () => {
  it('energy ledger balances with zero violations over 500 ticks', () => {
    const world = new World({ initialPopulation: 100 }, 42);
    for (let t = 0; t < 500; t++) {
      world.step();
    }

    const report = world.ledger.report();
    expect(report).not.toBeNull();
    expect(report!.started).toBe(true);
    expect(report!.violations).toBe(0);
    expect(report!.maxAbsResidual).toBeLessThan(0.01);
  });

  it('coordinates wrap strictly within 0..255 and wrapDiff handles edges', () => {
    expect(wrapDiff(0, 255)).toBe(1); // 255 -> 0 is +1 step
    expect(wrapDiff(255, 0)).toBe(-1); // 0 -> 255 is -1 step
    expect(wrapDiff(10, 250)).toBe(16); // 250 -> 10 across 256 is +16
    expect(distSqWrap(0, 0, 255, 255)).toBe(2); // 1^2 + 1^2

    const world = new World({ initialPopulation: 200 }, 123);
    for (let t = 0; t < 200; t++) {
      world.step();
      const cap = world.people.capacity;
      const alive = world.people.alive;
      const px = world.people.x;
      const py = world.people.y;
      for (let s = 0; s < cap; s++) {
        if (alive[s] === 1) {
          expect(px[s]).toBeGreaterThanOrEqual(0);
          expect(px[s]).toBeLessThan(256);
          expect(py[s]).toBeGreaterThanOrEqual(0);
          expect(py[s]).toBeLessThan(256);
        }
      }
    }
  });

  it('slot reuse increments generation bits and rejects stale IDs', () => {
    const world = new World({ initialPopulation: 10 }, 777);
    const people = world.people;

    // Spawn person and kill them
    const id1 = people.spawn(10, 10, 50, 0);
    const slot1 = slotFromId(id1);
    const gen1 = genFromId(id1);

    expect(people.isValidId(id1)).toBe(true);

    people.kill(slot1);
    expect(people.isValidId(id1)).toBe(false);

    // Next spawn should reuse slot1 with bumped generation
    const id2 = people.spawn(20, 20, 50, 1);
    const slot2 = slotFromId(id2);
    const gen2 = genFromId(id2);

    expect(slot2).toBe(slot1);
    expect(gen2).toBe((gen1 + 1) & 0xfff);
    expect(people.isValidId(id2)).toBe(true);
    expect(people.isValidId(id1)).toBe(false); // Stale ID must still be invalid!
  });

  it('save and restore round trip reproduces stateHash exactly', () => {
    const original = new World({ initialPopulation: 100 }, 888);
    for (let t = 0; t < 150; t++) {
      original.step();
    }

    const saved = JSON.parse(JSON.stringify(original.exportState())) as WorldState;
    const restored = World.fromState(saved);

    expect(restored.tick).toBe(original.tick);
    expect(restored.population).toBe(original.population);
    expect(restored.stateHash()).toBe(original.stateHash());

    // Advance both worlds further: they must remain in lockstep
    for (let t = 0; t < 100; t++) {
      original.step();
      restored.step();
    }

    expect(restored.stateHash()).toBe(original.stateHash());
    expect(restored.population).toBe(original.population);
  });
});
