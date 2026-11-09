import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';
import { Land } from '../src/sim/land';
import { DEFAULT_CONFIG } from '../src/sim/config';

const cfg = { ...DEFAULT_CONFIG, elevationEnabled: false, terrainEnabled: false };

const lone = (extra: Record<string, unknown> = {}) => {
  const w = new World({ initialPopulation: 1, ...extra }, 21);
  w.step();
  const slot = [...Array(w.people.capacity).keys()].find((s) => w.people.alive[s] === 1)!;
  return { w, slot };
};

describe('Combat injury and grave marks', () => {
  it('a wounded person pays more upkeep than a healthy one, and the ledger balances', () => {
    const paid = (hurt: number) => {
      const { w, slot } = lone();
      w.people.injury[slot] = hurt;
      w.people.energy[slot] = 10; // too hungry to heal this tick
      const before = w.ledger.upkeep;
      w.step();
      return w.ledger.upkeep - before;
    };
    expect(paid(200)).toBeGreaterThan(paid(0));
  });

  // S3x changed this rule on purpose: with slow healing a hungry person heals too, only more slowly.
  it('a fed person heals; a hungry one heals more slowly (slow healing on)', () => {
    const a = lone(); a.w.people.injury[a.slot] = 100; a.w.people.energy[a.slot] = 90;
    const b = lone(); b.w.people.injury[b.slot] = 100; b.w.people.energy[b.slot] = 10;
    a.w.step(); b.w.step();
    expect(b.w.people.injury[b.slot]).toBeLessThan(100);
    expect(a.w.people.injury[a.slot]).toBeLessThan(b.w.people.injury[b.slot]);
  });

  it('a fed person heals; a hungry one does not (slow healing off)', () => {
    const a = lone({ slowHealEnabled: false }); a.w.people.injury[a.slot] = 100; a.w.people.energy[a.slot] = 90;
    const b = lone({ slowHealEnabled: false }); b.w.people.injury[b.slot] = 100; b.w.people.energy[b.slot] = 10;
    a.w.step(); b.w.step();
    expect(a.w.people.injury[a.slot]).toBeLessThan(100);
    expect(b.w.people.injury[b.slot]).toBe(100);
  });

  it('with injury off, nothing is wounded and the wound array stays zero', () => {
    const w = new World({ initialPopulation: 150, injuryEnabled: false }, 8);
    for (let t = 0; t < 150; t++) w.step();
    expect(w.people.injury.every((v) => v === 0)).toBe(true);
  });

  it('injury is capped, saved and hashed', () => {
    const a = new World({ initialPopulation: 200 }, 13);
    for (let t = 0; t < 150; t++) a.step();
    let max = 0; for (let s = 0; s < a.people.capacity; s++) max = Math.max(max, a.people.injury[s]);
    expect(max).toBeLessThanOrEqual(255);
    const slot = [...Array(a.people.capacity).keys()].find((s) => a.people.alive[s] === 1)!;
    const h0 = a.stateHash();
    a.people.injury[slot] += 5;
    expect(a.stateHash()).not.toBe(h0);
    a.people.injury[slot] -= 5;
    const b = World.fromState(JSON.parse(JSON.stringify(a.exportState())));
    expect(b.stateHash()).toBe(a.stateHash());
    for (let t = 0; t < 40; t++) { a.step(); b.step(); }
    expect(b.stateHash()).toBe(a.stateHash());
    expect(a.ledger.violations).toBe(0);
  });

  it('grave marks last graveTicks, then fade, and reach the viewer as kind 5', () => {
    const land = new Land(cfg);
    land.markDeath(12, 34, 3);
    let out = land.packFeatures(cfg);
    expect(Array.from(out.subarray(out.length - 3))).toEqual([12, 34, 5]);
    land.ageGraves(); land.ageGraves(); land.ageGraves();
    out = land.packFeatures(cfg);
    expect(out.length).toBe(0);
    expect(land.violentDeaths).toBe(1);
  });
});
