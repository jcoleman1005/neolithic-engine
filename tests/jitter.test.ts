import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';
import { DEFAULT_CONFIG } from '../src/sim/config';
import { PRNG } from '../src/sim/prng';
import { computeUnifiedJitter, jitterDir, jitterWeight } from '../src/sim/jitter';
import { GENE_COUNT, GENE_CURIOSITY, HABIT_COUNT, HABIT_ROAMING } from '../src/sim/people';

const setup = () => {
  const w = new World({ initialPopulation: 1 }, 42);
  w.step();
  const slot = [...Array(w.people.capacity).keys()].find((s) => w.people.alive[s] === 1)!;
  w.people.habits[slot * HABIT_COUNT + HABIT_ROAMING] = 255;
  w.people.genes[slot * GENE_COUNT + GENE_CURIOSITY] = 255;
  w.people.fatigue[slot] = 0;
  return { w, slot };
};

describe('persistent-walk jitter', () => {
  it('always returns a valid direction, never reverses, and draws one number per call', () => {
    const { w, slot } = setup();
    for (const prev of [0, 1, 2, 3, 4]) {
      w.people.prevDir[slot] = prev;
      const a = new PRNG(7), b = new PRNG(7);
      for (let t = 0; t < 400; t++) {
        const p = computeUnifiedJitter(slot, t, w.people, w.land, a, 42, DEFAULT_CONFIG);
        b.nextUint32();
        expect(jitterDir(p)).toBeGreaterThanOrEqual(0);
        expect(jitterDir(p)).toBeLessThan(4);
        if (prev < 4) expect(jitterDir(p)).not.toBe(prev ^ 1);
        expect(Number.isFinite(jitterWeight(p))).toBe(true);
      }
      expect(a.nextUint32()).toBe(b.nextUint32());
    }
  });
  it('exhaustion kills the weight and is deterministic for a seed', () => {
    const { w, slot } = setup();
    w.people.prevDir[slot] = 0;
    w.people.fatigue[slot] = 255;
    expect(jitterWeight(computeUnifiedJitter(slot, 3, w.people, w.land, new PRNG(1), 42, DEFAULT_CONFIG))).toBe(0);
    w.people.fatigue[slot] = 0;
    const run = (seed: number) => Array.from({ length: 200 }, (_, t) => computeUnifiedJitter(slot, t, w.people, w.land, new PRNG(t), seed, DEFAULT_CONFIG));
    expect(run(42)).toEqual(run(42));
    expect(run(42)).not.toEqual(run(43));
  });
});
