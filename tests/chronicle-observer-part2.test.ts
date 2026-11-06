import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';
import { Chronicle } from '../src/sim/chronicle';

async function run(ticks: number, chronicle?: Chronicle, seed = 11, config = {}): Promise<{ world: World; texts: string[] }> {
  const world = new World({ initialPopulation: 300, ...config }, seed);
  const texts: string[] = [];
  for (let i = 0; i < ticks; i++) {
    world.step();
    if (i % 200 === 0) await new Promise((r) => setImmediate(r));
    for (const e of chronicle?.record(world) ?? []) if (e.kind === 'chronicle') texts.push(e.text);
  }
  return { world, texts };
}

// Split from chronicle.test.ts: vitest's worker RPC times out when one file runs longer than 60 s.
describe('Phase 4 chronicle observer (part 2)', () => {
  it('entries are reproducible for the same seed', async () => {
    const a = await run(600, new Chronicle(), 5, { chronicleBattleClashes: 3, chronicleFoundMinSize: 8, chronicleSplitMinSize: 8 });
    const b = await run(600, new Chronicle(), 5, { chronicleBattleClashes: 3, chronicleFoundMinSize: 8, chronicleSplitMinSize: 8 });
    expect(a.texts.length).toBeGreaterThan(0);
    expect(a.texts).toEqual(b.texts);
  });
});
