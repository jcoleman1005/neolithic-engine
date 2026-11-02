import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';
import { Chronicle } from '../src/sim/chronicle';
import { Rules, CLASH_RING } from '../src/sim/rules';
import { WorldEventDetector } from '../src/sim/events';

function run(ticks: number, chronicle?: Chronicle, seed = 11, config = {}): { world: World; texts: string[] } {
  const world = new World({ initialPopulation: 300, ...config }, seed);
  const texts: string[] = [];
  for (let i = 0; i < ticks; i++) {
    world.step();
    for (const e of chronicle?.record(world) ?? []) if (e.kind === 'chronicle') texts.push(e.text);
  }
  return { world, texts };
}

describe('Phase 4 chronicle', () => {
  it('is a pure observer: same seed gives the same fingerprint with it on or off', () => {
    const on = run(1800, new Chronicle()).world.stateHash();
    const off = run(1800).world.stateHash();
    expect(on).toBe(off);
  });

  it('entries are reproducible for the same seed', () => {
    const a = run(2400, new Chronicle(), 5, { chronicleBattleClashes: 3, chronicleFoundMinSize: 15, chronicleSplitMinSize: 12 });
    const b = run(2400, new Chronicle(), 5, { chronicleBattleClashes: 3, chronicleFoundMinSize: 15, chronicleSplitMinSize: 12 });
    expect(a.texts.length).toBeGreaterThan(0);
    expect(a.texts).toEqual(b.texts);
  });

  it('writes nothing when switched off', () => {
    const { texts } = run(1500, new Chronicle(), 5, { chronicleEnabled: false });
    expect(texts).toEqual([]);
  });

  it('battle needs enough clashes between two tracked bands inside the window', () => {
    const world = new World({ initialPopulation: 300, chronicleBattleMinSize: 1 }, 5);
    const chronicle = new Chronicle();
    for (let i = 0; i < 1500; i++) {
      world.step();
      chronicle.record(world);
    }
    const bands = [...chronicle.tracker.bands.values()];
    expect(bands.length).toBeGreaterThanOrEqual(2);
    const [a, b] = bands;
    // Fewer clashes than the threshold: no entry.
    const need = world.config.chronicleBattleClashes;
    for (let i = 0; i < need - 1; i++) Rules.clashLog.push(a.id, b.id, 10, 10);
    expect(chronicle.record(world).filter((e) => e.kind === 'chronicle' && e.type === 'battle')).toEqual([]);
    // One more reaches it.
    Rules.clashLog.push(a.id, b.id, 10, 10);
    const battles = chronicle.record(world).filter((e) => e.kind === 'chronicle' && e.type === 'battle');
    expect(battles).toHaveLength(1);
    // Cooldown: more clashes right away make no second entry.
    for (let i = 0; i < need * 2; i++) Rules.clashLog.push(a.id, b.id, 10, 10);
    expect(chronicle.record(world).filter((e) => e.kind === 'chronicle' && e.type === 'battle')).toEqual([]);
  });

  it('clash ring overwrites its oldest entries without growing', () => {
    const before = Rules.clashLog.head;
    for (let i = 0; i < CLASH_RING + 5; i++) Rules.clashLog.push(1, 2, 0, 0);
    expect(Rules.clashLog.head).toBe(before + CLASH_RING + 5);
    expect(Rules.clashLog.rootA.length).toBe(CLASH_RING);
  });

  it('state survives a JSON round trip', () => {
    const chronicle = new Chronicle();
    run(2000, chronicle);
    const state = JSON.parse(JSON.stringify(chronicle.exportState()));
    const copy = new Chronicle();
    copy.importState(state);
    expect(JSON.parse(JSON.stringify(copy.exportState()))).toEqual(state);
  });

  it('stamped events continue the sequence numbers after a load', () => {
    const world = new World({ initialPopulation: 50 }, 1);
    const first = new WorldEventDetector();
    const a = first.stamp(world, { kind: 'extinction' });
    const second = new WorldEventDetector([a]);
    expect(second.stamp(world, { kind: 'extinction' }).seq).toBe(a.seq + 1);
  });
});
