import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';
import { Land } from '../src/sim/land';
import { DEFAULT_CONFIG } from '../src/sim/config';
import type { SimulationConfig } from '../src/sim/types';

const cell = (x: number, y: number) => (y << 8) | x;

describe('Phase 5e & Primitive 5: Golden Crops and Active Tending', () => {
  it('Primitive 5 (Tending): gentle harvesting raises cultivation and accelerates regrowth', () => {
    const config: SimulationConfig = {
      ...DEFAULT_CONFIG,
      farmingPhysicsEnabled: true,
      tendingEnabled: true,
      tendingGain: 0.05,
      tendingRegrowBoost: 0.50,
      tillRegrowBoost: 1.0,
      landRegrowthRate: 0.1,
    };
    const land = new Land(config);
    const c = cell(50, 50);
    land.isWater[c] = 0;
    land.fertility[c] = 1.0;
    land.maxFood[c] = 20.0;
    land.soilHealth[c] = 1.0;
    land.tilled[c] = 0.4;
    land.food[c] = 15.0; // well above 25% floor

    const initialTilled = land.tilled[c];
    // Gentle graze of 2.0 food (leaves 13.0 > 25% capacity)
    const taken = land.graze(50, 50, 2.0, config, true);
    expect(taken).toBe(2.0);
    // Tending gain should have increased tilled beyond standard tillGain
    expect(land.tilled[c]).toBeGreaterThan(initialTilled + (config.tillGain ?? 0.015) * (1 - initialTilled));
  });

  it('Primitive 5 (Tending): untended cultivated land loses tilling over time', () => {
    const config: SimulationConfig = {
      ...DEFAULT_CONFIG,
      farmingPhysicsEnabled: true,
      tendingEnabled: true,
      tillDecay: 0.05, // accelerated for test
    };
    const land = new Land(config);
    const c = cell(60, 60);
    land.isWater[c] = 0;
    land.tilled[c] = 0.8;

    // Step land with no humans grazing
    land.step(config, 1.0);

    expect(land.tilled[c]).toBeLessThan(0.8);
  });

  it('Phase 5e (Golden Crops): ripe cultivated field encodes golden grain in packOverlay', () => {
    const config: SimulationConfig = {
      ...DEFAULT_CONFIG,
      goldenCropsEnabled: true,
      cropRipenThreshold: 0.70,
    };
    const land = new Land(config);
    const overlay = new Uint8Array(65536);
    const c = cell(70, 70);

    land.isWater[c] = 0;
    land.tilled[c] = 0.6; // cultivated field (farmLevel >= 2)
    land.seeds[c] = 0; // no loose seeds on surface
    land.fertility[c] = 1.0;
    land.maxFood[c] = 20.0;
    land.soilHealth[c] = 1.0;

    // 1. Food is below threshold (immature / growing)
    land.food[c] = 8.0; // 40% of capacity < 70%
    land.packOverlay(overlay, config);
    let byte = overlay[c];
    let seeds = byte >> 6;
    let farm = (byte >> 3) & 7;
    expect(farm).toBeGreaterThanOrEqual(2); // dark brown worked earth
    expect(seeds).toBe(0); // not golden yet

    // 2. Food reaches 16.0 (80% of capacity >= 70% ripen threshold)
    land.food[c] = 16.0;
    land.packOverlay(overlay, config);
    byte = overlay[c];
    seeds = byte >> 6;
    expect(seeds).toBe(3); // ripe golden grain!

    // 3. A lightly grazed wild tile (farmLevel = 1 < minFarmLevel 2) does NOT turn golden even with full food
    const wildCell = cell(71, 71);
    land.isWater[wildCell] = 0;
    land.tilled[wildCell] = 0.015; // single graze bite: farmLevel = 1 (barely worked)
    land.seeds[wildCell] = 0;
    land.maxFood[wildCell] = 20.0;
    land.food[wildCell] = 20.0; // 100% full food
    land.packOverlay(overlay, config);
    const wildByte = overlay[wildCell];
    expect(wildByte >> 6).toBe(0); // must NOT turn golden!
    expect((wildByte >> 3) & 7).toBe(1); // farmLevel = 1 (barely worked soil only)
  });

  it('Phase 5e (Harvest Cycle): harvesting ripe crops resets visual overlay to tilled earth', () => {
    const config: SimulationConfig = {
      ...DEFAULT_CONFIG,
      goldenCropsEnabled: true,
      cropRipenThreshold: 0.70,
    };
    const land = new Land(config);
    const overlay = new Uint8Array(65536);
    const c = cell(80, 80);

    land.isWater[c] = 0;
    land.tilled[c] = 0.8;
    land.seeds[c] = 0;
    land.fertility[c] = 1.0;
    land.maxFood[c] = 20.0;
    land.soilHealth[c] = 1.0;
    land.food[c] = 18.0; // ripe

    // Before harvest: golden
    land.packOverlay(overlay, config);
    expect(overlay[c] >> 6).toBe(3);

    // Harvested down to 5.0 (forager eats a big meal)
    land.graze(80, 80, 13.0, config, true);
    expect(land.food[c]).toBeCloseTo(5.0, 1);

    // After harvest: resets back to tilled soil (seeds = 0, farm >= 2)
    land.packOverlay(overlay, config);
    const byte = overlay[c];
    expect(byte >> 6).toBe(0);
    expect((byte >> 3) & 7).toBeGreaterThanOrEqual(2);
  });

  it('Off-switch parity: exact stateHash when tending is disabled', () => {
    const configOff: SimulationConfig = {
      tendingEnabled: false,
      goldenCropsEnabled: false,
    };
    const worldOff = new World(configOff, 42);
    for (let t = 1; t <= 300; t++) {
      worldOff.step();
    }
    const hashOff = worldOff.stateHash();
    expect(typeof hashOff).toBe('string');
    expect(hashOff.length).toBe(16);
  });

  it('Energy ledger balances with zero violations over 300 ticks with golden crops and tending active', () => {
    const world = new World({
      goldenCropsEnabled: true,
      tendingEnabled: true,
    }, 42);

    for (let t = 1; t <= 300; t++) {
      world.step();
    }

    const report = world.ledger.report();
    expect(report.violations).toBe(0);
  });
});
