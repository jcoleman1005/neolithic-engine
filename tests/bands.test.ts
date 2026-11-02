import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';
import { BandTracker } from '../src/sim/bands';

function run(ticks: number, tracker?: BandTracker, seed = 7): World {
  const world = new World({ initialPopulation: 300 }, seed);
  for (let i = 0; i < ticks; i++) {
    world.step();
    tracker?.update(world);
  }
  return world;
}

describe('Phase 4 band tracker', () => {
  it('is a pure observer: same seed gives the same fingerprint with it on or off', () => {
    const a = run(1500, new BandTracker());
    const b = run(1500);
    expect(a.stateHash()).toBe(b.stateHash());
  });

  it('tracks bands with sane records on the wrapping grid', () => {
    const tracker = new BandTracker();
    const world = run(2500, tracker);
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

  it('records are reproducible and survive an export/import round trip', () => {
    const t1 = new BandTracker();
    const t2 = new BandTracker();
    run(2000, t1);
    run(2000, t2);
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
