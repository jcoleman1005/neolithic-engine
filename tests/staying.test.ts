import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';
import { Rules } from '../src/sim/rules';
import { FORM_NEST } from '../src/sim/land';
import { DEFAULT_CONFIG } from '../src/sim/config';
import { slotFromId } from '../src/sim/people';

const cell = (x: number, y: number): number => ((y & 255) << 8) | (x & 255);

function quietWorld(config: Record<string, number | boolean> = {}): World {
  return new World({ initialPopulation: 0, wolfInitialCount: 0, herdsEnabled: false, ...config }, 5);
}

function person(w: World, x: number, y: number, energy = 80): number {
  return slotFromId(w.people.spawn(x, y, energy, 0, 0, 0, 0, new Uint8Array(8), new Uint8Array(8), 0));
}

/** A land tile with plant capacity and little food, so the heap and the shelter decide. */
function landCell(w: World): [number, number] {
  for (let c = 0; c < 65536; c++) {
    if (w.land.isWater[c] === 0 && w.land.capacityAt(c, w.config) > 8) {
      w.land.food[c] = 0.2 * w.land.capacityAt(c, w.config);
      return [c & 255, c >> 8];
    }
  }
  throw new Error('no land');
}

describe('S1: the stay check counts what the place offers', () => {
  it('counts a heap underfoot as food', () => {
    const w = quietWorld();
    const [x, y] = landCell(w);
    const s = person(w, x, y);
    expect(Rules.worthStaying(s, w.people, w.land, w.config, 1, 0.5, 0.5)).toBe(false);
    w.land.pile[cell(x, y)] = 50;
    expect(Rules.worthStaying(s, w.people, w.land, w.config, 1, 0.5, 0.5)).toBe(true);
  });

  it('needs less food in a hut, and the saving shrinks when the hut is crowded', () => {
    const w = quietWorld();
    const [x, y] = landCell(w);
    const c = cell(x, y);
    const s = person(w, x, y);
    const max = w.land.capacityAt(c, w.config);
    w.land.food[c] = 0.3 * max; // below the usual 0.5, above half of it
    expect(Rules.worthStaying(s, w.people, w.land, w.config, 1, 0.5, 0.5)).toBe(false);
    w.land.structure[c] = 1;
    expect(Rules.worthStaying(s, w.people, w.land, w.config, 1, 0.5, 0.5)).toBe(true);
    expect(Rules.worthStaying(s, w.people, w.land, w.config, 40, 0.5, 0.5)).toBe(false);
  });

  it('makes roaming, curious people harder to keep', () => {
    const w = quietWorld();
    const [x, y] = landCell(w);
    const c = cell(x, y);
    const s = person(w, x, y);
    w.land.food[c] = 0.55 * w.land.capacityAt(c, w.config);
    expect(Rules.worthStaying(s, w.people, w.land, w.config, 1, 0, 0)).toBe(true);
    expect(Rules.worthStaying(s, w.people, w.land, w.config, 1, 1, 1)).toBe(false);
  });

  it('never holds a hungry person where there is nothing to eat, even in a hut', () => {
    const w = quietWorld();
    const [x, y] = landCell(w);
    const c = cell(x, y);
    const s = person(w, x, y, 10);
    w.land.structure[c] = 1;
    w.land.food[c] = 1.0;
    w.land.pile[c] = 0;
    expect(Rules.worthStaying(s, w.people, w.land, w.config, 1, 0, 0)).toBe(false);
  });

  it('lets a heap hold people on a tile with no plant capacity', () => {
    const w = quietWorld();
    const [rx, ry] = landCell(w);
    const rock = cell(rx, ry);
    w.land.maxFood[rock] = 0; // as on bare rock
    w.land.food[rock] = 0;
    expect(w.land.capacityAt(rock, w.config)).toBe(0);
    const s = person(w, rock & 255, rock >> 8);
    expect(Rules.worthStaying(s, w.people, w.land, w.config, 1, 0.5, 0.5)).toBe(false);
    w.land.pile[rock] = 20;
    expect(Rules.worthStaying(s, w.people, w.land, w.config, 1, 0.5, 0.5)).toBe(true);
  });
});

describe('S1: crowded shelter', () => {
  function upkeepOnHut(n: number, crowding: boolean): number {
    const w = quietWorld({ tileCrowdingEnabled: crowding, coldEnabled: false, diseaseEnabled: false, fatigueEnabled: false, thirstEnabled: false, injuryEnabled: false, birthHazardsEnabled: false, stockpilesEnabled: false, climbEnabled: false });
    const [x, y] = landCell(w);
    w.land.structure[cell(x, y)] = 1;
    for (let i = 0; i < n; i++) person(w, x, y, 60);
    const before = w.ledger.upkeep;
    w.step();
    return (w.ledger.upkeep - before) / n;
  }

  it('shares the discount once more people than it holds stand in it', () => {
    const roomy = upkeepOnHut(4, true);
    const crowded = upkeepOnHut(8, true);
    expect(crowded).toBeGreaterThan(roomy);
    expect(upkeepOnHut(8, false)).toBeCloseTo(roomy, 6);
  });

  it('keeps the energy ledger balanced in a normal world with S1 on', () => {
    // People placed by hand bypass the ledger, so this runs an ordinary world instead.
    const w = new World({ initialPopulation: 200 }, 5);
    for (let t = 0; t < 400; t++) w.step();
    expect(w.ledger.violations).toBe(0);
  });
});

describe('S1: stores, wolves and shelter', () => {
  it('adds heaped food to the food scent', () => {
    const scentAt = (on: boolean): number => {
      const w = quietWorld({ storeScentEnabled: on });
      const [x, y] = landCell(w);
      w.land.pile[cell(x, y)] = 150;
      for (let t = 0; t < 4; t++) w.step();
      return w.fields.getFood(x, y);
    };
    expect(scentAt(true)).toBeGreaterThan(scentAt(false));
  });

  it('keeps wolves off ground warmed by a fire', () => {
    const w = quietWorld();
    const wolves = w.wolves as unknown as { fireDeters: boolean; canEnter(land: unknown, c: number): boolean };
    const [x, y] = landCell(w);
    const c = cell(x, y);
    wolves.fireDeters = true;
    w.land.fireNear[c] = 1;
    expect(wolves.canEnter(w.land, c)).toBe(false);
    wolves.fireDeters = false;
    expect(wolves.canEnter(w.land, c)).toBe(true);
  });

  it('lets huts and nests lead cold people to them', () => {
    for (const on of [true, false]) {
      const w = quietWorld({ shelterSeekEnabled: on });
      const [x, y] = landCell(w);
      w.land.form[cell(x, y)] = FORM_NEST;
      (w.land as unknown as { warmDirty: boolean }).warmDirty = true;
      w.land.refreshWarmth(w.config);
      expect(w.land.warmDist[cell(x, y)] === 0).toBe(on);
      expect(w.land.warmDist[cell(x + 3, y)] === 3).toBe(on);
    }
  });

  it('starts with every S1 switch on', () => {
    for (const key of ['stayValueEnabled', 'comfortableStayEnabled', 'tileCrowdingEnabled', 'storeScentEnabled', 'storeUnloadEnabled', 'shelterSeekEnabled', 'fireDetersWolvesEnabled'] as const) {
      expect(DEFAULT_CONFIG[key]).toBe(true);
    }
  });
});
