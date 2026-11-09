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
  const w = new World({ initialPopulation: 0, wolfInitialCount: 0, thirstEnabled: false, coldEnabled: false, diseaseEnabled: false, fearEnabled: true, fearWoundsEnabled: true, contestEnabled: false, placeCostEnabled: false, ...config }, 4);
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
    expect(Rules.contest(bare.a, bare.b, 8, 5, 0.5, 0.5, 400, 400, bare.w.people, bare.w.land, bare.w.config)).toBe(0);
    const fed = two(100, 100, 30);
    expect(Rules.contest(fed.a, fed.b, 8, 5, 0.5, 0.5, 400, 400, fed.w.people, fed.w.land, fed.w.config)).toBe(0);
  });

  it('a much weaker defender yields; an even match is fought', () => {
    const { w, a, b } = two(30, 30, 40);
    expect(Rules.contest(a, b, 9, 3, 0.5, 0.5, 300, 300, w.people, w.land, w.config)).toBe(-1);
    expect(Rules.contest(a, b, 9, 8.8, 0.5, 0.5, 500, 500, w.people, w.land, w.config)).toBe(1);
  });

  it('risk appetite moves the threshold', () => {
    const { w, a, b } = two(40, 40, 30);
    expect(Rules.contest(a, b, 6, 6, 0.5, 0.5, 0, 0, w.people, w.land, w.config)).toBe(0);
    expect(Rules.contest(a, b, 6, 6, 0.5, 0.5, 510, 510, w.people, w.land, w.config)).not.toBe(0);
  });

  it('counts the real cost of a wound, higher when hungry (slower healing)', () => {
    const { w, a, b } = two(90, 10, 0);
    expect(Rules.woundCost(b, 60, w.people, w.config)).toBeGreaterThan(Rules.woundCost(a, 60, w.people, w.config));
    expect(Rules.woundCost(a, 60, w.people, w.config)).toBeCloseTo((0.25 * 0.3 * 3600) / (2 * 255 * 0.3), 6);
  });

  it('through a touch, a child gives way to an adult: steps off unhurt, nobody wounded (concession off)', () => {
    const { w, a, b } = two(30, 30, 40, 1000);
    (w.config as { concedeEnabled: boolean }).concedeEnabled = false;
    const g = new Uint8Array(GENE_COUNT).fill(255);
    w.people.genes.set(g, a * GENE_COUNT);
    w.spatial.build(w.people);
    const y0 = Rules.clashStats.yields;
    Rules.touch(a, b, w.people, w.land, w.fields, w.spatial, w.ledger, w.config, new PRNG(1));
    expect(Rules.clashStats.yields).toBe(y0 + 1);
    expect(w.people.injury[a]).toBe(0);
    expect(w.people.injury[b]).toBe(0);
    expect(w.people.energy[b]).toBeCloseTo(30 - (w.config.moveCost ?? 0.05), 5); // walking away is an ordinary paid step
  });

  it('with the contest and main\'s resource gate off, the old gate applies: two calm people never fight', () => {
    const w = empty({ fearEnabled: false, contestEnabled: false, resourceClashEnabled: false });
    w.land.food[(60 << 8) | 50] = 40;
    const hA = new Uint8Array(HABIT_COUNT).fill(0), hB = new Uint8Array(HABIT_COUNT).fill(255);
    hA[HABIT_BELLIGERENCE] = 0; hB[HABIT_BELLIGERENCE] = 0;
    const a = put(w, 50, 60, 30, hA), b = put(w, 50, 60, 30, hB);
    w.spatial.build(w.people);
    for (let i = 0; i < 20; i++) Rules.touch(a, b, w.people, w.land, w.fields, w.spatial, w.ledger, w.config, new PRNG(i));
    expect(w.people.injury[a] + w.people.injury[b]).toBe(0);
  });
});

describe('S3x contest refinements', () => {
  const pair = (cfg: Record<string, number | boolean>, eA = 40, eB = 40, food = 30): { w: World; a: number; b: number } => {
    const w = empty({ fearEnabled: false, contestEnabled: true, stockpilesEnabled: false, ...cfg });
    w.land.food[(60 << 8) | 50] = food;
    const a = put(w, 50, 60, eA, new Uint8Array(HABIT_COUNT).fill(0)), b = put(w, 50, 60, eB, new Uint8Array(HABIT_COUNT).fill(255));
    return { w, a, b };
  };

  it('residence: a resident defender fights back where a newcomer would give way (Bourgeois)', () => {
    // A is clearly stronger and attacks; B, the defender, weighs fighting back against giving up their share.
    const nr = pair({ selfAssessEnabled: false, residentValueMul: 3 });
    expect(Rules.contest(nr.a, nr.b, 7, 6, 0.6, 0.5, 400, 255, nr.w.people, nr.w.land, nr.w.config)).toBe(-1);
    const res = pair({ selfAssessEnabled: false, residentValueMul: 3 });
    res.w.people.restTicks[res.b] = 50; // B has been resting here
    expect(Rules.contest(res.a, res.b, 7, 6, 0.6, 0.5, 400, 255, res.w.people, res.w.land, res.w.config)).toBe(1);
  });

  it('residence: the rest counter grows while standing and resets on a step', () => {
    const w = empty({ fearEnabled: false, contestEnabled: true, climbEnabled: false });
    const s = put(w, 50, 50);
    w.people.restTicks[s] = 7;
    w.step();
    const moved = w.people.x[s] !== 50 || w.people.y[s] !== 50;
    expect(w.people.restTicks[s]).toBe(moved ? 0 : 8);
  });

  it('concession: the taker carries food away from plants then heaps, the defender stays unhurt, the ledger is untouched', () => {
    const w = empty({ fearEnabled: false, contestEnabled: true, stockpilesEnabled: true });
    const c = (60 << 8) | 50;
    w.land.food[c] = 4; // 3 above the grazing floor
    w.land.pile[c] = 5;
    const taker = put(w, 50, 60, 50);
    const meal0 = w.ledger.plantMeal;
    const got = Rules.concede(taker, w.people, w.land, w.config);
    expect(got).toBeCloseTo(8, 5);
    expect(w.people.carry[taker]).toBeCloseTo(8, 5);
    expect(w.land.food[c]).toBeCloseTo(1, 5);
    expect(w.land.pile[c]).toBeCloseTo(0, 5);
    expect(w.ledger.plantMeal).toBe(meal0);
  });

  it('concession: through a touch the weaker defender stays put and the attacker leaves carrying food', () => {
    const { w, a, b } = pair({ selfAssessEnabled: false, residenceEnabled: false, stockpilesEnabled: true }, 30, 30, 40);
    w.people.genes.set(new Uint8Array(GENE_COUNT).fill(255), a * GENE_COUNT);
    w.people.age[b] = 1000;
    w.spatial.build(w.people);
    const c0 = Rules.clashStats.concessions;
    Rules.touch(a, b, w.people, w.land, w.fields, w.spatial, w.ledger, w.config, new PRNG(1));
    expect(Rules.clashStats.concessions).toBe(c0 + 1);
    expect([w.people.x[b], w.people.y[b]]).toEqual([50, 60]);
    expect(w.people.injury[b]).toBe(0);
    expect(w.people.carry[a]).toBeGreaterThan(0);
  });

  it('match cost: harm is full for an even match and falls to the floor for a certain one', () => {
    const w = empty({});
    expect(Rules.matchMul(0.5, w.config)).toBeCloseTo(1, 9);
    expect(Rules.matchMul(1, w.config)).toBeCloseTo(0.25, 9);
    expect(Rules.matchMul(0, w.config)).toBeCloseTo(0.25, 9);
    expect(Rules.matchMul(1, empty({ matchCostEnabled: false }).config)).toBe(1);
  });

  it('match cost: a one-sided fight wounds the loser less than an even one', () => {
    const fightInjury = (strongA: number): number => {
      const { w, a, b } = pair({ selfAssessEnabled: false, residenceEnabled: false, concedeEnabled: false, contestEnabled: false, resourceClashEnabled: false, clashCourageEnabled: false }, 60, 60, 30);
      const g = new Uint8Array(GENE_COUNT).fill(128); g[GENE_CRUELTY] = 255;
      w.people.genes.set(g, a * GENE_COUNT); w.people.genes.set(g, b * GENE_COUNT);
      w.people.genes[a * GENE_COUNT] = strongA; w.people.genes[b * GENE_COUNT] = 128;
      w.people.habits[a * HABIT_COUNT + HABIT_BELLIGERENCE] = 255;
      w.spatial.build(w.people);
      Rules.touch(a, b, w.people, w.land, w.fields, w.spatial, w.ledger, w.config, new PRNG(2));
      return w.people.injury[a] + w.people.injury[b];
    };
    // With the contest off, match cost does not apply: both fights wound the same.
    expect(fightInjury(255)).toBeCloseTo(fightInjury(128), 5);
  });

  it('self-assessment: wins raise and losses lower confidence, which fades as computed and is clamped', () => {
    const w = empty({ fearEnabled: false, contestEnabled: true });
    const s = put(w, 50, 50);
    Rules.nowTick = 1000;
    Rules.shiftConfidence(s, 0.5, w.people, w.config);
    expect(Rules.confidenceNow(s, w.people, w.config)).toBeCloseTo(0.5, 9);
    Rules.nowTick = 1360;
    expect(Rules.confidenceNow(s, w.people, w.config)).toBeCloseTo(0.5 * Math.exp(-1), 6);
    Rules.shiftConfidence(s, -0.5, w.people, w.config);
    expect(Rules.confidenceNow(s, w.people, w.config)).toBeCloseTo(0.5 * Math.exp(-1) - 0.5, 6);
    Rules.shiftConfidence(s, 50, w.people, w.config);
    expect(Rules.confidenceNow(s, w.people, w.config)).toBe(5);
  });

  it('self-assessment: confidence moves the judged odds but not the fight itself', () => {
    const { w, a, b } = pair({ residenceEnabled: false });
    // Even match: a very confident A sees good odds and attacks; without confidence, A holds back.
    expect(Rules.contest(a, b, 6, 6, 0.5, 0.5, 255, 255, w.people, w.land, w.config)).toBe(0);
    Rules.nowTick = 0; w.people.confidence[a] = 5; w.people.confTick[a] = 0;
    expect(Rules.contest(a, b, 6, 6, 0.5, 0.5, 255, 255, w.people, w.land, w.config)).not.toBe(0);
  });

  it('self-assessment replaces the belligerence nudges on a fight', () => {
    const { w, a, b } = pair({ residenceEnabled: false, concedeEnabled: false, contestRiskWeight: 0.5 }, 30, 30, 40);
    const g = new Uint8Array(GENE_COUNT).fill(128); g[GENE_CRUELTY] = 255;
    w.people.genes.set(g, a * GENE_COUNT); w.people.genes.set(g, b * GENE_COUNT);
    w.people.habits[a * HABIT_COUNT + HABIT_BELLIGERENCE] = 255; w.people.habits[b * HABIT_COUNT + HABIT_BELLIGERENCE] = 255;
    const bellA = w.people.habits[a * HABIT_COUNT + HABIT_BELLIGERENCE], bellB = w.people.habits[b * HABIT_COUNT + HABIT_BELLIGERENCE];
    w.spatial.build(w.people);
    const f0 = Rules.clashStats.fights;
    Rules.touch(a, b, w.people, w.land, w.fields, w.spatial, w.ledger, w.config, new PRNG(5));
    expect(Rules.clashStats.fights).toBe(f0 + 1);
    expect(w.people.habits[a * HABIT_COUNT + HABIT_BELLIGERENCE]).toBe(bellA);
    expect(w.people.habits[b * HABIT_COUNT + HABIT_BELLIGERENCE]).toBe(bellB);
    expect(Math.abs(w.people.confidence[a]) + Math.abs(w.people.confidence[b])).toBeGreaterThan(0);
  });

  it('refinement state survives a save round trip and the run continues identically', () => {
    const a = new World({ initialPopulation: 300 }, 8);
    for (let t = 0; t < 400; t++) a.step();
    const b = World.fromState(JSON.parse(JSON.stringify(a.exportState())));
    expect(b.stateHash()).toBe(a.stateHash());
    for (let t = 0; t < 150; t++) { a.step(); b.step(); }
    expect(b.stateHash()).toBe(a.stateHash());
  });
});

// S3x unit A: the place cost (docs/SETTLEMENTS.md S3x item 2).
describe('S3x place cost', () => {
  const on = { fearEnabled: false, fearWoundsEnabled: false, placeCostEnabled: true };
  function fightPair(cfg: Record<string, number | boolean> = {}): { w: World; a: number; b: number } {
    const w = empty({ ...on, ...cfg });
    const hA = new Uint8Array(HABIT_COUNT).fill(0), hB = new Uint8Array(HABIT_COUNT).fill(255);
    hA[HABIT_BELLIGERENCE] = 255; hB[HABIT_BELLIGERENCE] = 255;
    const g = new Uint8Array(GENE_COUNT).fill(128); g[GENE_CRUELTY] = 255;
    const a = put(w, 50, 60, 60, hA, g), b = put(w, 50, 60, 60, hB, g);
    w.spatial.build(w.people);
    return { w, a, b };
  }

  it('a lost clash adds the energy actually lost; the win takes the loot off the winner\'s cost', () => {
    const { w, a, b } = fightPair();
    for (const s of [a, b]) { w.people.placeCost[s] = 5; w.people.costX[s] = 50; w.people.costY[s] = 60; }
    const eA = w.people.energy[a], eB = w.people.energy[b];
    Rules.touch(a, b, w.people, w.land, w.fields, w.spatial, w.ledger, w.config, new PRNG(1));
    const loser = w.people.energy[a] < eA ? a : b, winner = loser === a ? b : a;
    const lost = (loser === a ? eA : eB) - w.people.energy[loser];
    const gained = w.people.energy[winner] - (winner === a ? eA : eB);
    expect(lost).toBeGreaterThan(0);
    expect(gained).toBeGreaterThan(0);
    expect(w.people.placeCost[loser]).toBeCloseTo(5 + lost, 4);
    expect(w.people.placeCost[winner]).toBeCloseTo(Math.max(0, 5 - gained), 4);
  });

  it('a win never takes the cost below 0, and a win outside the region changes nothing', () => {
    const w = empty(on);
    const s = put(w, 10, 10);
    Rules.addPlaceCost(s, 10, 10, 10, w.people, w.config);
    Rules.addPlaceCost(s, 200, 200, -4, w.people, w.config);
    expect(w.people.placeCost[s]).toBe(10);
    Rules.addPlaceCost(s, 11, 10, -100, w.people, w.config);
    expect(w.people.placeCost[s]).toBe(0);
    Rules.addPlaceCost(s, 11, 10, -5, w.people, w.config);
    expect(w.people.placeCost[s]).toBe(0);
  });

  it('a loss inside costRadius adds and nudges the centre by size; a far loss starts a new region', () => {
    const w = empty(on);
    const s = put(w, 10, 10);
    Rules.addPlaceCost(s, 10, 10, 10, w.people, w.config);
    Rules.addPlaceCost(s, 14, 10, 10, w.people, w.config);
    expect(w.people.placeCost[s]).toBeCloseTo(20, 5);
    expect(w.people.costX[s]).toBe(12); // the new loss weighs 10 of 20
    Rules.addPlaceCost(s, 100, 100, 7, w.people, w.config);
    expect(w.people.placeCost[s]).toBeCloseTo(7, 5); // the old place is dropped
    expect([w.people.costX[s], w.people.costY[s]]).toEqual([100, 100]);
  });

  it('nudges the centre across the wrapped map edge', () => {
    const w = empty(on);
    const s = put(w, 0, 0);
    Rules.addPlaceCost(s, 254, 0, 10, w.people, w.config);
    Rules.addPlaceCost(s, 2, 0, 10, w.people, w.config);
    expect(w.people.placeCost[s]).toBeCloseTo(20, 5);
    expect(w.people.costX[s]).toBe(0);
  });

  it('fades by 1 / costMemoryTicks a tick', () => {
    const w = empty(on);
    const s = put(w, 150, 150, 90);
    Rules.addPlaceCost(s, 150, 150, 36, w.people, w.config);
    w.step();
    expect(w.people.placeCost[s]).toBeCloseTo(36 * (1 - 1 / 360), 4);
  });

  it('counts the expected cost as upkeep in the stay check, only inside the region', () => {
    const w = empty(on);
    const s = put(w, 50, 50, 90);
    const cell = (50 << 8) | 50;
    const max = w.land.capacityAt(cell, w.config);
    w.land.food[cell] = (max > 0 ? max : w.config.stayRefFood) * 0.6; // just worth staying: the need is half the capacity
    const stay = () => Rules.worthStaying(s, w.people, w.land, w.config, 1, 0.5, 0.5);
    expect(stay()).toBe(true);
    Rules.addPlaceCost(s, 50, 50, 90, w.people, w.config); // 0.25 a tick, the same as metabolism
    expect(Rules.placeCostUpkeep(s, w.people, w.config)).toBeCloseTo(0.25, 5);
    expect(stay()).toBe(false);
    w.people.costX[s] = 150; // the same cost, belonging to a place far away
    expect(Rules.placeCostUpkeep(s, w.people, w.config)).toBe(0);
    expect(stay()).toBe(true);
  });

  it('a shelter holds only while the cold upkeep it saves exceeds the cost', () => {
    const w = empty({ ...on, coldEnabled: true });
    const s = put(w, 50, 50, 90);
    const cell = (50 << 8) | 50;
    w.land.cave[cell] = 1;
    w.land.coldAt = () => 0.9; // force a cold tile; the cold rule reads coldAt
    const saved = w.config.metabolismCost * w.config.coldUpkeep * 0.9;
    Rules.addPlaceCost(s, 50, 50, saved * 360 * 0.5, w.people, w.config);
    expect(Rules.shelterOutweighsCost(s, cell, w.people, w.land, w.config)).toBe(true);
    expect(Rules.climb(s, w.people, w.land, w.fields, w.config, new PRNG(3))).toBe(4);
    w.people.placeCost[s] = saved * 360 * 2;
    expect(Rules.shelterOutweighsCost(s, cell, w.people, w.land, w.config)).toBe(false);
  });

  it('a costly place stops the cold rule walking someone back to a shelter in it', () => {
    const w = empty({ ...on, coldEnabled: true });
    const s = put(w, 51, 50, 90); // one tile east of a cave
    const cave = (50 << 8) | 50, here = (50 << 8) | 51;
    w.land.cave[cave] = 1;
    w.land.coldAt = () => 0.9;
    w.land.warmDist.fill(255);
    w.land.warmDist[cave] = 0;
    w.land.warmDist[here] = 1;
    const saved = w.config.metabolismCost * w.config.coldUpkeep * 0.9;
    Rules.addPlaceCost(s, 50, 50, saved * 360 * 0.5, w.people, w.config);
    expect(Rules.climb(s, w.people, w.land, w.fields, w.config, new PRNG(3))).toBe(1); // west, into the cave
    w.people.placeCost[s] = saved * 360 * 2;
    expect(Rules.climb(s, w.people, w.land, w.fields, w.config, new PRNG(3))).not.toBe(1);
  });

  it('a child with no parent near learns from the nearest adult, more slowly than from a parent', () => {
    const w = empty({ ...on, costChildLearn: 0.1, costAdultLearn: 0.05, decisionStaggerInterval: 1 });
    const stranger = put(w, 50, 50, 90);
    const kidNearStranger = put(w, 52, 50, 90, undefined, undefined, 100);
    const mom = put(w, 120, 120, 90);
    const kidNearMom = put(w, 122, 120, 90, undefined, undefined, 100, w.people.idOf(mom));
    Rules.addPlaceCost(stranger, 30, 30, 50, w.people, w.config);
    Rules.addPlaceCost(mom, 30, 30, 50, w.people, w.config);
    w.step();
    const fromAdult = w.people.placeCost[kidNearStranger], fromParent = w.people.placeCost[kidNearMom];
    expect(fromAdult).toBeGreaterThan(0.05 * 50 * (1 - 1 / 360) - 1e-4);
    expect(fromAdult).toBeLessThan(0.05 * 50 + 1e-4);
    expect(fromParent).toBeGreaterThan(fromAdult);
    expect([w.people.costX[kidNearStranger], w.people.costY[kidNearStranger]]).toEqual([30, 30]);
  });

  it('a child near a parent learns the parent\'s view; an orphan\'s memory only fades', () => {
    const w = empty({ ...on, costChildLearn: 0.1 });
    const mom = put(w, 50, 50, 90);
    const kid = put(w, 51, 50, 90, undefined, undefined, 100, w.people.idOf(mom));
    const orphan = put(w, 150, 150, 90, undefined, undefined, 100);
    Rules.addPlaceCost(mom, 30, 30, 50, w.people, w.config);
    Rules.addPlaceCost(orphan, 150, 150, 50, w.people, w.config);
    w.step();
    const momNow = w.people.placeCost[mom];
    expect(momNow).toBeCloseTo(50 * (1 - 1 / 360), 4);
    // The kid learns from the mother's memory before or after her fade this tick, by slot order.
    expect(w.people.placeCost[kid]).toBeGreaterThan(0.1 * momNow - 1e-4);
    expect(w.people.placeCost[kid]).toBeLessThan(0.1 * 50 + 1e-4);
    expect([w.people.costX[kid], w.people.costY[kid]]).toEqual([30, 30]);
    expect(w.people.placeCost[orphan]).toBeCloseTo(50 * (1 - 1 / 360), 4);
  });

  it('resets on kill and slot reuse', () => {
    const w = empty(on);
    const s = put(w, 10, 10);
    Rules.addPlaceCost(s, 10, 10, 10, w.people, w.config);
    w.people.kill(s);
    const t = put(w, 20, 20);
    expect(t).toBe(s);
    expect([w.people.placeCost[t], w.people.costX[t], w.people.costY[t]]).toEqual([0, 0, 0]);
  });

  it('with the switch off: no cost is kept, the clash draws the same numbers and ends the same', () => {
    const runOne = (placeCostEnabled: boolean) => {
      const { w, a, b } = fightPair({ placeCostEnabled });
      const prng = new PRNG(1);
      Rules.touch(a, b, w.people, w.land, w.fields, w.spatial, w.ledger, w.config, prng);
      return { e: [w.people.energy[a], w.people.energy[b]], cost: w.people.placeCost[a] + w.people.placeCost[b], next: prng.next() };
    };
    const off = runOne(false), onRun = runOne(true);
    expect(off.cost).toBe(0);
    expect(onRun.cost).toBeGreaterThan(0);
    expect(off.e).toEqual(onRun.e);
    expect(off.next).toBe(onRun.next);
    const w = new World({ initialPopulation: 300, placeCostEnabled: false }, 8);
    for (let t = 0; t < 300; t++) w.step();
    expect(w.people.placeCost.every((v) => v === 0)).toBe(true);
  });

  it('place-cost state survives a save round trip and the run continues identically', () => {
    const a = new World({ initialPopulation: 300, placeCostEnabled: true }, 8);
    for (let t = 0; t < 400; t++) a.step();
    expect(a.people.placeCost.some((v) => v > 0)).toBe(true);
    const b = World.fromState(JSON.parse(JSON.stringify(a.exportState())));
    expect(Array.from(b.people.placeCost)).toEqual(Array.from(a.people.placeCost));
    expect(b.stateHash()).toBe(a.stateHash());
    for (let t = 0; t < 150; t++) { a.step(); b.step(); }
    expect(b.stateHash()).toBe(a.stateHash());
  });
});
