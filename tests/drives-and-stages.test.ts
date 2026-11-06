import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';
import { Rules } from '../src/sim/rules';
import { ScentFields } from '../src/sim/fields';
import { Land } from '../src/sim/land';
import { People } from '../src/sim/people';
import { PRNG } from '../src/sim/prng';
import { DEFAULT_CONFIG } from '../src/sim/config';

describe('Primitives 18, 24, 28: Drives, Life Stages & Strength Scaling', () => {
  it('energy ledger balances with zero violations over 300 ticks with drives and stages active', () => {
    const world = new World({ initialPopulation: 120 }, 42);
    for (let t = 0; t < 300; t++) {
      world.step();
    }
    expect(world.ledger.violations).toBe(0);
  });

  describe('Primitive 18: Hunger drive', () => {
    it('hungry person prioritizes food gradient over leader pull', () => {
      const config = { ...DEFAULT_CONFIG, bodyDrivesEnabled: true, calmMovementEnabled: false };
      const people = new People(10);
      const land = new Land(config);
      const fields = new ScentFields();
      const prng = new PRNG(1);

      // Follower at (100, 100) with energy 20 (below hunger threshold of 35)
      const fId = people.spawn(100, 100, 20.0, 0, 1, 0, 0);
      const fSlot = fId >>> 12;

      // Leader at (100, 110) -> South of follower
      const lId = people.spawn(100, 110, 80.0, 0, 1, 0, 0);
      people.leaderId[fSlot] = lId;

      // Moderate food gradient to the West
      fields.foodCurrent[100 * 256 + 99] = 0.5;

      // When hungry with drivesOn, food gradient West (1) beats dampened leader pull South (2)
      const dirDrivesOn = Rules.climb(fSlot, people, land, fields, config, prng);
      expect(dirDrivesOn).toBe(1); // West toward food

      // With drives disabled, leader pull South (2) beats food gradient West (1)
      const configOff = { ...DEFAULT_CONFIG, bodyDrivesEnabled: false, calmMovementEnabled: false };
      const prngOff = new PRNG(1);
      const dirDrivesOff = Rules.climb(fSlot, people, land, fields, configOff, prngOff);
      expect(dirDrivesOff).toBe(2); // South toward leader
    });

    it('well-fed person follows leader instead of moderate food scent', () => {
      const config = { ...DEFAULT_CONFIG, bodyDrivesEnabled: true, calmMovementEnabled: false };
      const people = new People(10);
      const land = new Land(config);
      const fields = new ScentFields();
      const prng = new PRNG(1);

      // Follower at (100, 100) with high energy (80.0)
      const fId = people.spawn(100, 100, 80.0, 0, 1, 0, 0);
      const fSlot = fId >>> 12;

      // Leader at (100, 110) -> South
      const lId = people.spawn(100, 110, 80.0, 0, 1, 0, 0);
      people.leaderId[fSlot] = lId;

      // Moderate food scent to the West
      fields.foodCurrent[100 * 256 + 99] = 0.5;

      const dir = Rules.climb(fSlot, people, land, fields, config, prng);
      expect(dir).toBe(2); // South toward leader
    });
  });

  describe('Primitive 24: Life stages', () => {
    it('children pay lower upkeep than adults due to smaller body mass', () => {
      const wChild = new World({ initialPopulation: 0, stagesEnabled: true, coldEnabled: false, childUpkeepMul: 0.7 }, 10);
      const cId = wChild.people.spawn(50, 50, 80.0, 0, 1, 0, 0);
      const cSlot = cId >>> 12;
      wChild.people.age[cSlot] = 500; // child

      const uChildBefore = wChild.ledger.upkeep;
      wChild.step();
      const uChildPaid = wChild.ledger.upkeep - uChildBefore;

      const wAdult = new World({ initialPopulation: 0, stagesEnabled: true, coldEnabled: false, childUpkeepMul: 0.7 }, 10);
      const aId = wAdult.people.spawn(50, 50, 80.0, 0, 1, 0, 0);
      const aSlot = aId >>> 12;
      wAdult.people.age[aSlot] = 7000; // adult

      const uAdultBefore = wAdult.ledger.upkeep;
      wAdult.step();
      const uAdultPaid = wAdult.ledger.upkeep - uAdultBefore;

      expect(uChildPaid).toBeCloseTo(uAdultPaid * 0.7, 3);
      expect(uChildPaid).toBeLessThan(uAdultPaid);
    });

    it('with stagesEnabled off, children pay normal full upkeep', () => {
      const wOff = new World({ initialPopulation: 0, stagesEnabled: false, coldEnabled: false }, 10);
      const cId = wOff.people.spawn(50, 50, 80.0, 0, 1, 0, 0);
      const cSlot = cId >>> 12;
      wOff.people.age[cSlot] = 500;

      const uBefore = wOff.ledger.upkeep;
      wOff.step();
      const uPaid = wOff.ledger.upkeep - uBefore;

      const wAdult = new World({ initialPopulation: 0, stagesEnabled: false, coldEnabled: false }, 10);
      const aId = wAdult.people.spawn(50, 50, 80.0, 0, 1, 0, 0);
      const aSlot = aId >>> 12;
      wAdult.people.age[aSlot] = 7000;

      const uAdultBefore = wAdult.ledger.upkeep;
      wAdult.step();
      const uAdultPaid = wAdult.ledger.upkeep - uAdultBefore;

      expect(uPaid).toBeCloseTo(uAdultPaid, 3);
    });
  });

  describe('Primitive 28: Strength gene & work scaling', () => {
    it('stronger people tamp heaps faster than weaker people', () => {
      const config = { ...DEFAULT_CONFIG, stockpilesEnabled: true, workStrengthScale: true, workGain: 0.04 };
      const land = new Land(config);
      const x = 50, y = 50;

      // Strong worker (strength 255 -> bodyMul 1 + 0.6 * 0.5 = 1.3)
      const strongWork = 1 + config.strengthCarry * (255 / 255 - 0.5);
      land.tamp(x, y, config, strongWork);
      const compStrong = land.compaction[(y << 8) | x];

      // Weak worker (strength 0 -> bodyMul 1 + 0.6 * -0.5 = 0.7)
      const x2 = 51, y2 = 50;
      const weakWork = 1 + config.strengthCarry * (0 / 255 - 0.5);
      land.tamp(x2, y2, config, weakWork);
      const compWeak = land.compaction[(y2 << 8) | x2];

      expect(compStrong).toBeGreaterThan(compWeak);
    });
  });

  describe('Determinism & Off-switch fingerprint parity', () => {
    it('produces the exact baseline fingerprint when new mechanics are switched off to match baseline', () => {
      const wOff = new World({
        bodyDrivesEnabled: false,
        childUpkeepMul: 1.0,
        elderUpkeepMul: 1.0,
        stageHarvestScale: false,
        workStrengthScale: false,
        // Later mechanics (S1, docs/SETTLEMENTS.md) are off too, so this still pins the pre-drives baseline.
        stayValueEnabled: false,
        comfortableStayEnabled: false,
        tileCrowdingEnabled: false,
        storeScentEnabled: false,
        storeUnloadEnabled: false,
        shelterSeekEnabled: false,
        fireDetersWolvesEnabled: false,
        wolfLoneRadius: 0,
        pathsEnabled: false,
        earthBuildingEnabled: false,
        waterCarryEnabled: false,
        adjacentStoresEnabled: false,
        hungerSearchEnabled: false,
        farSightEnabled: false,
      }, 42);

      for (let t = 1; t <= 1000; t++) {
        wOff.step();
      }
      expect(wOff.stateHash()).toBe('b11b505bedb2a659');
    });
  });
});
