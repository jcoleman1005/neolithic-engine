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
    land.trees[c] = land.treeMax[c] * 0.5;
    land.step(cfg);
    expect(land.trees[c]).toBeGreaterThan(land.treeMax[c] * 0.5);
    expect(land.trees[c]).toBeLessThan(land.treeMax[c] * 0.51);
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

  it('woodland thinning is packed for the viewer: 0 for a full stand, 5 for a stripped one, and never on open ground', () => {
    const land = woodland();
    const out = new Uint8Array(65536);
    land.packStructures(out, cfg);
    expect(out[cell(11, 11)]).toBe(0);
    land.trees[cell(11, 11)] = 0;
    land.trees[cell(12, 11)] = land.treeMax[cell(12, 11)] * 0.5;
    land.packStructures(out, cfg);
    expect(out[cell(11, 11)] >> 5).toBe(5);
    expect(out[cell(12, 11)] >> 5).toBe(3);
    expect(out[cell(30, 30)]).toBe(0);
  });

  it('a stripped stand becomes stumps that block regrowth, then rot to open field for good', () => {
    const land = woodland();
    const c = cell(11, 11);
    land.trees[c] = 0;
    land.step(cfg);
    expect(land.stumpAge[c]).toBeGreaterThan(0);
    const out = new Uint8Array(65536);
    land.packStructures(out, cfg);
    expect(out[c] >> 5).toBe(6);
    for (let k = 0; k < 100; k++) land.step(cfg);
    expect(land.trees[c]).toBe(0); // stumps block regrowth
    expect(land.cleared[c]).toBe(0);
    for (let k = 0; k < cfg.stumpRotTicks; k++) land.step(cfg);
    expect(land.cleared[c]).toBe(1);
    expect(land.treeMax[c]).toBe(0);
    expect(land.cutBrush(11, 11, 4, cfg)).toBe(0);
    land.packStructures(out, cfg);
    expect(out[c] >> 5).toBe(7);
    // A stand that is only thinned never stumps and regrows.
    const d = cell(12, 11);
    land.trees[d] = land.treeMax[d] * 0.5;
    land.step(cfg);
    expect(land.stumpAge[d]).toBe(0);
    expect(land.trees[d]).toBeGreaterThan(land.treeMax[d] * 0.5);
  });

  it('stumps and cleared field survive a save round trip', () => {
    const a = new World({ ...cfg, initialPopulation: 100 }, 3);
    a.land.stumpAge[cell(40, 40)] = 5;
    a.land.treeMax[cell(40, 40)] = 10;
    a.land.cleared[cell(41, 40)] = 1;
    const b = World.fromState(JSON.parse(JSON.stringify(a.exportState())));
    expect(b.land.stumpAge[cell(40, 40)]).toBe(5);
    expect(b.land.cleared[cell(41, 40)]).toBe(1);
    expect(b.land.treeMax[cell(41, 40)]).toBe(0);
  });
});
