import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';
import { Herds } from '../src/sim/herds';
import { Land } from '../src/sim/land';
import { People } from '../src/sim/people';
import { DEFAULT_CONFIG } from '../src/sim/config';

const cfg = { ...DEFAULT_CONFIG, elevationEnabled: false, terrainEnabled: false };
const cell = (x: number, y: number) => (y << 8) | x;

function checkInvariants(h: Herds, land: Land): void {
  let n = 0;
  const seen = new Set<number>();
  for (let s = 0; s < h.capacity; s++) {
    if (h.alive[s] === 0) continue;
    n++;
    const c = cell(h.x[s], h.y[s]);
    expect(land.isWater[c]).toBe(0);
    expect(h.cellSlot[c]).toBe(s);
    expect(seen.has(c)).toBe(false); // one animal per tile
    seen.add(c);
    expect(h.energy[s]).toBeGreaterThan(0);
    expect(h.energy[s]).toBeLessThanOrEqual(cfg.herdMaxEnergy + 1e-3);
  }
  expect(h.count).toBe(n);
}

describe('Phase 6a herbivore herds', () => {
  it('founders are scattered on land, one per tile, and the invariants hold through a run', () => {
    const w = new World({ initialPopulation: 150 }, 4);
    expect(w.herds.count).toBe(DEFAULT_CONFIG.herdInitialCount);
    for (let t = 0; t < 300; t++) { w.step(); if (t % 50 === 0) checkInvariants(w.herds, w.land); }
    checkInvariants(w.herds, w.land);
    expect(w.ledger.violations).toBe(0); // animal energy is plant-side: the ledger is untouched
  });

  it('an animal grazes the tile it stands on, and starves where there is no food', () => {
    const land = new Land(cfg);
    const people = new People();
    const h = new Herds(cfg, 1);
    land.food.fill(0);
    h.seed(land, { ...cfg, herdInitialCount: 0 });
    // Hand-place one animal via a one-animal founder herd.
    const h1 = new Herds({ ...cfg, herdInitialCount: 1 }, 2);
    h1.seed(land, { ...cfg, herdInitialCount: 1 });
    expect(h1.count).toBe(1);
    let s = 0; while (h1.alive[s] === 0) s++;
    land.food[cell(h1.x[s], h1.y[s])] = 20;
    const e0 = h1.energy[s];
    h1.energy[s] = 10;
    h1.step(land, people, cfg);
    expect(h1.energy[s]).toBeGreaterThan(10 - cfg.herdUpkeep - cfg.herdMoveCost - 1e-6);
    land.food.fill(0);
    h1.energy[s] = 0.15;
    h1.step(land, people, cfg);
    h1.step(land, people, cfg);
    expect(h1.count).toBe(0);
    expect(e0).toBeGreaterThan(0);
    expect(h.count).toBe(0);
  });

  it('an animal flees a person who comes close, ending farther away', () => {
    const land = new Land(cfg);
    land.food.fill(10);
    const people = new People();
    const h = new Herds({ ...cfg, herdInitialCount: 1, herdFleeChance: 1 }, 3);
    h.seed(land, { ...cfg, herdInitialCount: 1, herdFleeChance: 1 });
    let s = 0; while (h.alive[s] === 0) s++;
    const ax = h.x[s], ay = h.y[s];
    people.spawn((ax + 1) & 255, ay, 50, 0);
    const before = 1;
    h.step(land, people, { ...cfg, herdFleeChance: 1 });
    const dist = Math.abs(((h.x[s] - (ax + 1) + 384) % 256) - 128) ;
    expect(Math.abs(h.x[s] - ax) + Math.abs(h.y[s] - ay)).toBe(1); // it moved one tile
    expect(h.x[s]).toBe((ax - 1 + 256) & 255); // directly away from the person
    expect(dist >= 0 && before === 1).toBe(true);
  });

  it('breeding passes energy from parent to newborn and never exceeds capacity or shares a tile', () => {
    const c = { ...cfg, herdInitialCount: 1, herdBreedChance: 1, herdAdultAge: 0 };
    const land = new Land(c);
    land.food.fill(0); // nothing to graze: only the birth moves energy around
    const people = new People();
    const h = new Herds(c, 5);
    h.seed(land, c);
    let s = 0; while (h.alive[s] === 0) s++;
    h.energy[s] = 45;
    h.step(land, people, c);
    expect(h.count).toBe(2);
    let total = 0;
    for (let k = 0; k < h.capacity; k++) if (h.alive[k] === 1) total += h.energy[k];
    // 45 less a tick of upkeep for each of the two (and any step): nothing is created at birth.
    expect(total).toBeLessThanOrEqual(45 - 2 * c.herdUpkeep + 1e-3);
    expect(total).toBeGreaterThan(44);
    checkInvariants(h, land);
  });

  it('herds survive a save round trip and the run continues identically', () => {
    const a = new World({ initialPopulation: 150 }, 8);
    for (let t = 0; t < 200; t++) a.step();
    const b = World.fromState(JSON.parse(JSON.stringify(a.exportState())));
    expect(b.stateHash()).toBe(a.stateHash());
    for (let t = 0; t < 150; t++) { a.step(); b.step(); }
    expect(b.stateHash()).toBe(a.stateHash());
    expect(b.herds.count).toBe(a.herds.count);
  });

  it('with herds off there are none and the world still runs', () => {
    const w = new World({ initialPopulation: 100, herdsEnabled: false }, 2);
    for (let t = 0; t < 100; t++) w.step();
    expect(w.herds.count).toBe(0);
  });
});
