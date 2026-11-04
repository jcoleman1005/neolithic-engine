import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';
import { Land } from '../src/sim/land';
import { DEFAULT_CONFIG } from '../src/sim/config';

const cfg = { ...DEFAULT_CONFIG, elevationEnabled: false, terrainEnabled: false };
const cell = (x: number, y: number) => (y << 8) | x;
const WINTER_TICK = Math.round(0.875 * (DEFAULT_CONFIG.ticksPerYear || 360));

describe('Phase 5d cold, caves and campfires', () => {
  it('caves sit on land at hill edges, are spaced apart, are capped, and repeat for the same seed', () => {
    const a = new World({ initialPopulation: 0 }, 5);
    const b = new World({ initialPopulation: 0 }, 5);
    expect(a.land.caveCells.length).toBeGreaterThan(0);
    expect(a.land.caveCells.length).toBeLessThanOrEqual(DEFAULT_CONFIG.caveCount);
    expect(a.land.caveCells).toEqual(b.land.caveCells);
    for (const c of a.land.caveCells) {
      expect(a.land.isWater[c]).toBe(0);
      expect(a.land.cave[c]).toBe(1);
    }
    const off = new World({ initialPopulation: 0, cavesEnabled: false }, 5);
    expect(off.land.caveCells.length).toBe(0);
  });

  it('the cold is a pure function of season and height: winter is colder than summer, hills colder than lowland', () => {
    const land = new Land(cfg);
    land.upland[cell(1, 1)] = 0.5;
    land.setSeason(1, cfg); // summer
    expect(land.coldAt(cell(0, 0))).toBe(0);
    land.setSeason(-1, cfg); // winter
    expect(land.coldAt(cell(0, 0))).toBeGreaterThan(0);
    land.setSeason(-0.5, cfg);
    expect(land.coldAt(cell(1, 1))).toBeGreaterThan(land.coldAt(cell(0, 0)));
  });

  const upkeepOnce = (mutate: (w: World, c: number) => void, extra: Record<string, unknown> = {}) => {
    const w = new World({ initialPopulation: 1, ...extra }, 21);
    w.step();
    const slot = [...Array(w.people.capacity).keys()].find((s) => w.people.alive[s] === 1)!;
    const c = (w.people.y[slot] << 8) | w.people.x[slot];
    (w as unknown as { tick: number }).tick = WINTER_TICK;
    mutate(w, c);
    const before = w.ledger.upkeep;
    w.step();
    return { paid: w.ledger.upkeep - before, w };
  };

  it('in winter an unsheltered person pays more upkeep than one in a cave', () => {
    const open = upkeepOnce(() => {}).paid;
    const caved = upkeepOnce((w, c) => { w.land.cave[c] = 1; }).paid;
    expect(open).toBeGreaterThan(caved);
  });

  it('with the cold off nobody pays a surcharge', () => {
    const open = upkeepOnce(() => {}, { coldEnabled: false }).paid;
    const caved = upkeepOnce((w, c) => { w.land.cave[c] = 1; }, { coldEnabled: false }).paid;
    expect(open).toBeCloseTo(caved, 9);
  });

  it('a fire needs a big enough brush heap, burns it down, and goes out', () => {
    const land = new Land(cfg);
    const i = cell(40, 40);
    land.brush[i] = 2;
    expect(land.ignite(i, cfg)).toBe(false);
    land.brush[i] = 6;
    expect(land.ignite(i, cfg)).toBe(true);
    expect(land.fireCount).toBe(1);
    for (let k = 0; k < 100; k++) land.burnFires(cfg);
    expect(land.fire[i]).toBe(0);
    expect(land.brush[i]).toBe(0);
    expect(land.fireCount).toBe(0);
  });

  it('a burning fire shelters a radius around it, and the warmth goes with it', () => {
    const land = new Land(cfg);
    const i = cell(60, 60);
    land.brush[i] = 20;
    land.ignite(i, cfg);
    land.refreshWarmth(cfg);
    expect(land.sheltered(cell(62, 61))).toBe(true);
    expect(land.sheltered(cell(66, 60))).toBe(false);
    expect(land.warmDist[cell(66, 60)]).toBe(6);
    for (let k = 0; k < 200; k++) land.burnFires(cfg);
    land.refreshWarmth(cfg);
    expect(land.sheltered(cell(62, 61))).toBe(false);
    expect(land.warmDist[cell(66, 60)]).toBe(255);
  });

  it('fires and caves reach the viewer as three bytes each', () => {
    const w = new World({ initialPopulation: 0 }, 5);
    const caves = w.land.caveCells.length;
    const i = cell(100, 100);
    w.land.brush[i] = 30;
    w.land.ignite(i, w.config);
    const out = w.land.packFeatures(w.config);
    expect(out.length).toBe((caves + 1) * 3);
    expect(out[out.length - 3]).toBe(100);
    expect(out[out.length - 1]).toBeGreaterThanOrEqual(2);
  });

  it('fire state survives a save round trip and the run continues identically; the ledger balances', () => {
    const a = new World({ initialPopulation: 150 }, 12);
    for (let t = 0; t < 400; t++) a.step();
    const c = cell(30, 30);
    a.land.brush[c] = 40;
    a.land.ignite(c, a.config);
    for (let t = 0; t < 30; t++) a.step();
    const b = World.fromState(JSON.parse(JSON.stringify(a.exportState())));
    expect(b.land.fireCount).toBe(a.land.fireCount);
    expect(b.stateHash()).toBe(a.stateHash());
    for (let t = 0; t < 100; t++) { a.step(); b.step(); }
    expect(b.stateHash()).toBe(a.stateHash());
    expect(a.ledger.violations).toBe(0);
  });
});
