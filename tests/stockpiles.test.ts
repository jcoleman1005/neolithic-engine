import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';
import { Land, FORM_GRANARY, FORM_HEAP, FORM_NEST, FORM_NONE } from '../src/sim/land';
import { DEFAULT_CONFIG } from '../src/sim/config';
import { GENE_COUNT, GENE_STRENGTH } from '../src/sim/people';

const cfg = { ...DEFAULT_CONFIG, elevationEnabled: false, terrainEnabled: false };
const cell = (x: number, y: number) => (y << 8) | x;

describe('Phase 5c stockpiles and building', () => {
  it('dropping and taking food conserves it exactly, and a tile holds at most the cap', () => {
    const land = new Land(cfg);
    land.dropFood(10, 10, 30, cfg);
    expect(land.pile[cell(10, 10)]).toBe(30);
    expect(land.takePile(10, 10, 12)).toBe(12);
    expect(land.pile[cell(10, 10)]).toBe(18);
    expect(land.takePile(10, 10, 100)).toBe(18);
    expect(land.pile[cell(10, 10)]).toBe(0);
    land.dropFood(10, 10, 1e6, cfg);
    expect(land.pile[cell(10, 10)]).toBe(cfg.pileCap);
  });

  it('heaps spoil, and a granary floor spoils slower than a plain heap', () => {
    const land = new Land(cfg);
    land.pile[cell(5, 5)] = 40;
    land.pile[cell(6, 5)] = 40;
    land.compaction[cell(6, 5)] = cfg.compactionCap; // tamped hard: becomes a granary floor
    land.step(cfg); // sets the forms
    expect(land.form[cell(5, 5)]).toBe(FORM_HEAP);
    expect(land.form[cell(6, 5)]).toBe(FORM_GRANARY);
    for (let k = 0; k < 100; k++) land.step(cfg);
    expect(land.pile[cell(5, 5)]).toBeLessThan(40);
    expect(land.pile[cell(6, 5)]).toBeLessThan(40);
    expect(land.pile[cell(6, 5)]).toBeGreaterThan(land.pile[cell(5, 5)]);
  });

  it('a heap becomes a granary floor only when big AND compacted, and falls back when neglected', () => {
    const land = new Land(cfg);
    const i = cell(20, 20);
    land.pile[i] = 50;
    land.step(cfg);
    expect(land.form[i]).toBe(FORM_HEAP); // big but loose
    for (let k = 0; k < 100; k++) land.tamp(20, 20, cfg);
    land.pile[i] = 50;
    land.step(cfg);
    expect(land.form[i]).toBe(FORM_GRANARY);
    // Once the tamping has faded below the keep threshold the floor reverts to a plain heap.
    land.compaction[i] = cfg.granaryKeepCompaction * 0.5;
    land.step(cfg);
    expect(land.form[i]).toBe(FORM_HEAP);
    land.pile[i] = 0;
    land.step(cfg);
    expect(land.form[i]).toBe(FORM_NONE);
  });

  it('tamping adds compaction up to the cap', () => {
    const land = new Land(cfg);
    for (let k = 0; k < 500; k++) land.tamp(3, 3, cfg);
    expect(land.compaction[cell(3, 3)]).toBe(cfg.compactionCap);
  });

  it('carry is one kind at a time and stays within its limit through a run; the ledger balances', () => {
    const w = new World({ initialPopulation: 200 }, 6);
    for (let t = 0; t < 700; t++) w.step();
    let food = 0;
    for (let s = 0; s < w.people.capacity; s++) {
      if (w.people.alive[s] === 0) continue;
      const kind = w.people.carryKind[s];
      if (w.people.carry[s] > 0) expect(kind).not.toBe(0);
      // Food and brush limits scale with the person's strength gene; stage only ever lowers them.
      const body = 1 + (cfg.strengthCarry ?? 0.6) * (w.people.genes[s * GENE_COUNT + GENE_STRENGTH] / 255 - 0.5);
      if (kind === 2) { food++; expect(w.people.carry[s]).toBeLessThanOrEqual(cfg.foodCarryMax * body + 1e-4); }
      if (kind === 1) expect(w.people.carry[s]).toBeLessThanOrEqual(cfg.seedCarryMax + 1e-4);
      if (kind === 3) expect(w.people.carry[s]).toBeLessThanOrEqual(cfg.brushCarryMax * body + 1e-4);
    }
    expect(food).toBeGreaterThanOrEqual(0);
    for (let i = 0; i < 65536; i++) {
      expect(w.land.pile[i]).toBeLessThanOrEqual(cfg.pileCap + 1e-4);
      expect(w.land.compaction[i]).toBeLessThanOrEqual(cfg.compactionCap + 1e-4);
    }
    expect(w.ledger.violations).toBe(0);
  });

  it('with stockpiles off there are no heaps and nobody carries food', () => {
    const w = new World({ initialPopulation: 150, stockpilesEnabled: false }, 4);
    for (let t = 0; t < 400; t++) w.step();
    expect(w.land.pile.every((v) => v === 0)).toBe(true);
    expect(w.land.form.every((v) => v === 0)).toBe(true);
    for (let s = 0; s < w.people.capacity; s++) expect(w.people.carryKind[s]).not.toBe(2);
  });

  it('stockpile state survives a save round trip and the run continues identically', () => {
    const a = new World({ initialPopulation: 150 }, 12);
    for (let t = 0; t < 500; t++) a.step();
    const b = World.fromState(JSON.parse(JSON.stringify(a.exportState())));
    expect(b.stateHash()).toBe(a.stateHash());
    for (let t = 0; t < 100; t++) { a.step(); b.step(); }
    expect(b.stateHash()).toBe(a.stateHash());
  });

  it('structures pack heap size and form into one byte per cell', () => {
    const land = new Land(cfg);
    const i = cell(9, 9);
    land.pile[i] = cfg.pileScale;
    land.form[i] = FORM_GRANARY;
    const out = new Uint8Array(65536);
    land.packStructures(out, cfg);
    expect(out[i] & 7).toBe(7);
    expect((out[i] >> 3) & 3).toBe(FORM_GRANARY);
    expect(out[cell(1, 1)]).toBe(0);
  });
});

describe('Year 0 is primitive', () => {
  it('starts with zero structures, zero farmland, zero stockpiles and nobody carrying anything', () => {
    const w = new World({}, 3);
    const zero = (a: ArrayLike<number>) => Array.from({ length: a.length }, (_, i) => a[i]).every((v) => v === 0);
    expect(zero(w.land.pile)).toBe(true);
    expect(zero(w.land.brush)).toBe(true);
    expect(zero(w.land.compaction)).toBe(true);
    expect(zero(w.land.form)).toBe(true);
    expect(zero(w.land.tilled)).toBe(true);
    expect(zero(w.land.seeds)).toBe(true);
    expect(w.land.soilHealth.every((v) => v === 1)).toBe(true);
    expect(zero(w.people.carry)).toBe(true);
    expect(zero(w.people.carryKind)).toBe(true);
  });
});

describe('Phase 5c nests', () => {
  it('brush heaps cap, decay, and a nest decays slower than a loose brush heap', () => {
    const land = new Land(cfg);
    land.dropBrush(10, 10, 1e6, cfg);
    expect(land.brush[cell(10, 10)]).toBe(cfg.brushCap);
    land.brush[cell(20, 20)] = 40;
    land.brush[cell(22, 20)] = 40;
    land.compaction[cell(22, 20)] = cfg.compactionCap;
    land.step(cfg);
    expect(land.form[cell(20, 20)]).toBe(FORM_HEAP);
    expect(land.form[cell(22, 20)]).toBe(FORM_NEST);
    for (let k = 0; k < 100; k++) land.step(cfg);
    expect(land.brush[cell(20, 20)]).toBeLessThan(40);
    expect(land.brush[cell(22, 20)]).toBeGreaterThan(land.brush[cell(20, 20)]);
  });

  it('a nest needs brush AND compaction, and reverts when neglected', () => {
    const land = new Land(cfg);
    const i = cell(30, 30);
    land.brush[i] = 40;
    land.step(cfg);
    expect(land.form[i]).toBe(FORM_HEAP);
    for (let k = 0; k < 100; k++) land.tamp(30, 30, cfg);
    land.brush[i] = 40;
    land.step(cfg);
    expect(land.form[i]).toBe(FORM_NEST);
    land.compaction[i] = cfg.nestKeepCompaction * 0.5;
    land.step(cfg);
    expect(land.form[i]).toBe(FORM_HEAP);
    land.brush[i] = 0;
    land.step(cfg);
    expect(land.form[i]).toBe(FORM_NONE);
  });

  it('standing in a nest lowers upkeep', () => {
    const mk = (nest: boolean) => {
      const w = new World({ initialPopulation: 1, stockpilesEnabled: true }, 21);
      w.step(); // let the first tick settle so positions are known
      const slot = [...Array(w.people.capacity).keys()].find((s) => w.people.alive[s] === 1)!;
      if (nest) {
        const c = (w.people.y[slot] << 8) | w.people.x[slot];
        w.land.form[c] = FORM_NEST;
        w.land.brush[c] = 50;
        w.land.compaction[c] = cfg.compactionCap;
      }
      const before = w.ledger.upkeep;
      w.step();
      return w.ledger.upkeep - before;
    };
    expect(mk(true)).toBeLessThan(mk(false));
  });

  it('with nests off there is no brush gathering and no nest form', () => {
    const w = new World({ initialPopulation: 150, nestsEnabled: false }, 8);
    for (let t = 0; t < 400; t++) w.step();
    for (let s = 0; s < w.people.capacity; s++) expect(w.people.carryKind[s]).not.toBe(3);
    expect(w.land.brush.every((v) => v === 0)).toBe(true);
    expect(w.land.form.every((v) => v !== FORM_NEST)).toBe(true);
  });

  it('structures pack brush level alongside food level and form', () => {
    const land = new Land(cfg);
    const i = cell(9, 9);
    land.brush[i] = cfg.brushScale;
    land.form[i] = FORM_NEST;
    const out = new Uint8Array(65536);
    land.packStructures(out, cfg);
    expect(out[i] >> 5).toBe(7);
    expect((out[i] >> 3) & 3).toBe(FORM_NEST);
    expect(out[i] & 7).toBe(0);
  });
});
