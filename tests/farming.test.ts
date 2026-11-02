import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';
import { Land } from '../src/sim/land';
import { DEFAULT_CONFIG } from '../src/sim/config';

const cfg = { ...DEFAULT_CONFIG, elevationEnabled: false, terrainEnabled: false };
const cell = (x: number, y: number) => (y << 8) | x;

describe('Phase 5b farming physics', () => {
  it('grazing tills a cell and the tilling fades when it is left alone', () => {
    const land = new Land(cfg);
    const i = cell(5, 5);
    for (let k = 0; k < 30; k++) {
      land.food[i] = land.maxFood[i];
      land.graze(5, 5, 1, cfg);
    }
    const worked = land.tilled[i];
    expect(worked).toBeGreaterThan(0.2);
    expect(worked).toBeLessThanOrEqual(1);
    for (let k = 0; k < 2000; k++) land.step(cfg);
    expect(land.tilled[i]).toBeLessThan(worked * 0.3);
  });

  it('worked soil and seeds both make a cell regrow faster', () => {
    const land = new Land(cfg);
    const a = cell(10, 10), b = cell(12, 10), c = cell(14, 10);
    for (const i of [a, b, c]) { land.maxFood[i] = 20; land.food[i] = 2; land.fertility[i] = 1; }
    land.tilled[b] = 1;
    land.seeds[c] = cfg.seedCap;
    for (let k = 0; k < 40; k++) land.step({ ...cfg, tillDecay: 0, seedDecay: 0 });
    expect(land.food[b]).toBeGreaterThan(land.food[a]);
    expect(land.food[c]).toBeGreaterThan(land.food[a]);
  });

  it('stripping a cell wears the soil, never below the minimum, and it recovers when left alone', () => {
    const land = new Land(cfg);
    const i = cell(20, 20);
    land.maxFood[i] = 20; // rich enough that a stripped cell stays "stripped" down to the minimum
    for (let k = 0; k < 2000; k++) {
      land.food[i] = 1.05; // just above the grazing floor: stripped every time
      land.graze(20, 20, 1, cfg);
    }
    expect(land.soilHealth[i]).toBeCloseTo(cfg.soilMin, 5);
    expect(land.soilHealth[i]).toBeGreaterThanOrEqual(cfg.soilMin);
    const worn = land.soilHealth[i];
    for (let k = 0; k < 6000; k++) land.step(cfg);
    expect(land.soilHealth[i]).toBeGreaterThan(worn);
    expect(land.soilHealth[i]).toBeLessThanOrEqual(1);
  });

  it('seeds are capped, decay and are not placed on water', () => {
    const land = new Land(cfg);
    const i = cell(30, 30);
    land.dropSeeds(30, 30, 100, cfg);
    expect(land.seeds[i]).toBe(cfg.seedCap);
    land.step(cfg);
    expect(land.seeds[i]).toBeLessThan(cfg.seedCap);
    const wet = cell(40, 40);
    land.isWater[wet] = 1;
    land.dropSeeds(40, 40, 5, cfg);
    expect(land.seeds[wet]).toBe(0);
  });

  it('farming state survives a save round trip and the run continues identically', () => {
    const a = new World({ initialPopulation: 120 }, 9);
    for (let t = 0; t < 400; t++) a.step();
    const b = World.fromState(JSON.parse(JSON.stringify(a.exportState())));
    expect(b.stateHash()).toBe(a.stateHash());
    for (let t = 0; t < 100; t++) { a.step(); b.step(); }
    expect(b.stateHash()).toBe(a.stateHash());
  });

  it('with farming physics off, no land arrays change and carry stays zero', () => {
    const w = new World({ initialPopulation: 120, farmingPhysicsEnabled: false }, 4);
    for (let t = 0; t < 300; t++) w.step();
    expect(w.land.tilled.every((v) => v === 0)).toBe(true);
    expect(w.land.seeds.every((v) => v === 0)).toBe(true);
    expect(w.land.soilHealth.every((v) => v === 1)).toBe(true);
    expect(w.people.carry.every((v) => v === 0)).toBe(true);
  });

  it('values stay in range and energy still balances with farming physics on', () => {
    const w = new World({ initialPopulation: 200 }, 5);
    for (let t = 0; t < 600; t++) w.step();
    for (let i = 0; i < 65536; i++) {
      expect(w.land.tilled[i]).toBeGreaterThanOrEqual(0);
      expect(w.land.tilled[i]).toBeLessThanOrEqual(1.0001);
      expect(w.land.seeds[i]).toBeLessThanOrEqual(cfg.seedCap + 1e-4);
      expect(w.land.soilHealth[i]).toBeGreaterThanOrEqual(cfg.soilMin - 1e-6);
    }
    for (let s = 0; s < w.people.capacity; s++) {
      expect(w.people.carry[s]).toBeLessThanOrEqual(cfg.seedCarryMax + 1e-4);
    }
    expect(w.ledger.violations).toBe(0);
  });

  it('the overlay packs desert, farmland and seed levels into one byte per cell', () => {
    const land = new Land(cfg);
    const i = cell(7, 7);
    land.tilled[i] = 1; land.seeds[i] = cfg.seedCap; land.soilHealth[i] = cfg.soilMin;
    const out = new Uint8Array(65536);
    land.packOverlay(out, cfg);
    expect(out[i] & 7).toBe(7);
    expect((out[i] >> 3) & 7).toBe(7);
    expect(out[i] >> 6).toBe(3);
    expect(out[cell(8, 8)]).toBe(0);
  });
});
