import { describe, it, expect } from 'vitest';
import { World } from '../src/sim/world';
import { People } from '../src/sim/people';

// People.grow() replaces every typed array. LifeSystem.step caches those arrays in locals, so a
// birth that grew the arrays mid-tick used to send the rest of the tick's writes to the old ones:
// later mothers missed their gestation tick, and the mother who triggered it kept her mateId.

describe('capacity growth during a multi-birth tick', () => {
  it('reserve() grows only as far as needed and keeps existing people', () => {
    const p = new People(8);
    for (let i = 0; i < 8; i++) p.spawn(i, i, 50, 0);
    expect(p.freeCount).toBe(0);
    p.reserve(3);
    expect(p.capacity).toBe(16);
    expect(p.freeCount).toBe(8);
    p.reserve(2); // already enough: no change
    expect(p.capacity).toBe(16);
    expect(p.count).toBe(8);
    expect(p.energy[7]).toBe(50);
  });

  it('every mother who delivers on the tick the arrays grow keeps her new state', () => {
    // Exactly full: capacity 2048 with 2048 founders, so the first birth has no free slot.
    const w = new World({ initialPopulation: 2048 }, 1);
    const p = w.people;
    expect(p.capacity).toBe(2048);
    expect(p.freeCount).toBe(0);

    const gest = w.config.gestationTicks ?? 270;
    const mothers: number[] = [];
    const mateIds = new Map<number, number>();
    for (let s = 0; s < p.capacity && mothers.length < 20; s++) {
      if (p.alive[s] === 1 && p.sex[s] === 0) {
        p.pregnant[s] = gest - 1; // delivers this tick
        p.energy[s] = 99;
        p.mateId[s] = p.idOf(s ^ 1);
        mateIds.set(s, p.mateId[s]);
        mothers.push(s);
      }
    }
    expect(mothers.length).toBe(20);
    const before = p.count;

    w.step();

    const q = w.people; // same object, but its arrays were replaced
    expect(q.capacity).toBeGreaterThan(2048);
    expect(q.count).toBe(before + mothers.length);
    for (const s of mothers) {
      expect(q.alive[s], `mother ${s} alive`).toBe(1);
      expect(q.pregnant[s], `mother ${s} pregnant`).toBe(-1);
      expect(q.mateId[s], `mother ${s} mateId`).toBe(0);
      // Birth cost (child energy plus tax) came out of her, and the debit reached the live array.
      expect(q.energy[s], `mother ${s} energy`).toBeLessThan(99 - (w.config.childEnergy ?? 30) + 5);
    }
  });

  it('an identical world with room to spare gives the same mothers the same outcome', () => {
    const run = (extra: number) => {
      const w = new World({ initialPopulation: 1000 + extra }, 5);
      const p = w.people;
      const gest = w.config.gestationTicks ?? 270;
      const mothers: number[] = [];
      for (let s = 0; s < p.capacity && mothers.length < 10; s++) {
        if (p.alive[s] === 1 && p.sex[s] === 0) {
          p.pregnant[s] = gest - 1;
          p.energy[s] = 99;
          p.mateId[s] = p.idOf(s ^ 1);
          mothers.push(s);
        }
      }
      w.step();
      return mothers.map((s) => [w.people.pregnant[s], w.people.mateId[s]]);
    };
    // 1000 founders leave room in 2048 slots; 2048 force growth. Mothers' states must match.
    expect(run(1048)).toEqual(run(0));
  });
});
