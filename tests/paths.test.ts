import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';
import { Rules } from '../src/sim/rules';
import { slotFromId } from '../src/sim/people';
import { PRNG } from '../src/sim/prng';

const cell = (x: number, y: number): number => ((y & 255) << 8) | (x & 255);

function quietWorld(config: Record<string, number | boolean> = {}): World {
  return new World({ initialPopulation: 0, wolfInitialCount: 0, ...config }, 9);
}

describe('S2: path wear', () => {
  it('wears a tile with each step, up to 255', () => {
    const w = quietWorld({ wearStep: 100 });
    const c = cell(10, 10);
    w.land.trample(c, w.config);
    expect(w.land.wear[c]).toBe(100);
    w.land.trample(c, w.config);
    w.land.trample(c, w.config);
    expect(w.land.wear[c]).toBe(255);
  });

  it('fades by one per tile every wearDecaySlices ticks, and never below zero', () => {
    const w = quietWorld({ wearDecaySlices: 4 });
    w.land.wear[cell(0, 0)] = 3;
    w.land.wear[cell(1, 0)] = 0;
    for (let t = 0; t < 4; t++) w.land.wearDown(t, w.config);
    expect(w.land.wear[cell(0, 0)]).toBe(2);
    for (let t = 4; t < 40; t++) w.land.wearDown(t, w.config);
    expect(w.land.wear[cell(0, 0)]).toBe(0);
    expect(w.land.wear[cell(1, 0)]).toBe(0);
  });

  it('packs wear into eight levels for the viewer', () => {
    const w = quietWorld();
    w.land.wear[cell(3, 3)] = 255;
    w.land.wear[cell(4, 3)] = 40;
    const out = new Uint8Array(65536);
    w.land.packPaths(out);
    expect(out[cell(3, 3)]).toBe(7);
    expect(out[cell(4, 3)]).toBe(1);
    expect(out[cell(5, 3)]).toBe(0);
  });

  it('leans people toward the more worn neighbour', () => {
    const w = quietWorld({ calmMovementEnabled: false, pathPull: 5, bodyDrivesEnabled: false });
    let c = 0;
    while (w.land.isWater[c] === 1 || w.land.isWater[(c + 1) & 0xffff] === 1 || w.land.isWater[(c - 1) & 0xffff] === 1) c++;
    const x = c & 255, y = c >> 8;
    const s = slotFromId(w.people.spawn(x, y, 80, 0, 0, 0, 0, new Uint8Array(8), new Uint8Array(8), 0));
    w.fields.reset();
    w.land.wear[cell(x + 1, y)] = 255;
    let east = 0;
    for (let i = 0; i < 20; i++) if (Rules.climb(s, w.people, w.land, w.fields, w.config, new PRNG(i)) === 0) east++;
    expect(east).toBeGreaterThan(15);
  });

  it('makes a step onto worn ground cheaper', () => {
    const cost = (worn: boolean): number => {
      const w = new World({ initialPopulation: 200 }, 4);
      if (worn) w.land.wear.fill(255);
      const before = w.ledger.move;
      w.step();
      return w.ledger.move - before;
    };
    expect(cost(true)).toBeLessThan(cost(false));
  });

  it('keeps wear through a save and load', () => {
    const w = new World({ initialPopulation: 150 }, 3);
    for (let t = 0; t < 200; t++) w.step();
    const loaded = World.fromState(JSON.parse(JSON.stringify(w.exportState())));
    expect(Array.from(loaded.land.wear)).toEqual(Array.from(w.land.wear));
    for (let t = 0; t < 50; t++) { w.step(); loaded.step(); }
    expect(loaded.stateHash()).toBe(w.stateHash());
  });

  it('leaves the state hash alone while paths are off', () => {
    const w = quietWorld({ pathsEnabled: false });
    const h = w.stateHash();
    w.land.wear[cell(7, 7)] = 99;
    expect(w.stateHash()).toBe(h);
  });
});
