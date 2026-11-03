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
});
