import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';
import { BandTracker } from '../src/sim/bands';

async function run(ticks: number, tracker?: BandTracker, seed = 7): Promise<World> {
  const world = new World({ initialPopulation: 300 }, seed);
  for (let i = 0; i < ticks; i++) {
    world.step();
    if (i % 200 === 0) await new Promise((r) => setImmediate(r)); // keep vitest's worker RPC alive
    tracker?.update(world);
  }
  return world;
}

describe('Phase 4 band tracker', () => {
  it('is a pure observer: same seed gives the same fingerprint with it on or off', async () => {
    const a = await run(1500, new BandTracker());
    const b = await run(1500);
    expect(a.stateHash()).toBe(b.stateHash());
  });

  it('tracks bands with sane records on the wrapping grid', async () => {
    const tracker = new BandTracker();
    const world = await run(2500, tracker);
    expect(tracker.bands.size).toBeGreaterThan(0);
    const min = world.config.bandTrackMinSize ?? 10;
    for (const b of tracker.bands.values()) {
      expect(b.size).toBeGreaterThanOrEqual(Math.floor(min / 2));
      expect(b.peakSize).toBeGreaterThanOrEqual(b.size);
      expect(b.cx).toBeGreaterThanOrEqual(0);
      expect(b.cx).toBeLessThan(world.land.width);
      expect(b.cy).toBeGreaterThanOrEqual(0);
      expect(b.cy).toBeLessThan(world.land.height);
      expect(b.tongue.length).toBeGreaterThan(0);
    }
  });
});
