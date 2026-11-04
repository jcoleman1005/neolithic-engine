import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';
import { Wolves } from '../src/sim/wolves';
import { Herds } from '../src/sim/herds';
import { Land } from '../src/sim/land';
import { People } from '../src/sim/people';
import { ScentFields } from '../src/sim/fields';
import { EnergyLedger } from '../src/sim/ledger';
import { DEFAULT_CONFIG } from '../src/sim/config';

const cfg = { ...DEFAULT_CONFIG, elevationEnabled: false, terrainEnabled: false, wolfInitialCount: 1, herdInitialCount: 0, wolfPersist: 1 };
const cell = (x: number, y: number) => (y << 8) | x;

function oneWolf(c = cfg) {
  const land = new Land(c);
  land.food.fill(5);
  const people = new People();
  const herds = new Herds(c, 1);
  const wolves = new Wolves(c, 2);
  wolves.seed(land, c);
  let s = 0; while (wolves.alive[s] === 0) s++;
  return { land, people, herds, wolves, s, fields: new ScentFields(), ledger: new EnergyLedger() };
}

describe('Phase 6a wolves', () => {
  it('founders are scattered on land, one per tile, and the invariants hold through a run', () => {
    const w = new World({ initialPopulation: 150 }, 4);
    expect(w.wolves.count).toBe(DEFAULT_CONFIG.wolfInitialCount);
    for (let t = 0; t < 300; t++) w.step();
    let n = 0;
    const seen = new Set<number>();
    for (let s = 0; s < w.wolves.capacity; s++) {
      if (w.wolves.alive[s] === 0) continue;
      n++;
      const c = cell(w.wolves.x[s], w.wolves.y[s]);
      expect(w.land.isWater[c]).toBe(0);
      expect(w.wolves.cellSlot[c]).toBe(s);
      expect(seen.has(c)).toBe(false);
      seen.add(c);
      expect(w.wolves.energy[s]).toBeGreaterThan(0);
      expect(w.wolves.energy[s]).toBeLessThanOrEqual(DEFAULT_CONFIG.wolfMaxEnergy + 1e-3);
    }
    expect(w.wolves.count).toBe(n);
    expect(w.ledger.violations).toBe(0);
  });

  it('a wolf leaves danger scent where it stands', () => {
    const { land, people, herds, wolves, s, fields, ledger } = oneWolf();
    const x0 = wolves.x[s], y0 = wolves.y[s];
    wolves.step(land, people, herds, fields, ledger, cfg);
    expect(fields.getDanger(x0, y0)).toBeCloseTo(cfg.wolfDanger, 5); // left where it started the tick
  });

  it('a wolf kills adjacent prey, gains its energy, and leaves a meat heap and a carcass', () => {
    const c = { ...cfg, wolfKillChance: 1, herdInitialCount: 1 };
    const { land, people, wolves, s, fields, ledger } = oneWolf(c);
    const herds = new Herds(c, 3);
    herds.seed(land, c);
    let h = 0; while (herds.alive[h] === 0) h++;
    // Put the animal beside the wolf.
    const tx = (wolves.x[s] + 1) & 255, ty = wolves.y[s];
    const old = (herds.y[h] << 8) | herds.x[h];
    herds.cellSlot[old] = -1;
    herds.x[h] = tx; herds.y[h] = ty; herds.cellSlot[cell(tx, ty)] = h;
    herds.energy[h] = 40;
    wolves.energy[s] = 30;
    wolves.step(land, people, herds, fields, ledger, c);
    expect(herds.count).toBe(0);
    expect(wolves.killedHerd).toBe(1);
    expect(wolves.energy[s]).toBeGreaterThan(30 + 40 * 1.2 - 5);
    expect(land.pile[cell(tx, ty)]).toBeCloseTo(40 * c.wolfLeaveMeat, 3);
    expect(herds.carcassLeft.some((v) => v > 0)).toBe(true);
  });

  it('a wolf bites a lone person beside it (energy taken, wounded) but leaves two together alone', () => {
    const c = { ...cfg, wolfAttackChance: 1 };
    const a = oneWolf(c);
    a.people.spawn((a.wolves.x[a.s] + 1) & 255, a.wolves.y[a.s], 50, 0);
    a.ledger.begin(a.people.totalEnergy(), 0);
    a.wolves.step(a.land, a.people, a.herds, a.fields, a.ledger, c);
    expect(a.people.count).toBe(1);
    expect(a.wolves.killedPeople).toBe(0);
    expect(a.ledger.deathFat).toBeCloseTo(c.wolfBiteEnergy, 3);
    const slot = [...Array(a.people.capacity).keys()].find((k) => a.people.alive[k] === 1)!;
    expect(a.people.energy[slot]).toBeCloseTo(50 - c.wolfBiteEnergy, 3);
    expect(a.people.injury[slot]).toBe(c.wolfInjury);

    const weak = oneWolf(c);
    weak.people.spawn((weak.wolves.x[weak.s] + 1) & 255, weak.wolves.y[weak.s], 10, 0);
    weak.wolves.step(weak.land, weak.people, weak.herds, weak.fields, weak.ledger, c);
    expect(weak.people.count).toBe(0);
    expect(weak.wolves.killedPeople).toBe(1);
    expect(weak.land.violentDeaths).toBe(1);

    const b = oneWolf(c);
    b.people.spawn((b.wolves.x[b.s] + 1) & 255, b.wolves.y[b.s], 50, 0);
    b.people.spawn((b.wolves.x[b.s] + 1) & 255, b.wolves.y[b.s], 50, 1);
    b.wolves.step(b.land, b.people, b.herds, b.fields, b.ledger, c);
    expect(b.people.count).toBe(2);
  });

  it('a wolf starves without prey', () => {
    const { land, people, herds, wolves, s, fields, ledger } = oneWolf();
    wolves.energy[s] = 0.2;
    for (let t = 0; t < 10 && wolves.count > 0; t++) wolves.step(land, people, herds, fields, ledger, cfg);
    expect(wolves.count).toBe(0);
  });

  it('herd animals flee a wolf', () => {
    const c = { ...cfg, herdInitialCount: 1, herdFleeChance: 1 };
    const { land, people, wolves, s } = oneWolf(c);
    const herds = new Herds(c, 3);
    herds.seed(land, c);
    let h = 0; while (herds.alive[h] === 0) h++;
    const ax = herds.x[h], ay = herds.y[h];
    // Move the wolf next to the animal.
    wolves.cellSlot[cell(wolves.x[s], wolves.y[s])] = -1;
    wolves.x[s] = (ax + 1) & 255; wolves.y[s] = ay; wolves.cellSlot[cell(wolves.x[s], ay)] = s;
    herds.step(land, people, c, wolves);
    expect(herds.x[h]).toBe((ax - 1 + 256) & 255);
  });

  it('wolves survive a save round trip and the run continues identically', () => {
    const a = new World({ initialPopulation: 150 }, 8);
    for (let t = 0; t < 200; t++) a.step();
    const b = World.fromState(JSON.parse(JSON.stringify(a.exportState())));
    expect(b.stateHash()).toBe(a.stateHash());
    for (let t = 0; t < 150; t++) { a.step(); b.step(); }
    expect(b.stateHash()).toBe(a.stateHash());
  });

  it('with wolves off there are none', () => {
    const w = new World({ initialPopulation: 100, wolvesEnabled: false }, 2);
    for (let t = 0; t < 100; t++) w.step();
    expect(w.wolves.count).toBe(0);
  });
});
