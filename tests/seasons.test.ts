import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';
import { DEFAULT_CONFIG } from '../src/sim/config';
import { seasonGrowthFactor, seasonIndex, seasonName } from '../src/sim/seasons';

const cfg = DEFAULT_CONFIG;
const tpy = cfg.ticksPerYear;

describe('Phase 5a seasons', () => {
  it('names the four seasons in order across a year and repeats', () => {
    expect([0, 100, 190, 280].map((t) => seasonName(t, cfg))).toEqual(['Spring', 'Summer', 'Autumn', 'Winter']);
    expect(seasonIndex(5, cfg)).toBe(seasonIndex(5 + 7 * tpy, cfg));
  });

  it('growth factor averages 1 over a year, peaks in summer and bottoms out in winter', () => {
    let sum = 0;
    let max = -Infinity;
    let min = Infinity;
    let maxAt = 0;
    let minAt = 0;
    for (let t = 0; t < tpy; t++) {
      const f = seasonGrowthFactor(t, cfg);
      sum += f;
      if (f > max) { max = f; maxAt = t; }
      if (f < min) { min = f; minAt = t; }
    }
    expect(sum / tpy).toBeCloseTo(1, 2);
    expect(seasonName(maxAt, cfg)).toBe('Summer');
    expect(seasonName(minAt, cfg)).toBe('Winter');
    expect(min).toBeGreaterThan(0);
  });

  it('is exactly 1 when the switch is off', () => {
    const off = { ...cfg, seasonsEnabled: false };
    for (let t = 0; t < tpy; t += 30) expect(seasonGrowthFactor(t, off)).toBe(1);
  });

  it('same seed gives the same fingerprint with seasons on, and off differs', () => {
    const run = (o: object) => {
      const w = new World({ initialPopulation: 100, ...o }, 7);
      for (let t = 0; t < 400; t++) w.step();
      return w.stateHash();
    };
    expect(run({})).toBe(run({}));
    expect(run({})).not.toBe(run({ seasonsEnabled: false }));
  });
});
