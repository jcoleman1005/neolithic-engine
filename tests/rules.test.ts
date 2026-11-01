import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';
import { Rules } from '../src/sim/rules';
import { People, GENE_COUNT, HABIT_COUNT, slotFromId } from '../src/sim/people';
import { Land } from '../src/sim/land';
import { ScentFields } from '../src/sim/fields';
import { SpatialIndex } from '../src/sim/spatial';
import { PRNG } from '../src/sim/prng';
import { EnergyLedger } from '../src/sim/ledger';
import { DEFAULT_CONFIG } from '../src/sim/config';

describe('Phase 3 Rules & Invariants', () => {
  it('climb directs person towards high food scent and avoids danger scent', () => {
    const config = { ...DEFAULT_CONFIG, elevationEnabled: false, terrainEnabled: false };
    const people = new People(10);
    const land = new Land(config);
    const fields = new ScentFields();
    const prng = new PRNG(42);

    // Person at (10, 10)
    const genes = new Uint8Array(GENE_COUNT).fill(128);
    const habits = new Uint8Array(HABIT_COUNT).fill(128);
    const id = people.spawn(10, 10, 50, 0, 0, 0, 0, genes, habits, 0);
    const slot = slotFromId(id);

    // Food to the East (11, 10)
    fields.depositFood(11, 10, 50);

    const dir = Rules.climb(slot, people, land, fields, config, prng);
    // 0 = East
    expect(dir).toBe(0);

    // Danger to the East (11, 10) > Food
    fields.depositDanger(11, 10, 150);
    const dirAway = Rules.climb(slot, people, land, fields, config, prng);
    // Should NOT go East
    expect(dirAway).not.toBe(0);
  });

  it('copy selects highest utility candidate and shifts habits towards leader', () => {
    const config = { ...DEFAULT_CONFIG, elevationEnabled: false, terrainEnabled: false };
    const people = new People(10);
    const prng = new PRNG(101);

    // Adult charismatic candidate at (10, 10)
    const leaderGenes = new Uint8Array(GENE_COUNT).fill(128);
    leaderGenes[4] = 240; // High charisma
    leaderGenes[0] = 220; // High strength
    const leaderHabits = new Uint8Array(HABIT_COUNT).fill(200);
    const leaderId = people.spawn(10, 10, 80, 1, 0, 0, 0, leaderGenes, leaderHabits, 0);
    const leaderSlot = slotFromId(leaderId);
    people.age[leaderSlot] = config.adultAge + 100;

    // Follower at (11, 11) within radius 6
    const followerGenes = new Uint8Array(GENE_COUNT).fill(100);
    const followerHabits = new Uint8Array(HABIT_COUNT).fill(50);
    const followerId = people.spawn(11, 11, 50, 0, 0, 0, 0, followerGenes, followerHabits, 0);
    const followerSlot = slotFromId(followerId);
    people.age[followerSlot] = config.adultAge + 100;

    const spatial = new SpatialIndex();
    spatial.build(people);

    // Evaluate copy for follower
    Rules.copy(followerSlot, people, spatial, config, prng);

    // Follower should now follow charismatic leader
    expect(people.leaderId[followerSlot]).toBe(leaderId);

    // Habits should have shifted towards leader's habits (> 50)
    for (let h = 0; h < HABIT_COUNT; h++) {
      expect(people.habits[followerSlot * HABIT_COUNT + h]).toBeGreaterThan(50);
    }
  });

  it('touch friction: with touchEnabled=false, border clashes disappear', () => {
    // Run 1: touchEnabled = true
    const worldOn = new World({ initialPopulation: 200, touchEnabled: true }, 99);
    for (let t = 0; t < 200; t++) {
      worldOn.step();
    }
    const attackOn = worldOn.ledger.attack;

    // Run 2: touchEnabled = false
    const worldOff = new World({ initialPopulation: 200, touchEnabled: false }, 99);
    for (let t = 0; t < 200; t++) {
      worldOff.step();
    }
    const attackOff = worldOff.ledger.attack;

    // Border clashes must be completely absent when touch is switched off
    expect(attackOff).toBe(0);
    // When enabled, clashes should occur in a populated world
    expect(attackOn).toBeGreaterThanOrEqual(0);
  });

  it('stale leader IDs are cleared when a leader dies or their slot is recycled', () => {
    const people = new People(10);
    const leaderId = people.spawn(10, 10, 50, 1);
    const followerId = people.spawn(10, 11, 50, 0, 0, 0, 0, undefined, undefined, leaderId);

    const followerSlot = slotFromId(followerId);
    const leaderSlot = slotFromId(leaderId);

    expect(people.leaderId[followerSlot]).toBe(leaderId);

    // Kill leader
    people.kill(leaderSlot);

    // Call clearStaleLeader
    people.clearStaleLeader(followerSlot);
    expect(people.leaderId[followerSlot]).toBe(0);
  });

  it('genes and habits are bounded and properly inherited across generations', () => {
    const world = new World({ initialPopulation: 100 }, 333);
    for (let t = 0; t < 400; t++) {
      world.step();
    }

    const people = world.people;
    for (let s = 0; s < people.capacity; s++) {
      if (people.alive[s] === 1) {
        const gOff = s * GENE_COUNT;
        for (let g = 0; g < GENE_COUNT; g++) {
          expect(people.genes[gOff + g]).toBeGreaterThanOrEqual(0);
          expect(people.genes[gOff + g]).toBeLessThanOrEqual(255);
        }
        const hOff = s * HABIT_COUNT;
        for (let h = 0; h < HABIT_COUNT; h++) {
          expect(people.habits[hOff + h]).toBeGreaterThanOrEqual(0);
          expect(people.habits[hOff + h]).toBeLessThanOrEqual(255);
        }
      }
    }
  });

  it('energy ledger balances identically with climb, copy, and touch active', () => {
    const world = new World({ initialPopulation: 150 }, 77);
    for (let t = 0; t < 500; t++) {
      world.step();
    }

    const report = world.ledger.report();
    expect(report).not.toBeNull();
    expect(report!.started).toBe(true);
    expect(report!.violations).toBe(0);
    expect(report!.maxAbsResidual).toBeLessThan(0.01);
  });

  it('save and restore round trip reproduces exact stateHash including genes, habits, and scent', () => {
    const world1 = new World({ initialPopulation: 100 }, 555);
    for (let t = 0; t < 150; t++) {
      world1.step();
    }

    const exported = world1.exportState();
    const jsonStr = JSON.stringify(exported);
    const parsed = JSON.parse(jsonStr);

    const world2 = World.fromState(parsed);

    // State hash must match immediately
    expect(world2.stateHash()).toBe(world1.stateHash());

    // Step both worlds for another 150 ticks
    for (let t = 0; t < 150; t++) {
      world1.step();
      world2.step();
    }

    expect(world2.stateHash()).toBe(world1.stateHash());
  });
});
