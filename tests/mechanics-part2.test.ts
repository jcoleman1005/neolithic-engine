import { describe, expect, it } from 'vitest';
import { World, type WorldState } from '../src/sim/world';
import { wrapDiff, distSqWrap } from '../src/sim/land';
import { slotFromId, genFromId } from '../src/sim/people';

// Split from mechanics.test.ts: vitest's worker RPC times out when one file runs longer than 60 s under load.
describe('Phase 1 Invariants & Mechanics (part 2)', () => {
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

  it('runs past 5,000 people, saves through JSON round trip, restores, steps with matching stateHashes', async () => {
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

    // Step both for 250 ticks and assert stateHashes match periodically and at the end
    for (let tick = 0; tick < 250; tick++) {
      worldA.step();
      worldB.step();
      if (tick % 25 === 0) {
        await new Promise(r => setImmediate(r));
      }
      if (tick % 50 === 0 || tick === 249) {
        expect(worldB.stateHash(), `State hash mismatch at tick ${tick}`).toBe(worldA.stateHash());
      }
    }
  });
});
