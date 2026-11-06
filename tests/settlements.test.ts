import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';
import { BandTracker } from '../src/sim/bands';
import { Chronicle } from '../src/sim/chronicle';
import { FORM_NEST } from '../src/sim/land';
import { isBuiltCell, SettlementTracker } from '../src/sim/settlements';

const cell = (x: number, y: number): number => ((y & 255) << 8) | (x & 255);
const namer = (_w: World, x: number, y: number, _t: unknown, salt: number): string => `P${x}-${y}-${salt}`;

/** A world with no people of its own, so each test places exactly what it needs. */
function emptyWorld(config: Record<string, number | boolean> = {}): World {
  const w = new World({ initialPopulation: 0, wolfInitialCount: 0, settlementScanInterval: 1, ...config }, 7);
  w.land.form.fill(0);
  w.land.structure.fill(0);
  w.land.fire.fill(0);
  w.land.cave.fill(0);
  return w;
}

function build(w: World, cells: ReadonlyArray<readonly [number, number]>): void {
  for (const [x, y] of cells) w.land.form[cell(x, y)] = FORM_NEST;
}

function addPeople(w: World, n: number, x: number, y: number): void {
  const genes = new Uint8Array(8);
  const habits = new Uint8Array(8);
  for (let i = 0; i < n; i++) w.people.spawn(x, y, 80, 0, 0, 0, 0, genes, habits, 0);
}

function scan(w: World, t: SettlementTracker, tick: number): ReturnType<SettlementTracker['update']> {
  w.tick = tick;
  return t.update(w, new BandTracker(), namer);
}

const CAMP: ReadonlyArray<readonly [number, number]> = [[50, 50], [52, 50], [50, 52]];

describe('settlement detection', () => {
  it('counts nests, huts, granaries and fires as built, but not caves', () => {
    const w = emptyWorld();
    w.land.cave[cell(1, 1)] = 1;
    expect(isBuiltCell(w.land, cell(1, 1))).toBe(false);
    w.land.fire[cell(2, 2)] = 1;
    w.land.structure[cell(3, 3)] = 1;
    build(w, [[4, 4]]);
    expect(isBuiltCell(w.land, cell(2, 2))).toBe(true);
    expect(isBuiltCell(w.land, cell(3, 3))).toBe(true);
    expect(isBuiltCell(w.land, cell(4, 4))).toBe(true);
  });

  it('needs both the built and the resident minimum to found a camp', () => {
    const w = emptyWorld();
    const t = new SettlementTracker();
    build(w, CAMP);
    addPeople(w, 4, 50, 50);
    scan(w, t, 30);
    expect(t.records.size).toBe(0);
    addPeople(w, 1, 50, 50);
    scan(w, t, 60);
    expect(t.records.size).toBe(1);
  });

  it('joins built cells across the map edge and centres them there', () => {
    const w = emptyWorld();
    const t = new SettlementTracker();
    build(w, [[255, 100], [1, 100], [255, 102]]);
    addPeople(w, 6, 0, 100);
    scan(w, t, 30);
    expect(t.records.size).toBe(1);
    const r = [...t.records.values()][0];
    expect(r.built).toBe(3);
    expect(r.x === 255 || r.x === 0).toBe(true);
  });

  it('keeps separate clusters separate', () => {
    const w = emptyWorld();
    const t = new SettlementTracker();
    build(w, CAMP);
    build(w, [[100, 100], [102, 100], [100, 102]]);
    addPeople(w, 6, 50, 50);
    addPeople(w, 6, 100, 100);
    scan(w, t, 30);
    expect(t.records.size).toBe(2);
  });

  it('keeps the id and name as a settlement grows and shifts', () => {
    const w = emptyWorld();
    const t = new SettlementTracker();
    build(w, CAMP);
    addPeople(w, 6, 50, 50);
    scan(w, t, 30);
    const first = [...t.records.values()][0];
    const { id, name } = first;
    w.land.form[cell(50, 50)] = 0;
    build(w, [[54, 50], [54, 52]]);
    scan(w, t, 60);
    expect(t.records.size).toBe(1);
    expect([...t.records.values()][0].id).toBe(id);
    expect([...t.records.values()][0].name).toBe(name);
  });

  it('smooths residents, so a passing crowd barely counts', () => {
    const w = emptyWorld();
    const t = new SettlementTracker();
    build(w, CAMP);
    addPeople(w, 6, 50, 50);
    scan(w, t, 30);
    addPeople(w, 100, 50, 50);
    scan(w, t, 60);
    const r = [...t.records.values()][0];
    expect(r.residents).toBeLessThan(40);
    expect(r.residents).toBeGreaterThan(6);
  });

  it('rises through tiers only when built, residents and age all qualify', () => {
    const w = emptyWorld({ settlementResidentSmoothing: 1 });
    const t = new SettlementTracker();
    const cells: Array<[number, number]> = [];
    for (let i = 0; i < 12; i++) cells.push([50 + (i % 4) * 2, 50 + Math.floor(i / 4) * 2]);
    build(w, cells);
    addPeople(w, 30, 50, 50);
    scan(w, t, 360);
    const r = [...t.records.values()][0];
    expect(r.tier).toBe(0);
    const ch = scan(w, t, 360 + 5 * 360);
    expect(r.tier).toBe(1);
    expect(ch.some((c) => c.kind === 'rose')).toBe(true);
    expect(r.history.map(([, tier]) => tier)).toEqual([0, 1]);
  });

  it('abandons a settlement only after the grace period', () => {
    const w = emptyWorld({ settlementGraceTicks: 100 });
    const t = new SettlementTracker();
    build(w, CAMP);
    addPeople(w, 6, 50, 50);
    scan(w, t, 30);
    w.land.form.fill(0);
    expect(scan(w, t, 60).length).toBe(0);
    expect(t.records.size).toBe(1);
    const ch = scan(w, t, 200);
    expect(ch.map((c) => c.kind)).toEqual(['abandoned']);
    expect(t.records.size).toBe(0);
  });

  it('merges when two settlements grow together, without calling one abandoned', () => {
    const w = emptyWorld({ settlementGap: 2 });
    const t = new SettlementTracker();
    build(w, CAMP);
    build(w, [[60, 50], [62, 50], [60, 52]]);
    addPeople(w, 8, 50, 50);
    addPeople(w, 6, 60, 50);
    scan(w, t, 30);
    expect(t.records.size).toBe(2);
    build(w, [[54, 50], [56, 50], [58, 50]]);
    const ch = scan(w, t, 60);
    expect(t.records.size).toBe(1);
    expect(ch.map((c) => c.kind)).toEqual(['absorbed']);
  });

  it('gives two settlements with the same name a different one', () => {
    const w = emptyWorld();
    const t = new SettlementTracker();
    build(w, CAMP);
    build(w, [[100, 100], [102, 100], [100, 102]]);
    addPeople(w, 6, 50, 50);
    addPeople(w, 6, 100, 100);
    w.tick = 30;
    t.update(w, new BandTracker(), (_w, _x, _y, _t, salt) => `Same${salt}`);
    const names = [...t.records.values()].map((r) => r.name);
    expect(new Set(names).size).toBe(2);
  });

  it('keeps records, ids and names through a save and load', () => {
    const w = emptyWorld();
    const t = new SettlementTracker();
    build(w, CAMP);
    addPeople(w, 6, 50, 50);
    scan(w, t, 30);
    const before = [...t.records.values()][0];
    const loaded = new SettlementTracker();
    loaded.importState(JSON.parse(JSON.stringify(t.exportState())));
    scan(w, loaded, 60);
    expect([...loaded.records.values()][0].id).toBe(before.id);
    expect([...loaded.records.values()][0].name).toBe(before.name);
    build(w, [[100, 100], [102, 100], [100, 102]]);
    addPeople(w, 6, 100, 100);
    scan(w, loaded, 90);
    expect(new Set([...loaded.records.keys()]).size).toBe(2);
  });

  it('keeps camps silent and announces a hamlet in the chronicle', () => {
    const c = new Chronicle();
    const w = emptyWorld({ settlementResidentSmoothing: 1 });
    const cells: Array<[number, number]> = [];
    for (let i = 0; i < 12; i++) cells.push([50 + (i % 4) * 2, 50 + Math.floor(i / 4) * 2]);
    build(w, cells);
    addPeople(w, 30, 50, 50);
    w.tick = 360;
    c.record(w);
    expect(c.counts.settled).toBe(0);
    w.tick = 360 + 5 * 360;
    c.record(w);
    expect(c.counts.settled).toBe(1);
  });
});

describe('settlement observer', () => {
  it('changes no outcome: the same seed gives the same state hash with it running', () => {
    const plain = new World({ initialPopulation: 150 }, 11);
    const watched = new World({ initialPopulation: 150 }, 11);
    const chronicle = new Chronicle();
    for (let t = 0; t < 350; t++) {
      plain.step();
      watched.step();
      chronicle.record(watched);
    }
    expect(watched.stateHash()).toBe(plain.stateHash());
  });
});
