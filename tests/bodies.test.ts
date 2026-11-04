import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';
import { stageWork } from '../src/sim/people';
import { Rules } from '../src/sim/rules';

const lone = (extra: Record<string, unknown> = {}) => {
  const w = new World({ initialPopulation: 1, ...extra }, 21);
  w.step();
  const slot = [...Array(w.people.capacity).keys()].find((s) => w.people.alive[s] === 1)!;
  return { w, slot };
};

describe('Bodies: stages, childcare, fatigue and disease', () => {
  it('children and elders give less work than adults', () => {
    expect(stageWork(100, 5760, 16200, 0.6, 0.8)).toBe(0.6);
    expect(stageWork(8000, 5760, 16200, 0.6, 0.8)).toBe(1);
    expect(stageWork(17000, 5760, 16200, 0.6, 0.8)).toBe(0.8);
  });

  it('a child beside its mother costs her energy, and the ledger books it as upkeep', () => {
    const paid = (on: boolean) => {
      const w = new World({ initialPopulation: 0, childcareEnabled: on }, 5);
      const mom = w.people.spawn(100, 100, 80, 0, 1, 0, 0);
      const ms = mom >>> 12;
      w.people.age[ms] = 7000;
      const kid = w.people.spawn(101, 100, 80, 1, 1, mom, 0);
      w.people.age[kid >>> 12] = 100;
      const e0 = w.people.energy[ms];
      const u0 = w.ledger.upkeep;
      w.step();
      return { drop: e0 - w.people.energy[ms], upkeep: w.ledger.upkeep - u0 };
    };
    const on = paid(true);
    const off = paid(false);
    expect(on.upkeep).toBeGreaterThan(off.upkeep);
    expect(on.drop).toBeGreaterThan(off.drop);
  });

  it('a sick person pays more upkeep and recovers faster when fed', () => {
    const a = lone(); a.w.people.sick[a.slot] = 100; a.w.people.energy[a.slot] = 90;
    const b = lone(); b.w.people.sick[b.slot] = 100; b.w.people.energy[b.slot] = 10;
    a.w.step(); b.w.step();
    expect(a.w.people.sick[a.slot]).toBeLessThan(b.w.people.sick[b.slot]);
    const base = lone({ diseaseEnabled: false });
    const ill = lone(); ill.w.people.sick[ill.slot] = 100; ill.w.people.energy[ill.slot] = 10;
    const u0 = ill.w.ledger.upkeep; ill.w.step();
    const u1 = base.w.ledger.upkeep; base.w.step();
    expect(ill.w.ledger.upkeep - u0).toBeGreaterThan(base.w.ledger.upkeep - u1);
  });

  it('touch passes illness to a healthy neighbour when the chance is certain', () => {
    const w = new World({ initialPopulation: 0, sickSpread: 1.01 }, 6);
    const a = w.people.spawn(50, 50, 80, 0, 1, 0, 0) >>> 12;
    const b = w.people.spawn(50, 50, 80, 1, 1, 0, 0) >>> 12;
    w.people.sick[a] = 50;
    Rules.touch(a, b, w.people, w.land, w.fields, w.spatial, w.ledger, w.config, w.prng);
    expect(w.people.sick[b]).toBeGreaterThan(0);
  });

  it('with the switches off nothing is tired or sick', () => {
    const w = new World({ initialPopulation: 150, fatigueEnabled: false, diseaseEnabled: false }, 8);
    for (let t = 0; t < 300; t++) w.step();
    expect(w.people.fatigue.every((v) => v === 0)).toBe(true);
    expect(w.people.sick.every((v) => v === 0)).toBe(true);
  });

  it('fatigue and sickness survive a save round trip and change the state hash', () => {
    const w = new World({ initialPopulation: 40 }, 12);
    for (let t = 0; t < 50; t++) w.step();
    const slot = [...Array(w.people.capacity).keys()].find((s) => w.people.alive[s] === 1)!;
    const h0 = w.stateHash();
    w.people.fatigue[slot] = 77;
    w.people.sick[slot] = 33;
    expect(w.stateHash()).not.toBe(h0);
    const w2 = World.fromState(JSON.parse(JSON.stringify(w.exportState())));
    expect(w2.stateHash()).toBe(w.stateHash());
    expect(w2.people.fatigue[slot]).toBe(77);
    expect(w2.people.sick[slot]).toBe(33);
  });
});
