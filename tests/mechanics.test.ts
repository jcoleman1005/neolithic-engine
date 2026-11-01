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

  it('same seed gives identical fingerprint across independent runs', () => {
    const w1 = new World({ initialPopulation: 150 }, 9999);
    const w2 = new World({ initialPopulation: 150 }, 9999);

    for (let t = 0; t < 200; t++) {
      w1.step();
      w2.step();
    }

    expect(w1.stateHash()).toBe(w2.stateHash());
    expect(w1.population).toBe(w2.population);
  });

  it('a woman fatherId is unchanged after mating and childbirth, and child receives mateId', () => {
    const world = new World({ initialPopulation: 0 }, 555);
    const people = world.people;

    // Woman with her own father ID 99999
    const womanId = people.spawn(100, 100, 80, 0, 1, 88888, 99999);
    const womanSlot = womanId >>> 12;
    people.age[womanSlot] = 6000; // adult

    // Eligible male
    const manId = people.spawn(100, 100, 80, 1, 1, 77777, 66666);
    const manSlot = manId >>> 12;
    people.age[manSlot] = 6000; // adult

    expect(people.fatherId[womanSlot]).toBe(99999);

    // Run until woman mates
    world.step();
    expect(people.pregnant[womanSlot]).toBeGreaterThanOrEqual(0);
    expect(people.mateId[womanSlot]).toBe(manId);
    expect(people.fatherId[womanSlot]).toBe(99999); // Must NOT be overwritten with manId!

    // Run through gestation to birth
    const initialCount = people.count;
    while (people.count === initialCount) {
      // Keep energy fed so birth succeeds
      people.energy[womanSlot] = 80;
      people.energy[manSlot] = 80;
      world.step();
    }

    // Woman's fatherId must still be her original father
    expect(people.fatherId[womanSlot]).toBe(99999);

    // Find newborn child
    let childSlot = -1;
    for (let s = 0; s < people.capacity; s++) {
      if (s !== womanSlot && s !== manSlot && people.alive[s] === 1) {
        childSlot = s;
        break;
      }
    }

    expect(childSlot).toBeGreaterThanOrEqual(0);
    expect(people.motherId[childSlot]).toBe(womanId);
    expect(people.fatherId[childSlot]).toBe(manId); // Child's father is the mother's mate!
  });

  it('stateHash changes when any living person array or land array changes', () => {
    const world = new World({ initialPopulation: 20 }, 321);
    const baseHash = world.stateHash();

    // Find a living person
    let slot = -1;
    for (let s = 0; s < world.people.capacity; s++) {
      if (world.people.alive[s] === 1) {
        slot = s;
        break;
      }
    }
    expect(slot).toBeGreaterThanOrEqual(0);

    // 1. Changing age changes hash
    world.people.age[slot] += 1;
    const hashAgeChanged = world.stateHash();
    expect(hashAgeChanged).not.toBe(baseHash);
    world.people.age[slot] -= 1;
    expect(world.stateHash()).toBe(baseHash);

    // 2. Changing fatherId changes hash
    world.people.fatherId[slot] += 100;
    const hashDadChanged = world.stateHash();
    expect(hashDadChanged).not.toBe(baseHash);
    world.people.fatherId[slot] -= 100;
    expect(world.stateHash()).toBe(baseHash);

    // 3. Changing pregnant changes hash
    world.people.pregnant[slot] = 10;
    const hashPregChanged = world.stateHash();
    expect(hashPregChanged).not.toBe(baseHash);
    world.people.pregnant[slot] = -1;
    expect(world.stateHash()).toBe(baseHash);

    // 4. Changing land plantFood changes hash
    world.land.food[0] += 0.5;
    const hashLandChanged = world.stateHash();
    expect(hashLandChanged).not.toBe(baseHash);
    world.land.food[0] -= 0.5;
    expect(world.stateHash()).toBe(baseHash);
  });

  it('runs past 5,000 people, saves through JSON round trip, restores, steps with matching stateHashes', () => {
    // Start with a healthy population past 5,000
    const worldA = new World({ seed: 777, initialPopulation: 5100 });
    worldA.step();
    expect(worldA.people.count).toBeGreaterThan(5000);
    expect(worldA.people.capacity).toBeGreaterThan(2048);

    // Save through a JSON round trip
    const exportedJson = JSON.stringify(worldA.exportState());
    const importedState = JSON.parse(exportedJson);
    const worldB = World.fromState(importedState);

    // State hashes must match immediately upon restoration
    expect(worldB.stateHash()).toBe(worldA.stateHash());
    expect(worldB.people.count).toBe(worldA.people.count);
    expect(worldB.people.capacity).toBe(worldA.people.capacity);

    // Step both for 500 ticks and assert stateHashes match periodically and at the end
    for (let tick = 0; tick < 500; tick++) {
      worldA.step();
      worldB.step();
      if (tick % 50 === 0 || tick === 499) {
        expect(worldB.stateHash(), `State hash mismatch at tick ${tick}`).toBe(worldA.stateHash());
      }
    }
  }, 30000);
});
