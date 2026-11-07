import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';
import { slotFromId } from '../src/sim/people';

/** One wounded person alone on bare, dry, open land; returns how much the wound healed in one tick. */
function healOneTick(energy: number, config: Record<string, number | boolean>, shelter = false): number {
  const w = new World({ initialPopulation: 0, wolfInitialCount: 0, thirstEnabled: false, coldEnabled: false, diseaseEnabled: false, ...config }, 4);
  w.land.isWater.fill(0);
  w.land.food.fill(0);
  const s = slotFromId(w.people.spawn(100, 100, energy, 1, 0, 0, 0, new Uint8Array(8), new Uint8Array(8), 0));
  w.people.age[s] = 8000;
  if (shelter) w.land.cave[(100 << 8) | 100] = 1;
  w.people.injury[s] = 100;
  w.step();
  return 100 - w.people.injury[s];
}

describe('S3x slow healing', () => {
  it('heals a hungry person, more slowly than a fed one', () => {
    const hungry = healOneTick(10, {});
    const fed = healOneTick(90, {});
    expect(hungry).toBeGreaterThan(0);
    expect(hungry).toBeLessThan(fed);
    expect(fed).toBeCloseTo(0.3, 5); // full rate above injuryHealEnergy, as before
  });

  it('heals faster on a sheltered tile', () => {
    expect(healOneTick(90, {}, true)).toBeCloseTo(0.3 * 1.5, 5);
    expect(healOneTick(10, {}, true)).toBeGreaterThan(healOneTick(10, {}));
  });

  it('keeps the old rule with the switch off: no healing below half energy, no shelter bonus', () => {
    expect(healOneTick(10, { slowHealEnabled: false })).toBe(0);
    expect(healOneTick(90, { slowHealEnabled: false }, true)).toBeCloseTo(0.3, 5);
  });
});

import { Rules } from '../src/sim/rules';
import { PRNG } from '../src/sim/prng';
import { GENE_COUNT, GENE_CRUELTY, HABIT_BELLIGERENCE, HABIT_COUNT } from '../src/sim/people';

/** An empty open world; people are placed by hand. */
function empty(config: Record<string, number | boolean> = {}): World {
  const w = new World({ initialPopulation: 0, wolfInitialCount: 0, thirstEnabled: false, coldEnabled: false, diseaseEnabled: false, fearEnabled: true, fearWoundsEnabled: true, contestEnabled: false, ...config }, 4);
  w.land.isWater.fill(0);
  w.land.food.fill(0);
  w.fields.reset();
  return w;
}
function put(w: World, x: number, y: number, energy = 60, habits = new Uint8Array(HABIT_COUNT), genes = new Uint8Array(GENE_COUNT), age = 8000, mom = 0): number {
  const s = slotFromId(w.people.spawn(x, y, energy, 1, 0, mom, 0, genes, habits, 0));
  w.people.age[s] = age;
  return s;
}

// The first fear design, replaced by the place cost and off by default; tested with it switched on.
describe('S3x fear (replaced, switched on here)', () => {
  it('only the loser of a clash gains fear, centred where they lost', () => {
    const w = empty();
    const hA = new Uint8Array(HABIT_COUNT).fill(0), hB = new Uint8Array(HABIT_COUNT).fill(255);
    hA[HABIT_BELLIGERENCE] = 255; hB[HABIT_BELLIGERENCE] = 255;
    const g = new Uint8Array(GENE_COUNT).fill(128); g[GENE_CRUELTY] = 255;
    const a = put(w, 50, 60, 60, hA, g), b = put(w, 50, 60, 60, hB, g);
    w.spatial.build(w.people);
    Rules.touch(a, b, w.people, w.land, w.fields, w.spatial, w.ledger, w.config, new PRNG(1));
    const loser = w.people.energy[a] < w.people.energy[b] ? a : b, winner = loser === a ? b : a;
    expect(w.people.fear[loser]).toBe(60);
    expect(w.people.fear[winner]).toBe(0);
    expect([w.people.fearX[loser], w.people.fearY[loser]]).toEqual([50, 60]);
  });

  it('stacks losses inside the radius and draws the centre toward the new one; a loss far away keeps half', () => {
    const w = empty();
    const s = put(w, 10, 10);
    Rules.addFear(s, 10, 10, w.people, w.config);
    Rules.addFear(s, 14, 10, w.people, w.config);
    expect(w.people.fear[s]).toBe(120);
    expect(w.people.fearX[s]).toBe(12); // halfway: the new loss weighs 60 of 120
    Rules.addFear(s, 100, 100, w.people, w.config);
    expect(w.people.fear[s]).toBe(120); // 120 / 2 + 60
    expect([w.people.fearX[s], w.people.fearY[s]]).toEqual([100, 100]);
  });

  it('stacks across the wrapped map edge', () => {
    const w = empty();
    const s = put(w, 0, 0);
    Rules.addFear(s, 254, 0, w.people, w.config);
    Rules.addFear(s, 2, 0, w.people, w.config);
    expect(w.people.fear[s]).toBe(120);
    expect(w.people.fearX[s]).toBe(0);
  });

  it('fades slowly inside the region and faster outside', () => {
    const w = empty({ fearChildParentDecay: 0, fearChildAdultDecay: 0 });
    const inside = put(w, 50, 50), out = put(w, 150, 150);
    Rules.addFear(inside, 50, 50, w.people, w.config);
    Rules.addFear(out, 50, 50, w.people, w.config);
    w.people.x[out] = 150; w.people.y[out] = 150;
    w.step();
    expect(60 - w.people.fear[inside]).toBeCloseTo(0.02, 4);
    expect(60 - w.people.fear[out]).toBeCloseTo(0.3, 4);
  });

  it('calms a child fastest near a parent, less near an allied adult, not at all near a stranger', () => {
    const lost = (setup: (w: World, child: number) => void): number => {
      const w = empty({ decisionStaggerInterval: 1 });
      const child = put(w, 150, 150, 60, undefined, undefined, 100);
      setup(w, child);
      w.people.fear[child] = 100; w.people.fearX[child] = 10; w.people.fearY[child] = 10; // feared place far away
      w.step();
      return 100 - w.people.fear[child];
    };
    const alone = lost(() => {});
    const parent = lost((w, c) => { const m = put(w, 153, 150); w.people.motherId[c] = w.people.idOf(m); });
    const ally = lost((w, c) => { const m = put(w, 151, 150); const k = put(w, 151, 150, 60, undefined, undefined, 8000); w.people.motherId[k] = w.people.idOf(m); w.people.motherId[c] = w.people.idOf(m); w.people.x[m] = 10; w.people.y[m] = 200; });
    const stranger = lost((w) => { put(w, 151, 150); });
    expect(parent).toBeGreaterThan(ally);
    expect(ally).toBeGreaterThan(alone);
    expect(stranger).toBeCloseTo(alone, 6);
  });

  it('pushes a frightened person away from the centre, never into water; on the centre they keep their heading', () => {
    const w = empty({ calmMovementEnabled: false, climbEnabled: true });
    const s = put(w, 52, 50);
    w.people.fear[s] = 255; w.people.fearX[s] = 50; w.people.fearY[s] = 50;
    const rng = new PRNG(3);
    expect(Rules.climb(s, w.people, w.land, w.fields, w.config, rng)).toBe(0); // east, away
    w.land.isWater[(50 << 8) | 53] = 1;
    const d = Rules.climb(s, w.people, w.land, w.fields, w.config, new PRNG(3));
    expect([2, 3]).toContain(d); // sidesteps, not into water and not back west
    w.people.x[s] = 50; w.people.prevDir[s] = 2;
    expect(Rules.climb(s, w.people, w.land, w.fields, w.config, new PRNG(3))).toBe(2);
  });

  it('raises what staying needs only inside the region', () => {
    const w = empty();
    const s = put(w, 50, 50);
    expect(Rules.fearStayMul(s, w.people, w.config)).toBe(1);
    w.people.fear[s] = 255; w.people.fearX[s] = 50; w.people.fearY[s] = 50;
    expect(Rules.fearStayMul(s, w.people, w.config)).toBeCloseTo(3, 6);
    w.people.x[s] = 70;
    expect(Rules.fearStayMul(s, w.people, w.config)).toBe(1);
  });

  it('is cleared when the person dies and the slot is reused', () => {
    const w = empty();
    const s = put(w, 50, 50);
    Rules.addFear(s, 50, 50, w.people, w.config);
    w.people.kill(s);
    const t = put(w, 50, 50);
    expect(t).toBe(s);
    expect(w.people.fear[t]).toBe(0);
  });

  it('survives a save round trip and the run continues identically', () => {
    const a = new World({ initialPopulation: 300, fearEnabled: true, contestEnabled: false }, 8);
    for (let t = 0; t < 400; t++) a.step();
    let afraid = 0;
    for (let s = 0; s < a.people.capacity; s++) if (a.people.alive[s] && a.people.fear[s] > 0) afraid++;
    expect(afraid).toBeGreaterThan(0);
    const b = World.fromState(JSON.parse(JSON.stringify(a.exportState())));
    expect(b.stateHash()).toBe(a.stateHash());
    for (let t = 0; t < 150; t++) { a.step(); b.step(); }
    expect(b.stateHash()).toBe(a.stateHash());
  });
});

describe('S3x contest', () => {
  const two = (eA: number, eB: number, food: number, ageB = 8000): { w: World; a: number; b: number } => {
    const w = empty({ fearEnabled: false, contestEnabled: true, stockpilesEnabled: false });
    w.land.food[(60 << 8) | 50] = food;
    const hA = new Uint8Array(HABIT_COUNT).fill(0), hB = new Uint8Array(HABIT_COUNT).fill(255);
    const a = put(w, 50, 60, eA, hA), b = put(w, 50, 60, eB, hB, undefined, ageB);
    return { w, a, b };
  };

  it('gives the exact odds of the noisy fight score', () => {
    expect(Rules.winChance(0)).toBeCloseTo(0.5, 9);
    expect(Rules.winChance(1)).toBeCloseTo(0.875, 9);
    expect(Rules.winChance(-1)).toBeCloseTo(0.125, 9);
    expect(Rules.winChance(2)).toBe(1);
    expect(Rules.winChance(-3)).toBe(0);
  });

  it('nobody fights with nothing at stake, or over food neither can eat', () => {
    const bare = two(30, 30, 0);
    expect(Rules.contest(bare.a, bare.b, 8, 5, 400, 400, bare.w.people, bare.w.land, bare.w.config)).toBe(0);
    const fed = two(100, 100, 30);
    expect(Rules.contest(fed.a, fed.b, 8, 5, 400, 400, fed.w.people, fed.w.land, fed.w.config)).toBe(0);
  });

  it('a much weaker defender yields; an even match is fought', () => {
    const { w, a, b } = two(30, 30, 40);
    expect(Rules.contest(a, b, 9, 3, 300, 300, w.people, w.land, w.config)).toBe(-1);
    expect(Rules.contest(a, b, 9, 8.8, 500, 500, w.people, w.land, w.config)).toBe(1);
  });

  it('risk appetite moves the threshold', () => {
    const { w, a, b } = two(40, 40, 30);
    expect(Rules.contest(a, b, 6, 6, 0, 0, w.people, w.land, w.config)).toBe(0);
    expect(Rules.contest(a, b, 6, 6, 510, 510, w.people, w.land, w.config)).not.toBe(0);
  });

  it('counts the real cost of a wound, higher when hungry (slower healing)', () => {
    const { w, a, b } = two(90, 10, 0);
    expect(Rules.woundCost(b, 60, w.people, w.config)).toBeGreaterThan(Rules.woundCost(a, 60, w.people, w.config));
    expect(Rules.woundCost(a, 60, w.people, w.config)).toBeCloseTo((0.25 * 0.3 * 3600) / (2 * 255 * 0.3), 6);
  });

  it('through a touch, a child gives way to an adult: steps off unhurt, nobody wounded', () => {
    const { w, a, b } = two(30, 30, 40, 1000);
    const g = new Uint8Array(GENE_COUNT).fill(255);
    w.people.genes.set(g, a * GENE_COUNT);
    w.spatial.build(w.people);
    const y0 = Rules.clashStats.yields;
    Rules.touch(a, b, w.people, w.land, w.fields, w.spatial, w.ledger, w.config, new PRNG(1));
    expect(Rules.clashStats.yields).toBe(y0 + 1);
    expect(w.people.injury[a]).toBe(0);
    expect(w.people.injury[b]).toBe(0);
    expect(w.people.energy[b]).toBe(30);
  });

  it('with the switch off the old gate applies: two calm people never fight', () => {
    const w = empty({ fearEnabled: false, contestEnabled: false });
    w.land.food[(60 << 8) | 50] = 40;
    const hA = new Uint8Array(HABIT_COUNT).fill(0), hB = new Uint8Array(HABIT_COUNT).fill(255);
    hA[HABIT_BELLIGERENCE] = 0; hB[HABIT_BELLIGERENCE] = 0;
    const a = put(w, 50, 60, 30, hA), b = put(w, 50, 60, 30, hB);
    w.spatial.build(w.people);
    for (let i = 0; i < 20; i++) Rules.touch(a, b, w.people, w.land, w.fields, w.spatial, w.ledger, w.config, new PRNG(i));
    expect(w.people.injury[a] + w.people.injury[b]).toBe(0);
  });
});
