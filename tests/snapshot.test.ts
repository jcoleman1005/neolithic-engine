import { describe, expect, it } from 'vitest';
import { SAVE_SCHEMA, World, type WorldState } from '../src/sim/world';

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

  it('stamps saves with the schema and still round-trips', () => {
    const world = new World({ ...SMALL, seed: 1 });
    const saved = plain(world.exportState());
    expect(saved.schema).toBe(SAVE_SCHEMA);
    expect(World.fromState(saved).stateHash()).toBe(world.stateHash());
  });

  it('refuses a save from a newer schema instead of dropping its state', () => {
    const state = { ...plain(new World({ ...SMALL, seed: 1 }).exportState()), schema: SAVE_SCHEMA + 1 };
    expect(() => World.fromState(state)).toThrow(/newer build/);
  });

  it('still loads a save that predates the schema stamp', () => {
    const { schema: _schema, ...legacy } = plain(new World({ ...SMALL, seed: 1 }).exportState());
    expect(() => World.fromState(legacy as WorldState)).not.toThrow();
  });

  it('refuses a save whose people carry fields this build does not know', () => {
    const state = plain(new World({ ...SMALL, seed: 1 }).exportState());
    expect(state.people!.people.length).toBeGreaterThan(0);
    const people = state.people!.people.map((p, i) => (i === 0 ? { ...p, fearX: 3 } : p));
    const bad = { ...state, people: { ...state.people!, people } } as unknown as WorldState;
    expect(() => World.fromState(bad)).toThrow(/fearX/);
  });

  it('accepts the legacy mateSlot name and every field a current save writes', () => {
    const state = plain(new World({ ...SMALL, seed: 1 }).exportState());
    const people = state.people!.people.map((p) => ({ ...p, mateSlot: 0 }));
    expect(() => World.fromState({ ...state, people: { ...state.people!, people } } as unknown as WorldState)).not.toThrow();
  });
});
