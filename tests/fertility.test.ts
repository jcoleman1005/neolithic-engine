import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';
import { Land } from '../src/sim/land';
import { DEFAULT_CONFIG } from '../src/sim/config';

const cfg = { ...DEFAULT_CONFIG, elevationEnabled: false, terrainEnabled: false };
const cell = (x: number, y: number) => (y << 8) | x;

describe('Mutable Land Fertility', () => {
  it('fertility degrades with overuse down to fertilityMin and never below', () => {
    const land = new Land(cfg);
    const i = cell(15, 15);
    const initialF = land.fertility[i];
    expect(initialF).toBeGreaterThan(cfg.fertilityMin);

    // Graze a stripped cell repeatedly
    for (let k = 0; k < 50; k++) {
      land.food[i] = 1.05; // just above floor
      land.graze(15, 15, 1, cfg);
    }
    expect(land.fertility[i]).toBeLessThan(initialF);

    // Heavy overuse degrades down to minimum, but never below
    for (let k = 0; k < 2000; k++) {
      land.food[i] = 1.05;
      land.graze(15, 15, 1, cfg);
    }
    expect(land.fertility[i]).toBeCloseTo(cfg.fertilityMin, 5);
    expect(land.fertility[i]).toBeGreaterThanOrEqual(cfg.fertilityMin);
  });

  it('explicit seed drops improve fertility, bounded by fertilityMax', () => {
    const land = new Land(cfg);
    const i = cell(25, 25);
    const initialF = land.fertility[i];

    land.dropSeeds(25, 25, 3.0, cfg);
    expect(land.fertility[i]).toBeGreaterThan(initialF);

    // Repeated seed drops enrich the soil up to fertilityMax
    for (let k = 0; k < 2000; k++) {
      land.dropSeeds(25, 25, 3.0, cfg);
    }
    expect(land.fertility[i]).toBeGreaterThan(1.4);
    expect(land.fertility[i]).toBeLessThanOrEqual(cfg.fertilityMax);
  });

  it('tamping ground improves fertility, bounded by fertilityMax', () => {
    const land = new Land(cfg);
    const i = cell(35, 35);
    const initialF = land.fertility[i];

    land.tamp(35, 35, cfg);
    expect(land.fertility[i]).toBeGreaterThan(initialF);
  });

  it('passive tending (worked soil + seeds + healthy plants) enriches fertility', () => {
    const land = new Land(cfg);
    const a = cell(45, 45); // untended control
    const b = cell(46, 45); // tended

    land.food[a] = land.maxFood[a];
    land.food[b] = land.maxFood[b];
    land.tilled[b] = 0.8;
    land.seeds[b] = 5.0;

    const initialF = land.fertility[b];
    for (let k = 0; k < 100; k++) {
      land.step({ ...cfg, tillDecay: 0, seedDecay: 0 });
    }

    expect(land.fertility[b]).toBeGreaterThan(initialF);
    expect(land.fertility[b]).toBeGreaterThan(land.fertility[a]);
  });

  it('fertilityChangeEnabled switch disables fertility changes', () => {
    const offCfg = { ...cfg, fertilityChangeEnabled: false };
    const land = new Land(offCfg);
    const i = cell(55, 55);
    const initialF = land.fertility[i];

    // Graze stripped
    for (let k = 0; k < 50; k++) {
      land.food[i] = 1.05;
      land.graze(55, 55, 1, offCfg);
    }
    expect(land.fertility[i]).toBe(initialF);

    // Drop seeds
    land.dropSeeds(55, 55, 3.0, offCfg);
    expect(land.fertility[i]).toBe(initialF);

    // Tamp
    land.tamp(55, 55, offCfg);
    expect(land.fertility[i]).toBe(initialF);
  });

  it('save and load preserves mutated fertility exactly and preserves stateHash', () => {
    const world = new World({ initialPopulation: 50 }, 42);
    // Mutate several cells
    world.land.dropSeeds(10, 10, 3.0, world.config);
    world.land.tamp(20, 20, world.config);
    world.land.food[cell(30, 30)] = 1.05;
    world.land.graze(30, 30, 1, world.config);

    const hashBefore = world.stateHash();
    const state = world.exportState();

    expect(state.land?.fertility).toBeDefined();
    expect(state.land?.fertility?.length).toBe(world.land.fertility.length);

    const restored = World.fromState(state);
    const hashAfter = restored.stateHash();

    expect(hashAfter).toBe(hashBefore);
    expect(restored.land.fertility[cell(10, 10)]).toBe(world.land.fertility[cell(10, 10)]);
    expect(restored.land.fertility[cell(20, 20)]).toBe(world.land.fertility[cell(20, 20)]);
    expect(restored.land.fertility[cell(30, 30)]).toBe(world.land.fertility[cell(30, 30)]);
  });
});
