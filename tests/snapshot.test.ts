import { describe, expect, it } from 'vitest';
import { World, type WorldState } from '../src/sim/world';

const plain = (state: WorldState) => JSON.parse(JSON.stringify(state)) as WorldState;

const SMALL = { initialPopulation: 100 };

describe('Snapshots', () => {
  it('a world restored mid-run continues exactly as the original', () => {
    const original = new World({ ...SMALL, seed: 101 });
    for (let t = 0; t < 100; t++) original.step();

    const saved = JSON.parse(JSON.stringify(original.exportState())) as WorldState;
    const restored = World.fromState(saved);
    expect(plain(restored.exportState())).toEqual(plain(original.exportState()));
    expect(restored.stateHash()).toBe(original.stateHash());

    for (let t = 0; t < 100; t++) {
      original.step();
      restored.step();
    }
    expect(restored.tick).toBe(200);
    expect(plain(restored.exportState())).toEqual(plain(original.exportState()));
    expect(restored.stateHash()).toBe(original.stateHash());
  });

  it('a restored world resets to the same start as the original seed', () => {
    const original = new World({ ...SMALL, seed: 102 });
    for (let t = 0; t < 50; t++) original.step();
    const restored = World.fromState(original.exportState());
    restored.reset(102);
    const fresh = new World({ ...SMALL, seed: 102 });
    expect(restored.exportState()).toEqual(fresh.exportState());
    expect(restored.stateHash()).toBe(fresh.stateHash());
  });

  it('refuses an unknown version', () => {
    const state = { ...new World({ ...SMALL, seed: 1 }).exportState(), formatVersion: 2 } as unknown as WorldState;
    expect(() => World.fromState(state)).toThrow(/version/);
  });
});
