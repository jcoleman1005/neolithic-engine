import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';
import { attachWatchProbe } from '../scripts/watch-probe-lib';

describe('Watchability W0: the watch probe is read only', () => {
  it('a probed run ends with the same state hash as a plain run', () => {
    const plain = new World({}, 3);
    const probed = new World({}, 3);
    // Measure from the start, so every wrapper and counter is live during the comparison.
    const probe = attachWatchProbe(probed, { every: 30, fromYear: 0 });
    for (let t = 0; t < 300; t++) {
      plain.step();
      probed.step();
      probe.afterStep();
    }
    const r = probe.result();
    expect(r.hash).toBe(plain.stateHash());
    expect(probed.stateHash()).toBe(plain.stateHash());
    // It did measure something: people moved, the land regrew, and plants were eaten.
    expect(r.stepsPerAdultYear as number).toBeGreaterThan(0);
    expect(r.harvestShare as number).toBeGreaterThan(0);
    expect(r.landFullPct as number).toBeGreaterThan(0);
    expect(r.landFullPct as number).toBeLessThanOrEqual(1);
  });

  it('the same holds with weather on', () => {
    const plain = new World({ weatherEnabled: true }, 2);
    const probed = new World({ weatherEnabled: true }, 2);
    const probe = attachWatchProbe(probed, { every: 30, fromYear: 0 });
    for (let t = 0; t < 300; t++) {
      plain.step();
      probed.step();
      probe.afterStep();
    }
    expect(probe.result().hash).toBe(plain.stateHash());
  });
});
