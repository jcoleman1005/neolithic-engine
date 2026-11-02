import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';
import { Rules } from '../src/sim/rules';
import { People, GENE_COUNT, HABIT_COUNT, slotFromId } from '../src/sim/people';
import { Land } from '../src/sim/land';
import { ScentFields } from '../src/sim/fields';
import { PRNG } from '../src/sim/prng';
import { DEFAULT_CONFIG } from '../src/sim/config';

const base = { ...DEFAULT_CONFIG, elevationEnabled: false, terrainEnabled: false };

function setup(config = base, energy = 50) {
  const people = new People(10);
  const land = new Land(config);
  const fields = new ScentFields();
  const genes = new Uint8Array(GENE_COUNT).fill(128);
  const habits = new Uint8Array(HABIT_COUNT).fill(128);
  const id = people.spawn(10, 10, energy, 0, 0, 0, 0, genes, habits, 0);
  return { people, land, fields, slot: slotFromId(id) };
}

describe('Calm movement (Phase 4 fix)', () => {
  it('a person on a rich tile stays, even with food scent pulling east', () => {
    const { people, land, fields, slot } = setup();
    land.food[(10 << 8) | 10] = land.maxFood[(10 << 8) | 10];
    fields.depositFood(11, 10, 50);
    const prng = new PRNG(1);
    expect(Rules.climb(slot, people, land, fields, base, prng)).toBe(4);
  });

  it('a hungry person needs a richer tile before staying', () => {
    const cfg = { ...base, stayFoodFraction: 0.5, hungerStayPenalty: 0.5 };
    const fed = setup(cfg, 80);
    const hungry = setup(cfg, 10);
    for (const t of [fed, hungry]) {
      const cell = (10 << 8) | 10;
      t.land.food[cell] = 0.6 * t.land.maxFood[cell]; // above 0.5, below 0.75
      t.fields.depositFood(11, 10, 50);
    }
    expect(Rules.climb(fed.slot, fed.people, fed.land, fed.fields, cfg, new PRNG(1))).toBe(4);
    expect(Rules.climb(hungry.slot, hungry.people, hungry.land, hungry.fields, cfg, new PRNG(1))).not.toBe(4);
  });

  it('never steps straight back below the override, whatever the noise', () => {
    const cfg = { ...base, reversalOverride: 1e9 };
    const { people, land, fields, slot } = setup(cfg);
    land.food[(10 << 8) | 10] = 0; // poor tile: not a reason to stay
    people.prevDir[slot] = 1; // came from the east, moving west
    fields.depositFood(11, 10, 50); // pulls east = straight back
    const prng = new PRNG(3);
    for (let i = 0; i < 300; i++) {
      expect(Rules.climb(slot, people, land, fields, cfg, prng)).not.toBe(0);
    }
  });

  it('prevDir survives an export/import round trip and the run continues identically', () => {
    const a = new World({ initialPopulation: 150 }, 11);
    for (let t = 0; t < 200; t++) a.step();
    const b = World.fromState(JSON.parse(JSON.stringify(a.exportState())));
    expect(b.stateHash()).toBe(a.stateHash());
    for (let t = 0; t < 100; t++) { a.step(); b.step(); }
    expect(b.stateHash()).toBe(a.stateHash());
  });

  it('energy still balances with calm movement on', () => {
    const w = new World({ initialPopulation: 200 }, 5);
    for (let t = 0; t < 500; t++) w.step();
    expect(w.ledger.violations).toBe(0);
  });
});
