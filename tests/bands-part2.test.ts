import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';
import { BandTracker } from '../src/sim/bands';

async function run(ticks: number, tracker?: BandTracker, seed = 7): Promise<World> {
  const world = new World({ initialPopulation: 300 }, seed);
  for (let i = 0; i < ticks; i++) {
    world.step();
    if (i % 200 === 0) await new Promise((r) => setImmediate(r));
    tracker?.update(world);
  }
  return world;
}

// Split from bands.test.ts: vitest's worker RPC times out when one file runs longer than 60 s under load.
describe('Phase 4 band tracker (part 2)', () => {
  it('records are reproducible and survive an export/import round trip', async () => {
    const t1 = new BandTracker();
    const t2 = new BandTracker();
    await run(2000, t1);
    await run(2000, t2);
    expect(t1.exportState()).toEqual(t2.exportState());
    const copy = new BandTracker();
    copy.importState(JSON.parse(JSON.stringify(t1.exportState())));
    expect(copy.exportState()).toEqual(t1.exportState());
  });

  it('does nothing when switched off', () => {
    const tracker = new BandTracker();
    const world = new World({ initialPopulation: 100, bandTrackEnabled: false }, 3);
    for (let i = 0; i < 600; i++) {
      world.step();
      expect(tracker.update(world)).toEqual([]);
    }
    expect(tracker.bands.size).toBe(0);
  });
});
