import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';
import { Chronicle } from '../src/sim/chronicle';

async function run(ticks: number, chronicle?: Chronicle, seed = 11, config = {}): Promise<{ world: World; texts: string[] }> {
  const world = new World({ initialPopulation: 300, ...config }, seed);
  const texts: string[] = [];
  for (let i = 0; i < ticks; i++) {
    world.step();
    if (i % 200 === 0) await new Promise((r) => setImmediate(r)); // keep vitest's worker RPC alive
    for (const e of chronicle?.record(world) ?? []) if (e.kind === 'chronicle') texts.push(e.text);
  }
  return { world, texts };
}

// Split from chronicle.test.ts: vitest's worker RPC times out when one file runs longer than 60 s.
describe('Phase 4 chronicle observer', () => {
  it('is a pure observer: same seed gives the same fingerprint with it on or off', async () => {
    const on = (await run(1800, new Chronicle())).world.stateHash();
    const off = (await run(1800)).world.stateHash();
    expect(on).toBe(off);
  });

  it('writes nothing when switched off', async () => {
    const { texts } = await run(1500, new Chronicle(), 5, { chronicleEnabled: false });
    expect(texts).toEqual([]);
  });
});
