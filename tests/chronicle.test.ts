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
  it('a fight is reported after it ends, with its size and outcome', () => {
    const world = new World({ initialPopulation: 300, chronicleBattleMinSize: 1 }, 5);
    const chronicle = new Chronicle();
    for (let i = 0; i < 600; i++) {
      world.step();
      chronicle.record(world);
    }
    const bands = [...chronicle.tracker.bands.values()];
    expect(bands.length).toBeGreaterThanOrEqual(2);
    const [a, b] = bands;
    const collect = (): string[] =>
      chronicle.record(world).flatMap((e) => (e.kind === 'chronicle' && e.type === 'battle' ? [e.text] : []));

    const need = world.config.chronicleBattleClashes;
    // Too few clashes: nothing, even after the quiet days.
    for (let i = 0; i < need - 1; i++) Rules.clashLog.push(a.id, b.id, 0, 10, 10);
    expect(collect()).toEqual([]);
    for (let i = 0; i < world.config.chronicleBattleWindow + 2; i++) world.step();
    expect(collect()).toEqual([]);

    // Enough clashes, and the fight is still on: nothing yet.
    for (let i = 0; i < need + 20; i++) Rules.clashLog.push(a.id, b.id, i % 10 === 0 ? 1 : 0, 10, 10);
    expect(collect()).toEqual([]);
    // After the quiet days it is reported, once, with a winner and the toll.
    let texts: string[] = [];
    for (let i = 0; i < world.config.chronicleBattleWindow + 2 && texts.length === 0; i++) {
      world.step();
      texts = collect();
    }
    expect(texts).toHaveLength(1);
    expect(texts[0]).toMatch(/^(Skirmish|Battle|Great battle) near /);
    expect(texts[0]).toMatch(/beat the/);
    expect(texts[0]).toMatch(/\d+ fell/);

    // Cooldown: another fight right away makes no second entry.
    for (let i = 0; i < need * 2; i++) Rules.clashLog.push(a.id, b.id, 0, 10, 10);
    let again: string[] = [];
    for (let i = 0; i < world.config.chronicleBattleWindow + 3; i++) {
      world.step();
      again = again.concat(collect());
    }
    expect(again).toEqual([]);
  });

  it('fights are sized skirmish, battle or great battle by their clashes', () => {
    const world = new World({ initialPopulation: 300, chronicleBattleMinSize: 1, chronicleBattleCooldown: 0 }, 5);
    const chronicle = new Chronicle();
    for (let i = 0; i < 600; i++) {
      world.step();
      chronicle.record(world);
    }
    const [a, b] = [...chronicle.tracker.bands.values()];
    const sized: Record<number, RegExp> = {
      [world.config.chronicleBattleClashes]: /^Skirmish/,
      [world.config.chronicleBattleSize]: /^Battle/,
      [world.config.chronicleGreatBattleSize]: /^Great battle/,
    };
    for (const [clashes, pattern] of Object.entries(sized)) {
      for (let i = 0; i < Number(clashes); i++) Rules.clashLog.push(a.id, b.id, 0, 10, 10);
      let text = '';
      for (let i = 0; i < world.config.chronicleBattleWindow + 3 && !text; i++) {
        world.step();
        for (const e of chronicle.record(world)) if (e.kind === 'chronicle' && e.type === 'battle') text = e.text;
      }
      expect(text).toMatch(pattern);
    }
  });

  it('clash ring overwrites its oldest entries without growing', () => {
    const before = Rules.clashLog.head;
    for (let i = 0; i < CLASH_RING + 5; i++) Rules.clashLog.push(1, 2, 0, 0, 0);
    expect(Rules.clashLog.head).toBe(before + CLASH_RING + 5);
    expect(Rules.clashLog.winner.length).toBe(CLASH_RING);
  });

  it('state survives a JSON round trip', () => {
    const chronicle = new Chronicle();
    run(600, chronicle);
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
