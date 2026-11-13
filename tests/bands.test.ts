import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';
import { BandTracker } from '../src/sim/bands';
import { slotFromId } from '../src/sim/people';

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
    const a = await run(500, new BandTracker());
    const b = await run(500);
    expect(a.stateHash()).toBe(b.stateHash());
  });

  it('tracks bands with sane records on the wrapping grid', async () => {
    const tracker = new BandTracker();
    // 1200 ticks: since people walk back after drinking they gather more slowly, so bands take longer to form.
    const world = await run(1200, tracker);
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

describe('band tracker save', () => {
  it('still sees a split on the first pass after a load (the last-pass membership is saved)', () => {
    const world = new World({ initialPopulation: 0, wolfInitialCount: 0 }, 3);
    const ids: number[] = [];
    for (let i = 0; i < 24; i++) ids.push(world.people.spawn(100 + (i % 4), 100 + (i >> 2), 80, 0, i % 2, 0, 0));
    const leader = ids[0];
    for (const id of ids) world.people.rootLeaderId[slotFromId(id)] = leader === id ? 0 : leader;
    const live = new BandTracker();
    world.tick = 0;
    live.update(world);
    expect(live.bands.has(leader)).toBe(true);
    // Save and load the tracker, then half the band follows a new root.
    const loaded = new BandTracker();
    loaded.importState(JSON.parse(JSON.stringify(live.exportState())));
    loaded.importPrev(JSON.parse(JSON.stringify(live.exportPrev())));
    const newRoot = ids[12];
    for (let i = 12; i < 24; i++) world.people.rootLeaderId[slotFromId(ids[i])] = ids[i] === newRoot ? 0 : newRoot;
    world.tick = world.config.bandTrackInterval ?? 60;
    const a = live.update(world);
    const b = loaded.update(world);
    expect(a.some((c) => c.kind === 'split' && c.band === newRoot)).toBe(true);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });
});
