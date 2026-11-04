import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';
import { Land } from '../src/sim/land';
import { DEFAULT_CONFIG } from '../src/sim/config';

const cfg = { ...DEFAULT_CONFIG, elevationEnabled: false, terrainEnabled: false };
const cell = (x: number, y: number) => (y << 8) | x;

describe('Phase 5f stone and dry-stone huts', () => {
  it('stone is finite: quarrying takes it from a rock cell and never more than is there', () => {
    const w = new World({ initialPopulation: 0 }, 5);
    let rock = -1;
    for (let i = 0; i < 65536 && rock < 0; i++) if (w.land.stone[i] > 0) rock = i;
    expect(rock).toBeGreaterThanOrEqual(0);
    const x = rock & 255, y = rock >> 8;
    const before = w.land.stone[rock];
    expect(w.land.quarry(x, y, 5)).toBe(5);
    expect(w.land.stone[rock]).toBe(before - 5);
    expect(w.land.quarry(x, y, 1e6)).toBeCloseTo(before - 5, 4);
    expect(w.land.quarry(x, y, 1)).toBe(0);
  });

  it('setting stone down adds durability up to the cap, and a tile becomes a hut at the threshold', () => {
    const land = new Land(cfg);
    const i = cell(10, 10);
    land.build(10, 10, 5, cfg);
    expect(land.durability[i]).toBe(20);
    expect(land.structure[i]).toBe(0);
    land.build(10, 10, 10, cfg);
    expect(land.structure[i]).toBe(1);
    expect(land.hutCount).toBe(1);
    land.build(10, 10, 1e6, cfg);
    expect(land.durability[i]).toBe(cfg.durabilityCap);
    expect(land.hutCount).toBe(1);
  });

  it('erosion wears a hut down slowly and it falls back to rubble below the keep level', () => {
    const land = new Land(cfg);
    const i = cell(20, 20);
    land.build(20, 20, 15, cfg); // 60: just a hut
    expect(land.structure[i]).toBe(1);
    for (let t = 0; t < cfg.erosionSlices * 5; t++) land.erode(t, cfg);
    expect(land.durability[i]).toBe(60 - 5);
    expect(land.structure[i]).toBe(1);
    for (let t = 0; t < cfg.erosionSlices * 40; t++) land.erode(t, cfg);
    expect(land.structure[i]).toBe(0);
    expect(land.hutCount).toBe(0);
    expect(land.durability[i]).toBeGreaterThanOrEqual(0);
  });

  it('a hut shelters from the cold and cuts upkeep', () => {
    const land = new Land(cfg);
    land.build(5, 5, 20, cfg);
    expect(land.sheltered(cell(5, 5))).toBe(true);
    expect(land.sheltered(cell(6, 5))).toBe(false);
    const mk = (hut: boolean) => {
      const w = new World({ initialPopulation: 1 }, 21);
      w.step();
      const slot = [...Array(w.people.capacity).keys()].find((s) => w.people.alive[s] === 1)!;
      if (hut) w.land.build(w.people.x[slot], w.people.y[slot], 20, w.config);
      const before = w.ledger.upkeep;
      w.step();
      return w.ledger.upkeep - before;
    };
    expect(mk(true)).toBeLessThan(mk(false));
  });

  it('with building off nobody carries stone and nothing is built', () => {
    const w = new World({ initialPopulation: 150, buildingEnabled: false }, 8);
    for (let t = 0; t < 400; t++) w.step();
    for (let s = 0; s < w.people.capacity; s++) expect(w.people.carryKind[s]).not.toBe(4);
    expect(w.land.hutCount).toBe(0);
    expect(w.land.durability.every((v) => v === 0)).toBe(true);
  });

  it('building state survives a save round trip and the run continues identically; the ledger balances', () => {
    const a = new World({ initialPopulation: 150 }, 12);
    for (let t = 0; t < 500; t++) a.step();
    a.land.build(40, 40, 20, a.config);
    for (let t = 0; t < 20; t++) a.step();
    const b = World.fromState(JSON.parse(JSON.stringify(a.exportState())));
    expect(b.land.hutCount).toBe(a.land.hutCount);
    expect(b.stateHash()).toBe(a.stateHash());
    for (let t = 0; t < 100; t++) { a.step(); b.step(); }
    expect(b.stateHash()).toBe(a.stateHash());
    expect(a.ledger.violations).toBe(0);
  });

  it('huts reach the viewer as three bytes each, kind 8 to 11', () => {
    const w = new World({ initialPopulation: 0 }, 5);
    const before = w.land.packFeatures(w.config).length;
    w.land.build(100, 100, 30, w.config);
    const out = w.land.packFeatures(w.config);
    expect(out.length).toBe(before + 3);
    expect(out[out.length - 1]).toBeGreaterThanOrEqual(8);
    expect(out[out.length - 1]).toBeLessThan(12);
  });
});
