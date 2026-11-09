import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';
import { Rules } from '../src/sim/rules';
import { PRNG } from '../src/sim/prng';
import { CARRY_NONE, CARRY_WATER, slotFromId } from '../src/sim/people';
import { mannWhitney, signFlip } from '../scripts/stats';

function quietWorld(config: Record<string, number | boolean> = {}): World {
  return new World({ initialPopulation: 0, wolfInitialCount: 0, ...config }, 8);
}

/** A land tile at least `d` steps from fresh water, and one right beside it. */
function tiles(w: World, d: number): { far: number; shore: number } {
  let far = -1, shore = -1;
  for (let c = 0; c < 65536; c++) {
    if (w.land.isWater[c] === 1) continue;
    if (far < 0 && w.land.waterDist[c] >= d && w.land.waterDist[c] < 200) far = c;
    if (shore < 0 && w.land.waterDist[c] === 1) shore = c;
  }
  return { far, shore };
}

function person(w: World, c: number, energy = 80): number {
  return slotFromId(w.people.spawn(c & 255, c >> 8, energy, 0, 0, 0, 0, new Uint8Array(8), new Uint8Array(8), 0));
}

describe('S3w: water stores', () => {
  it('fills up to the cap and returns what did not fit', () => {
    const w = quietWorld({ waterStoreCap: 50 });
    const { far } = tiles(w, 5);
    expect(w.land.pourWater(far, 30, w.config)).toBe(30);
    expect(w.land.pourWater(far, 30, w.config)).toBe(20);
    expect(w.land.waterStore[far]).toBe(50);
  });

  it('becomes findable at the find level and drops out only below half of it', () => {
    const w = quietWorld({ waterStoreFindMin: 10 });
    const { far } = tiles(w, 5);
    w.land.pourWater(far, 9, w.config);
    expect(w.land.waterFindable[far]).toBe(0);
    w.land.pourWater(far, 1, w.config);
    expect(w.land.waterFindable[far]).toBe(1);
    w.land.takeWater(far, 4, w.config);
    expect(w.land.waterFindable[far]).toBe(1);
    w.land.takeWater(far, 2, w.config);
    expect(w.land.waterFindable[far]).toBe(0);
  });

  it('dries faster when warm and slower on a built tile', () => {
    const loss = (warm: number, built: boolean): number => {
      const w = quietWorld();
      const { far } = tiles(w, 5);
      w.land.seasonTemp = warm;
      if (built) w.land.durability[far] = 30;
      w.land.pourWater(far, 50, w.config);
      w.land.evaporateWater(w.config);
      return 50 - w.land.waterStore[far];
    };
    expect(loss(1, false)).toBeGreaterThan(loss(0, false));
    expect(loss(0, true)).toBeLessThan(loss(0, false));
  });

  it('adds findable stores to the drinkable distance, and the field matches after a load', () => {
    const w = quietWorld();
    const { far } = tiles(w, 8);
    w.land.refreshDrink();
    expect(w.land.drinkDist[far]).toBe(w.land.waterDist[far]);
    w.land.pourWater(far, 50, w.config);
    w.land.refreshDrink();
    expect(w.land.drinkDist[far]).toBe(0);
    const loaded = World.fromState(JSON.parse(JSON.stringify(w.exportState())));
    loaded.land.refreshDrink();
    expect(Array.from(loaded.land.drinkDist)).toEqual(Array.from(w.land.drinkDist));
  });
});

describe('S3w: drinking and carrying', () => {
  it('lets a thirsty person drink from the store they stand on', () => {
    const w = quietWorld();
    const { far } = tiles(w, 6);
    const s = person(w, far);
    w.people.hydration[s] = 20;
    w.land.pourWater(far, 80, w.config);
    w.step();
    expect(w.people.hydration[s]).toBeGreaterThan(20);
    expect(w.land.waterStore[far]).toBeLessThan(80);
  });

  it('lets a thirsty carrier drink from what they carry', () => {
    const w = quietWorld();
    const { far } = tiles(w, 6);
    const s = person(w, far);
    w.people.hydration[s] = 20;
    w.people.carryKind[s] = CARRY_WATER;
    w.people.carry[s] = 15;
    w.step();
    expect(w.people.hydration[s]).toBeGreaterThan(30);
    expect(w.people.carry[s]).toBeLessThan(15);
  });

  it('lets a thirsty person drink from a store beside them, like a river', () => {
    const w = quietWorld();
    const { far } = tiles(w, 8);
    const next = (far & 0xff00) | (((far & 255) + 1) & 255);
    if (w.land.isWater[next] === 1) return;
    const s = person(w, far);
    w.people.hydration[s] = 10;
    w.land.pourWater(next, 50, w.config);
    w.land.refreshDrink();
    expect(Rules.climb(s, w.people, w.land, w.fields, w.config, new PRNG(1))).toBe(4);
    w.step();
    expect(w.land.waterStore[next]).toBeLessThan(50);
  });

  it('lets a hungry person eat from a heap beside them only with adjacentStoresEnabled', () => {
    // Heaps also spoil a little each tick, so compare against the switch off.
    const left = (on: boolean): number => {
      const w = quietWorld({ adjacentStoresEnabled: on });
      const { far } = tiles(w, 6);
      const next = (far & 0xff00) | (((far & 255) + 1) & 255);
      person(w, far, 15);
      w.land.pile[next] = 40;
      w.step();
      return w.land.pile[next];
    };
    expect(left(true)).toBeLessThan(left(false) - 1);
  });

  it('stops a thirsty person on a store tile, not a tile short of it', () => {
    const w = quietWorld();
    const { far } = tiles(w, 6);
    const s = person(w, far);
    w.people.hydration[s] = 10;
    w.land.pourWater(far, 50, w.config);
    w.land.refreshDrink();
    expect(Rules.climb(s, w.people, w.land, w.fields, w.config, new PRNG(1))).toBe(4);
  });

  it('walks a thirsty person toward a store two tiles off', () => {
    const w = quietWorld();
    const { far } = tiles(w, 8);
    const next = (far & 0xff00) | (((far & 255) + 2) & 255);
    if (w.land.isWater[next] === 1 || w.land.isWater[(far & 0xff00) | (((far & 255) + 1) & 255)] === 1) return;
    const s = person(w, far);
    w.people.hydration[s] = 10;
    w.land.pourWater(next, 50, w.config);
    w.land.refreshDrink();
    expect(Rules.climb(s, w.people, w.land, w.fields, w.config, new PRNG(1))).toBe(0);
  });

  it('spills carried water with each step, and empty hands clear the carry', () => {
    const w = new World({ initialPopulation: 120, waterSpill: 50 }, 2);
    let s = -1;
    for (let i = 0; i < w.people.capacity && s < 0; i++) if (w.people.alive[i] === 1) s = i;
    w.people.carryKind[s] = CARRY_WATER;
    w.people.carry[s] = 20;
    const x = w.people.x[s], y = w.people.y[s];
    for (let t = 0; t < 30 && w.people.x[s] === x && w.people.y[s] === y; t++) w.step();
    if (w.people.x[s] === x && w.people.y[s] === y) return; // never moved: nothing to check
    expect(w.people.carryKind[s] === CARRY_NONE || w.people.carry[s] < 20).toBe(true);
  });

  it('never pours beside the river', () => {
    const w = new World({ initialPopulation: 400 }, 5);
    for (let t = 0; t < 900; t++) w.step();
    for (let c = 0; c < 65536; c++) {
      if (w.land.waterStore[c] > 0) expect(w.land.waterDist[c]).toBeGreaterThanOrEqual(w.config.waterPourMinDist);
    }
    expect(w.ledger.violations).toBe(0);
  });

  it('keeps stores through a save and load and steps the same', () => {
    const w = new World({ initialPopulation: 200 }, 6);
    for (let t = 0; t < 300; t++) w.step();
    const loaded = World.fromState(JSON.parse(JSON.stringify(w.exportState())));
    for (let t = 0; t < 60; t++) { w.step(); loaded.step(); }
    expect(loaded.stateHash()).toBe(w.stateHash());
  });

  it('packs what a person carries into the frame', () => {
    const w = new World({ initialPopulation: 50 }, 3);
    let s = -1;
    for (let i = 0; i < w.people.capacity && s < 0; i++) if (w.people.alive[i] === 1) s = i;
    w.people.carryKind[s] = CARRY_WATER;
    w.people.carry[s] = 12.2;
    const { base64 } = w.packPeopleFrame();
    const buf = Buffer.from(base64, 'base64');
    for (let o = 0; o < buf.length; o += 11) {
      if ((buf[o] | (buf[o + 1] << 8)) !== s) continue;
      expect(buf[o + 10] & 7).toBe(CARRY_WATER);
      expect(buf[o + 10] >> 3).toBe(13);
    }
  });
});

describe('compare statistics', () => {
  it('finds a clear shift and ignores identical samples', () => {
    const a = Array.from({ length: 200 }, (_, i) => i % 10);
    const b = a.map((v) => v + 3);
    expect(mannWhitney(b, a).z).toBeGreaterThan(3);
    expect(Math.abs(mannWhitney(a, a).z)).toBeLessThan(1e-9);
  });

  it('gives the exact sign-flip p for six same-sign differences', () => {
    expect(signFlip([1, 2, 1.5, 0.5, 3, 1])).toBeCloseTo(2 / 64, 10);
    expect(signFlip([1, -1, 1, -1, 1, -1])).toBe(1);
  });
});
