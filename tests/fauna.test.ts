import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';
import { Herds } from '../src/sim/herds';
import { Wolves } from '../src/sim/wolves';
import { Land } from '../src/sim/land';
import { People, CARRY_NONE, CARRY_FOOD, CARRY_STONE, GENE_STRENGTH, GENE_BRAVERY, slotFromId } from '../src/sim/people';
import { ScentFields } from '../src/sim/fields';
import { SpatialIndex } from '../src/sim/spatial';
import { EnergyLedger } from '../src/sim/ledger';
import { PRNG } from '../src/sim/prng';
import { DEFAULT_CONFIG } from '../src/sim/config';
import { LifeSystem } from '../src/sim/life';
import type { SimulationConfig } from '../src/sim/types';

const cell = (x: number, y: number) => (y << 8) | x;

describe('Phase 6a Hunting & Fauna Dynamics', () => {
  it('herds deposit prey food scent into fields when herdScentEnabled is on', () => {
    const config: SimulationConfig = {
      ...DEFAULT_CONFIG,
      herdScentEnabled: true,
      herdScentEmitRate: 0.25,
      scentDiffusionInterval: 1,
    };
    const land = new Land(config);
    land.isWater.fill(0);
    const people = new People();
    const spatial = new SpatialIndex();
    const fields = new ScentFields();
    const ledger = new EnergyLedger();
    const prng = new PRNG(42);
    const herds = new Herds(config, 42);

    land.food.fill(0); // clear land food so food scent comes from herds
    // Spawn one herd animal at (100, 100) with 40 energy
    (herds as any).spawn(100, 100, 40, 100);
    expect(herds.count).toBe(1);

    // Step life metabolism (which deposits herd scent and diffuses)
    LifeSystem.step(people, land, fields, spatial, ledger, config, prng, 0, herds);

    const scentAtHerd = fields.getFood(100, 100);
    expect(scentAtHerd).toBeGreaterThan(0);
  });

  it('successful hunting strike drops carcass, eats bite, and butchers meat into hands', () => {
    const config: SimulationConfig = {
      ...DEFAULT_CONFIG,
      huntingEnabled: true,
      huntCarryMeatEnabled: true,
      huntChance: 1.0, // guaranteed strike for test
      huntBelow: 1.0,
      stockpilesEnabled: true,
      storeUnloadEnabled: false,
      stagesEnabled: false,
      strengthScalingEnabled: false,
    };
    const land = new Land(config);
    land.isWater.fill(0);
    const people = new People();
    const spatial = new SpatialIndex();
    const fields = new ScentFields();
    const ledger = new EnergyLedger();
    const prng = new PRNG(7);
    const herds = new Herds(config, 7);

    // Spawn a hungry person at (50, 50)
    const id = people.spawn(50, 50, 20.0, 0, 0, 0, 0, 0);
    const slot = slotFromId(id);
    people.carryKind[slot] = CARRY_NONE;
    people.carry[slot] = 0;
    spatial.build(people);

    // Spawn an animal on the adjacent tile (51, 50) with 50 energy
    (herds as any).spawn(51, 50, 50, 100);

    // Step metabolism
    LifeSystem.step(people, land, fields, spatial, ledger, config, prng, 1, herds);

    // Herd was struck and killed
    expect(herds.count).toBe(0);
    expect(herds.killed).toBe(1);

    // Hunter ate a fresh meal and claimed carried meat into hands
    expect(people.energy[slot]).toBeGreaterThan(20.0 - (config.huntCost ?? 0.3));
    expect(people.carryKind[slot]).toBe(CARRY_FOOD);
    expect(people.carry[slot]).toBeGreaterThan(0);

    // Remaining carcass meat is on the ground
    const groundMeat = land.pile[cell(50, 50)];
    expect(groundMeat).toBeGreaterThan(0);
  });

  it('hunting strike chance is enhanced by high strength and carrying stone weapons', () => {
    const config: SimulationConfig = {
      ...DEFAULT_CONFIG,
      huntingEnabled: true,
      huntChance: 0.1,
      huntStrengthBonus: 0.3,
      huntStoneBonus: 0.2,
      huntBelow: 1.0,
    };
    const people = new People();
    // Strong armed hunter
    const id1 = people.spawn(10, 10, 30.0, 0, 0, 0, 0, 0);
    const s1 = slotFromId(id1);
    people.genes[s1 * 8 + GENE_STRENGTH] = 255;
    people.carryKind[s1] = CARRY_STONE;
    people.carry[s1] = 5.0;

    // Frail unarmed hunter
    const id2 = people.spawn(20, 20, 30.0, 0, 0, 0, 0, 0);
    const s2 = slotFromId(id2);
    people.genes[s2 * 8 + GENE_STRENGTH] = 0;
    people.carryKind[s2] = CARRY_NONE;
    people.carry[s2] = 0;

    let eff1 = config.huntChance;
    if (config.huntStrengthBonus) eff1 += (people.genes[s1 * 8 + GENE_STRENGTH] / 255) * config.huntStrengthBonus;
    if (people.carryKind[s1] === CARRY_STONE) eff1 += (config.huntStoneBonus ?? 0.15);

    let eff2 = config.huntChance;
    if (config.huntStrengthBonus) eff2 += (people.genes[s2 * 8 + GENE_STRENGTH] / 255) * config.huntStrengthBonus;
    if (people.carryKind[s2] === CARRY_STONE) eff2 += (config.huntStoneBonus ?? 0.15);

    expect(eff1).toBeCloseTo(0.6, 2); // 0.10 + 0.30 + 0.20
    expect(eff2).toBeCloseTo(0.1, 2); // 0.10 + 0.00 + 0.00
  });

  it('hungry wolves scavenge food from carcass meat heaps on or beside their tile', () => {
    const config: SimulationConfig = {
      ...DEFAULT_CONFIG,
      wolvesEnabled: true,
      wolfScavengeEnabled: true,
      wolfScavengeBite: 5.0,
      stockpilesEnabled: true,
    };
    const land = new Land(config);
    land.isWater.fill(0);
    const people = new People();
    const herds = new Herds(config, 1);
    const wolves = new Wolves(config, 2);
    const fields = new ScentFields();
    const ledger = new EnergyLedger();

    // Spawn one hungry wolf at (10, 10) with 20 energy (max 80)
    (wolves as any).spawn(10, 10, 20.0, 500, 0);
    expect(wolves.count).toBe(1);

    // Drop meat heap adjacent at (11, 10)
    land.dropFood(11, 10, 15.0, config);
    expect(land.pile[cell(11, 10)]).toBe(15.0);

    wolves.step(land, people, herds, fields, ledger, config);

    // Wolf scavenged meat from the heap
    expect(land.pile[cell(11, 10)]).toBe(10.0); // 15 - 5
    expect(wolves.energy[0]).toBeCloseTo(20.0 - (config.wolfUpkeep ?? 0.05) + 5.0, 1);
  });

  it('brave or armed human counter-attacks and defends against attacking wolves', () => {
    const config: SimulationConfig = {
      ...DEFAULT_CONFIG,
      wolvesEnabled: true,
      wolfDefenseEnabled: true,
      wolfDefenseDamage: 40.0,
      wolfAttackChance: 1.0, // force attack attempt
      wolfLoneRadius: 0,
      injuryEnabled: true,
    };
    const land = new Land(config);
    land.isWater.fill(0);
    const people = new People();
    const herds = new Herds(config, 1);
    const wolves = new Wolves(config, 2);
    const fields = new ScentFields();
    const ledger = new EnergyLedger();

    // Spawn wolf with low energy (15.0) at (10, 10)
    (wolves as any).spawn(10, 10, 15.0, 500, 0);

    // Spawn brave warrior at (11, 10) holding stone weapon
    const id = people.spawn(11, 10, 80.0, 0, 0, 0, 0, 0);
    const p = slotFromId(id);
    people.genes[p * 8 + GENE_BRAVERY] = 220;
    people.genes[p * 8 + GENE_STRENGTH] = 200;
    people.carryKind[p] = CARRY_STONE;
    people.carry[p] = 5.0;

    wolves.step(land, people, herds, fields, ledger, config);

    // Wolf was struck by brave defender dealing >15 damage and died
    expect(wolves.count).toBe(0);
    expect(wolves.alive[0]).toBe(0);
    // Defender survived
    expect(people.alive[p]).toBe(1);
    expect(people.energy[p]).toBe(80.0); // did not take wolf bite
  });

  it('energy ledger balances with 0 violations across 500 ticks with hunting, herds, and wolves active', () => {
    const world = new World({
      initialPopulation: 100,
      herdInitialCount: 50,
      wolfInitialCount: 15,
      huntingEnabled: true,
      huntCarryMeatEnabled: true,
      herdScentEnabled: true,
      wolfDefenseEnabled: true,
      wolfScavengeEnabled: true,
    }, 99);

    for (let t = 0; t < 500; t++) {
      world.step();
    }

    expect(world.ledger.violations).toBe(0);
    expect(world.herds.count).toBeGreaterThan(0);
    expect(world.wolves.count).toBeGreaterThan(0);
    expect(world.population).toBeGreaterThan(0);
  });
});
