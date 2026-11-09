import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';
import { CONTEST_FIGHT, CONTEST_YIELD } from '../src/sim/protocol';
import { CONTEST_GIVES_PER_TICK, CONTEST_LOG_SIZE, ContestLog } from '../src/sim/contest-log';

const cell = (x: number, y: number): number => ((y & 255) << 8) | (x & 255);

function quietWorld(config: Record<string, number | boolean> = {}): World {
  return new World({ initialPopulation: 0, wolfInitialCount: 0, ...config }, 9);
}

describe('S3 viewer channels', () => {
  it('packs build progress (bits 3-4) and packed earth (bit 5) into the ground channel, leaving wear and water alone', () => {
    const w = quietWorld({ hutDurability: 60 });
    const out = new Uint8Array(65536);
    // Stone set down once, a little earth, and a finished hut.
    w.land.durability[cell(1, 1)] = 5;
    w.land.material[cell(1, 1)] = 2;
    w.land.durability[cell(2, 1)] = 45;
    w.land.material[cell(2, 1)] = 1;
    w.land.wear[cell(2, 1)] = 255;
    w.land.durability[cell(3, 1)] = 90;
    w.land.material[cell(3, 1)] = 1;
    w.land.structure[cell(3, 1)] = 1;
    w.land.packPaths(out, w.config);
    expect((out[cell(1, 1)] >> 3) & 3).toBe(1);
    expect(out[cell(1, 1)] & 32).toBe(0);
    expect((out[cell(2, 1)] >> 3) & 3).toBe(3);
    expect(out[cell(2, 1)] & 32).toBe(32);
    expect(out[cell(2, 1)] & 7).toBe(7);
    // A hut has no build progress, but its material still shows.
    expect((out[cell(3, 1)] >> 3) & 3).toBe(0);
    expect(out[cell(3, 1)] & 32).toBe(32);
    expect(out[cell(9, 9)]).toBe(0);
  });

  it('keeps an even per-tick sample of contests, fights apart from give-ways, in a growing ring', () => {
    const log = new ContestLog();
    for (let i = 0; i < 200; i++) log.record(i & 255, 7, CONTEST_YIELD, 50);
    log.record(9, 9, CONTEST_FIGHT, 50);
    // One fight and three of the 200 give-ways, all stamped with their tick.
    const first = log.since(0);
    expect(first.length / 4).toBe(1 + CONTEST_GIVES_PER_TICK);
    for (let k = 0; k < first.length; k += 4) {
      expect(first[k + 1]).toBe(first[k + 2] === CONTEST_FIGHT ? 9 : 7);
      expect(first[k + 3]).toBe(50);
    }
    expect(first.filter((_, k) => k % 4 === 2 && first[k] === CONTEST_FIGHT)).toHaveLength(1);
    // A reader with a watermark sees only what came after it, and a clear forgets everything.
    log.record(1, 2, CONTEST_FIGHT, 51);
    expect(log.since(1 + CONTEST_GIVES_PER_TICK)).toEqual([1, 2, CONTEST_FIGHT, 51]);
    for (let t = 0; t < 200; t++) log.record(t, 3, CONTEST_FIGHT, 100 + t);
    expect(log.since(0).length / 4).toBe(CONTEST_LOG_SIZE);
    log.clear();
    expect(log.since(0)).toEqual([]);
  });

  it('records contests on the world being stepped, not on a shared static', () => {
    const a = quietWorld();
    const b = quietWorld();
    a.land.contests.record(4, 4, CONTEST_FIGHT, 1);
    expect(a.land.contests.since(0).length).toBe(4);
    expect(b.land.contests.since(0)).toEqual([]);
  });
});
