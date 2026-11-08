import { describe, it, expect } from 'vitest';
import { World } from '../src/sim/world';
import { Rules } from '../src/sim/rules';
import { People, GENE_STRENGTH, GENE_BRAVERY, GENE_COUNT, HABIT_BELLIGERENCE, HABIT_COUNT, CARRY_NONE, CARRY_FOOD, CARRY_STONE, CARRY_BRUSH } from '../src/sim/people';
import { Land } from '../src/sim/land';
import { ScentFields } from '../src/sim/fields';
import { SpatialIndex } from '../src/sim/spatial';
import { EnergyLedger } from '../src/sim/ledger';
import { PRNG } from '../src/sim/prng';
import { DEFAULT_CONFIG } from '../src/sim/config';

describe('Phase 7 Foundations: Combat, Courage & Looting (Primitives 76 & 78)', () => {
  it('Primitive 78 (Loot): victor with empty hands claims loser carried food and clears loser hands', () => {
    const config = { ...DEFAULT_CONFIG, elevationEnabled: false, terrainEnabled: false, cultureTouchEnabled: false };
    const people = new People(10);
    const land = new Land(config);
    const fields = new ScentFields();
    const spatial = new SpatialIndex();
    const ledger = new EnergyLedger();
    const prng = new PRNG(42);

    // Spawn strong victor A and weaker loser B at (50, 50)
    const idA = people.spawn(50, 50, 80.0, 0, 1, 0, 0);
    const idB = people.spawn(50, 50, 40.0, 0, 1, 0, 0);
    const slotA = idA >>> 12;
    const slotB = idB >>> 12;

    // A has high strength and belligerence to ensure victory
    people.genes[slotA * GENE_COUNT + GENE_STRENGTH] = 250;
    people.genes[slotA * GENE_COUNT + GENE_BRAVERY] = 200;
    people.habits[slotA * HABIT_COUNT + HABIT_BELLIGERENCE] = 240;

    // B has lower strength, high bravery so they stand and fight, and carries 10 units of food
    people.genes[slotB * GENE_COUNT + GENE_STRENGTH] = 30;
    people.genes[slotB * GENE_COUNT + GENE_BRAVERY] = 240;
    people.habits[slotB * HABIT_COUNT + HABIT_BELLIGERENCE] = 240;
    people.carryKind[slotB] = CARRY_FOOD;
    people.carry[slotB] = 10.0;

    spatial.build(people);

    const cell = (50 << 8) | 50;
    const initialLandPile = land.pile[cell];

    Rules.touch(slotA, slotB, people, land, fields, spatial, ledger, config, prng);

    // A won: should now carry the 10 units of food
    expect(people.carryKind[slotA]).toBe(CARRY_FOOD);
    expect(people.carry[slotA]).toBeCloseTo(10.0, 1);

    // B lost: carried item cleared
    expect(people.carryKind[slotB]).toBe(CARRY_NONE);
    expect(people.carry[slotB]).toBe(0);

    // Total food conserved (none lost or duplicated)
    expect(people.carry[slotA] + people.carry[slotB] + (land.pile[cell] - initialLandPile)).toBeCloseTo(10.0, 1);
  });

  it('Primitive 78 (Loot): victor with full hands of different material knocks loser loot onto ground', () => {
    const config = { ...DEFAULT_CONFIG, elevationEnabled: false, terrainEnabled: false, cultureTouchEnabled: false };
    const people = new People(10);
    const land = new Land(config);
    const fields = new ScentFields();
    const spatial = new SpatialIndex();
    const ledger = new EnergyLedger();
    const prng = new PRNG(42);

    const idA = people.spawn(50, 50, 80.0, 0, 1, 0, 0);
    const idB = people.spawn(50, 50, 40.0, 0, 1, 0, 0);
    const slotA = idA >>> 12;
    const slotB = idB >>> 12;

    people.genes[slotA * GENE_COUNT + GENE_STRENGTH] = 250;
    people.habits[slotA * HABIT_COUNT + HABIT_BELLIGERENCE] = 240;
    people.carryKind[slotA] = CARRY_STONE;
    people.carry[slotA] = 3.0;

    people.genes[slotB * GENE_COUNT + GENE_STRENGTH] = 30;
    people.genes[slotB * GENE_COUNT + GENE_BRAVERY] = 240;
    people.habits[slotB * HABIT_COUNT + HABIT_BELLIGERENCE] = 240;
    people.carryKind[slotB] = CARRY_FOOD;
    people.carry[slotB] = 8.0;

    spatial.build(people);

    const cell = (50 << 8) | 50;
    const initialLandPile = land.pile[cell];

    Rules.touch(slotA, slotB, people, land, fields, spatial, ledger, config, prng);

    // A retains their carried stone
    expect(people.carryKind[slotA]).toBe(CARRY_STONE);
    expect(people.carry[slotA]).toBe(3.0);

    // B had food knocked loose onto the tile
    expect(people.carryKind[slotB]).toBe(CARRY_NONE);
    expect(people.carry[slotB]).toBe(0);
    expect(land.pile[cell] - initialLandPile).toBeCloseTo(8.0, 1);
  });

  it('Primitive 76 (Courage): outmatched coward retreats before combat with realistic physical costs and cargo panic drop', () => {
    const config = { ...DEFAULT_CONFIG, elevationEnabled: false, terrainEnabled: false, cultureTouchEnabled: false };
    const people = new People(10);
    const land = new Land(config);
    const fields = new ScentFields();
    const spatial = new SpatialIndex();
    const ledger = new EnergyLedger();
    const prng = new PRNG(10);

    // Fighter A: Outnumbered, zero bravery (pure coward), carries heavy food cargo (5.0 units > threshold 3.0)
    const idA = people.spawn(60, 60, 50.0, 0, 1, 0, 0);
    const slotA = idA >>> 12;
    people.genes[slotA * GENE_COUNT + GENE_STRENGTH] = 20;
    people.genes[slotA * GENE_COUNT + GENE_BRAVERY] = 0; // zero courage
    people.habits[slotA * HABIT_COUNT + HABIT_BELLIGERENCE] = 240;
    people.carryKind[slotA] = CARRY_FOOD;
    people.carry[slotA] = 5.0;

    // Fighter B: Strong with high strength
    const idB = people.spawn(60, 60, 80.0, 0, 1, 0, 0);
    const slotB = idB >>> 12;
    people.genes[slotB * GENE_COUNT + GENE_STRENGTH] = 240;
    people.genes[slotB * GENE_COUNT + GENE_BRAVERY] = 200;
    people.habits[slotB * HABIT_COUNT + HABIT_BELLIGERENCE] = 240;

    // Give B 2 adjacent allies at (60, 61) to heavily skew the odds against A
    const ally1 = people.spawn(60, 61, 80.0, 0, 1, 0, 0);
    const ally2 = people.spawn(60, 61, 80.0, 0, 1, 0, 0);
    people.leaderId[ally1 >>> 12] = idB;
    people.leaderId[ally2 >>> 12] = idB;
    people.rootLeaderId[slotB] = idB;
    people.rootLeaderId[ally1 >>> 12] = idB;
    people.rootLeaderId[ally2 >>> 12] = idB;

    spatial.build(people);

    const initialEnergyA = people.energy[slotA];
    const initialInjuryA = people.injury[slotA];
    const initialFatigueA = people.fatigue[slotA];

    Rules.touch(slotA, slotB, people, land, fields, spatial, ledger, config, prng);

    // Coward A should have retreated rather than fighting
    // 1. Move cost paid (1.5x standard moveCost)
    const expectedMoveCost = (config.moveCost ?? 0.05) * (config.clashRetreatMoveMul ?? 1.5);
    expect(people.energy[slotA]).toBeCloseTo(initialEnergyA - expectedMoveCost, 4);
    expect(ledger.move).toBeCloseTo(expectedMoveCost, 4);

    // 2. Minor scrape injury from parting swipe (much less than full clashInjury of 60)
    expect(people.injury[slotA]).toBeGreaterThan(initialInjuryA);
    expect(people.injury[slotA]).toBeLessThan(25);

    // 3. Fatigue spike from sprint
    expect(people.fatigue[slotA]).toBe(initialFatigueA + (config.clashRetreatFatigue ?? 6));

    // 4. Panic cargo drop: 5.0 units dropped onto land tile
    expect(people.carryKind[slotA]).toBe(CARRY_NONE);
    expect(people.carry[slotA]).toBe(0);
    expect(land.pile[(60 << 8) | 60]).toBeCloseTo(5.0, 1);

    // Danger scent deposited
    expect(fields.dangerCurrent[(60 << 8) | 60]).toBeGreaterThan(0);
  });

  it('Primitive 76 (Courage): brave fighter stands and clashes even when odds are poor', () => {
    const config = { ...DEFAULT_CONFIG, elevationEnabled: false, terrainEnabled: false, cultureTouchEnabled: false };
    const people = new People(10);
    const land = new Land(config);
    const fields = new ScentFields();
    const spatial = new SpatialIndex();
    const ledger = new EnergyLedger();
    const prng = new PRNG(10);

    // Fighter A: Outnumbered but maximum bravery (fearless)
    const idA = people.spawn(60, 60, 50.0, 0, 1, 0, 0);
    const slotA = idA >>> 12;
    people.genes[slotA * GENE_COUNT + GENE_STRENGTH] = 20;
    people.genes[slotA * GENE_COUNT + GENE_BRAVERY] = 255; // fearless
    people.habits[slotA * HABIT_COUNT + HABIT_BELLIGERENCE] = 240;

    const idB = people.spawn(60, 60, 80.0, 0, 1, 0, 0);
    const slotB = idB >>> 12;
    people.genes[slotB * GENE_COUNT + GENE_STRENGTH] = 240;
    people.genes[slotB * GENE_COUNT + GENE_BRAVERY] = 200;
    people.habits[slotB * HABIT_COUNT + HABIT_BELLIGERENCE] = 240;

    spatial.build(people);

    const initialEnergyA = people.energy[slotA];

    Rules.touch(slotA, slotB, people, land, fields, spatial, ledger, config, prng);

    // Fearless A stood their ground and engaged in combat, losing energy
    expect(people.energy[slotA]).toBeLessThan(initialEnergyA);
  });

  it('Off-switch parity: exact fingerprint match when clash loot and courage are switched off', async () => {
    const wOff = new World({
      jitterEnabled: false,
      clashLootEnabled: false,
      clashCourageEnabled: false,
      tendingEnabled: false,
      herdScentEnabled: false,
      huntCarryMeatEnabled: false,
      huntScalingEnabled: false,
      wolfDefenseEnabled: false,
      wolfScavengeEnabled: false,
      wolfScentTrackEnabled: false,
      wolfInitialCount: 20,
      wolfUpkeep: 0.06,
      wolfBreedEnergy: 50.0,
      wolfBirthEnergy: 20.0,
      wolfBreedChance: 0.02,
      wolfSoftCap: 40,
      wolfSenseRadius: 8,
    }, 42);

    for (let t = 1; t <= 1000; t++) {
      wOff.step();
      if (t % 100 === 0) await new Promise(r => setImmediate(r));
    }
    // Baseline fingerprint before Phase 7 foundations on this branch (updated for hillside cave fix)
    expect(wOff.stateHash()).toBe('4f7eab55d5e2a971');
  }, 120000);

  it('Energy ledger balances with zero violations over 300 ticks with looting & courage active', () => {
    const world = new World({
      clashLootEnabled: true,
      clashCourageEnabled: true,
    }, 42);

    for (let t = 1; t <= 300; t++) {
      world.step();
      expect(world.ledger.violations).toBe(0);
    }
  });
});
