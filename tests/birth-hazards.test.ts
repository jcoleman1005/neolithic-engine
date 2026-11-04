import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';
import { DEFAULT_CONFIG } from '../src/sim/config';
import { FORM_NEST } from '../src/sim/land';

const WINTER_TICK = Math.round(0.875 * (DEFAULT_CONFIG.ticksPerYear || 360));

const loneFemale = (extra: Record<string, unknown> = {}) => {
  const w = new World({ initialPopulation: 1, elevationEnabled: false, terrainEnabled: false, coldEnabled: false, ...extra }, 42);
  w.step();
  const slot = [...Array(w.people.capacity).keys()].find((s) => w.people.alive[s] === 1)!;
  w.people.sex[slot] = 0; // Female
  w.people.injury[slot] = 0;
  w.people.prevDir[slot] = 4;
  return { w, slot };
};

describe('Deterministic childbirth hazards', () => {
  it('pregnant women pay a metabolic surcharge and the ledger balances', () => {
    const { w: wPreg, slot: sPreg } = loneFemale();
    wPreg.people.energy[sPreg] = 50;
    wPreg.people.pregnant[sPreg] = 50;
    wPreg.people.mateId[sPreg] = 123;
    const beforePreg = wPreg.ledger.upkeep;
    wPreg.step();
    const paidPreg = wPreg.ledger.upkeep - beforePreg;

    const { w: wNormal, slot: sNormal } = loneFemale();
    wNormal.people.energy[sNormal] = 50;
    wNormal.people.pregnant[sNormal] = -1;
    const beforeNormal = wNormal.ledger.upkeep;
    wNormal.step();
    const paidNormal = wNormal.ledger.upkeep - beforeNormal;

    expect(paidPreg).toBeGreaterThan(paidNormal);
    expect(paidPreg).toBeCloseTo(paidNormal * DEFAULT_CONFIG.pregnancyUpkeepMul, 3);
    expect(wPreg.ledger.violations).toBe(0);
  });

  it('severe starvation triggers miscarriage to protect maternal survival', () => {
    const { w, slot } = loneFemale({ pregnancyMiscarriageEnergy: 15.0 });
    w.people.energy[slot] = 14.0; // below miscarriage threshold
    w.people.pregnant[slot] = 100;
    w.people.mateId[slot] = 77;
    w.step();

    expect(w.people.pregnant[slot]).toBe(-1);
    expect(w.people.mateId[slot]).toBe(0);
    expect(w.ledger.violations).toBe(0);
  });

  it('delivery inflicts deterministic physical trauma on the mother', () => {
    const { w, slot } = loneFemale({ gestationTicks: 50, birthInjury: 40 });
    w.people.energy[slot] = 90.0;
    w.people.pregnant[slot] = 49; // about to deliver on next tick
    w.people.mateId[slot] = 999;
    w.people.injury[slot] = 0;

    const popBefore = w.people.count;
    w.step();

    expect(w.people.count).toBe(popBefore + 1);
    expect(w.people.pregnant[slot]).toBe(-1);
    expect(w.people.injury[slot]).toBe(40);
    expect(w.ledger.violations).toBe(0);
  });

  it('giving birth in a shelter reduces delivery trauma', () => {
    // Unsheltered birth
    const { w: wWild, slot: sWild } = loneFemale({ gestationTicks: 50, birthInjury: 40, birthShelterInjuryMul: 0.35 });
    wWild.people.energy[sWild] = 90.0;
    wWild.people.pregnant[sWild] = 49;
    wWild.people.mateId[sWild] = 999;
    wWild.step();

    // Sheltered birth (nest)
    const { w: wNest, slot: sNest } = loneFemale({ gestationTicks: 50, birthInjury: 40, birthShelterInjuryMul: 0.35 });
    const cell = (wNest.people.y[sNest] << 8) | wNest.people.x[sNest];
    wNest.land.form[cell] = FORM_NEST;
    wNest.people.energy[sNest] = 90.0;
    wNest.people.pregnant[sNest] = 49;
    wNest.people.mateId[sNest] = 999;
    wNest.step();

    expect(wWild.people.injury[sWild]).toBe(40);
    expect(wNest.people.injury[sNest]).toBe(40 * 0.35);
    expect(wNest.people.injury[sNest]).toBeLessThan(wWild.people.injury[sWild]);
  });

  it('cold unsheltered birth exacerbates trauma on mother and infant', () => {
    const { w, slot } = loneFemale({
      gestationTicks: 50,
      birthInjury: 40,
      birthColdInjuryMul: 1.5,
      coldEnabled: true,
    });
    // Set winter tick so Life.step computes cold < 0
    (w as unknown as { tick: number }).tick = WINTER_TICK;
    w.people.energy[slot] = 90.0;
    w.people.pregnant[slot] = 49;
    w.people.mateId[slot] = 999;

    w.step();

    expect(w.people.injury[slot]).toBeGreaterThan(40);
    // Find the infant
    const infantSlot = [...Array(w.people.capacity).keys()].find((s) => s !== slot && w.people.alive[s] === 1)!;
    expect(w.people.injury[infantSlot]).toBeGreaterThan(0);
    expect(w.ledger.violations).toBe(0);
  });

  it('exhausted mother failing delivery suffers complications and stamina loss', () => {
    const { w, slot } = loneFemale({
      gestationTicks: 50,
      birthExhaustionInjury: 20,
      reproductionThreshold: 65,
      childEnergy: 30,
      birthTax: 5,
    });
    // Total birth cost is 35; give her only 20 energy so delivery fails
    w.people.energy[slot] = 20.0;
    w.people.pregnant[slot] = 49;
    w.people.mateId[slot] = 999;

    const popBefore = w.people.count;
    const birthCostsBefore = w.ledger.birthCosts;
    w.step();

    // No baby born
    expect(w.people.count).toBe(popBefore);
    expect(w.people.pregnant[slot]).toBe(-1);
    expect(w.people.injury[slot]).toBe(20);
    expect(w.ledger.birthCosts).toBeGreaterThan(birthCostsBefore);
    expect(w.ledger.violations).toBe(0);
  });

  it('with birth hazards off, no extra upkeep or birth trauma applies', () => {
    const { w, slot } = loneFemale({ birthHazardsEnabled: false, gestationTicks: 50 });
    w.people.energy[slot] = 90.0;
    w.people.pregnant[slot] = 49;
    w.people.mateId[slot] = 999;
    w.step();

    expect(w.people.injury[slot]).toBe(0);
  });

  it('simulation continues deterministically and the ledger balances across multiple generations', () => {
    const w = new World({ initialPopulation: 150 }, 101);
    for (let t = 0; t < 250; t++) {
      w.step();
    }
    expect(w.ledger.violations).toBe(0);

    // Save / restore round trip
    const exported = JSON.parse(JSON.stringify(w.exportState()));
    const restored = World.fromState(exported);
    expect(restored.stateHash()).toBe(w.stateHash());

    for (let t = 0; t < 50; t++) {
      w.step();
      restored.step();
    }
    expect(restored.stateHash()).toBe(w.stateHash());
    expect(w.ledger.violations).toBe(0);
  });
});
