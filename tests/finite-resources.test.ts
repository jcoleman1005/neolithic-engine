import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';
import { Land } from '../src/sim/land';
import { DEFAULT_CONFIG } from '../src/sim/config';
import type { TerrainField } from '../src/sim/terrain';

const cell = (x: number, y: number) => (y << 8) | x;
// A wooded patch (cover 1.0) on a fertile board.
const cover = new Uint16Array(65536).fill(0);
for (let y = 10; y < 14; y++) for (let x = 10; x < 14; x++) cover[cell(x, y)] = 65535;
const cfg = { ...DEFAULT_CONFIG, elevationEnabled: false, terrainEnabled: false };
const woodland = (): Land => new Land(cfg, null, { cover } as unknown as TerrainField);

describe('Finite wild resources', () => {
  it('wood is finite: cutting brush uses trees up and stops when they are gone', () => {
    const land = woodland();
    const c = cell(11, 11);
    expect(land.trees[c]).toBe(cfg.treeCap);
    const before = land.trees[c];
    const got = land.cutBrush(11, 11, 4, cfg);
    expect(got).toBe(4);
    expect(land.trees[c]).toBeCloseTo(before - 4 * cfg.treeBrushCost, 5);
    land.trees[c] = 0.2;
    expect(land.cutBrush(11, 11, 4, cfg)).toBeCloseTo(0.2 / cfg.treeBrushCost, 5);
    expect(land.trees[c]).toBeCloseTo(0, 5);
    expect(land.cutBrush(11, 11, 4, cfg)).toBe(0);
  });

  it('trees regrow slowly toward their ceiling and never past it', () => {
    const land = woodland();
    const c = cell(11, 11);
    land.trees[c] = 0;
    land.step(cfg);
    expect(land.trees[c]).toBeGreaterThan(0);
    expect(land.trees[c]).toBeLessThan(land.treeMax[c] * 0.01);
    land.trees[c] = land.treeMax[c] * 0.99;
    for (let k = 0; k < 100; k++) land.step(cfg);
    expect(land.trees[c]).toBeCloseTo(land.treeMax[c], 3);
  });

  it('with the switch off, brush is free and berries do not grow back', () => {
    const off = { ...cfg, finiteResourcesEnabled: false };
    const land = new Land(off, null, { cover } as unknown as TerrainField);
    const c = cell(11, 11);
    expect(land.cutBrush(11, 11, 4, off)).toBe(4);
    expect(land.trees[c]).toBe(land.treeMax[c]);
    const b = cell(30, 30);
    land.berries[b] = 0;
    land.step(off);
    expect(land.berries[b]).toBe(0);
  });

  it('berries are picked down to zero, regrow, and sit only on open fertile ground', () => {
    const land = woodland();
    const b = cell(30, 30);
    expect(land.berryMax[b]).toBeGreaterThan(0);
    expect(land.berryMax[cell(11, 11)]).toBe(0);
    expect(land.pickBerries(30, 30, 1e6)).toBeCloseTo(land.berryMax[b], 5);
    expect(land.berries[b]).toBe(0);
    land.step(cfg);
    expect(land.berries[b]).toBeGreaterThan(0);
  });

  it('save round trip keeps trees and berries and the same seed gives the same hash', () => {
    const a = new World({ ...cfg, initialPopulation: 200 }, 7);
    for (let t = 0; t < 120; t++) a.step();
    const b = World.fromState(JSON.parse(JSON.stringify(a.exportState())));
    for (let t = 0; t < 60; t++) { a.step(); b.step(); }
    expect(b.stateHash()).toBe(a.stateHash());
    const c = new World({ ...cfg, initialPopulation: 200 }, 7);
    for (let t = 0; t < 180; t++) c.step();
    expect(c.stateHash()).toBe(a.stateHash());
  });
});
