import { describe, expect, it } from 'vitest';
import {
  CELLS, bestPassableStep, climbScent, diffuseOnLand, landDistance, settleField, step,
} from '../scripts/home-scent-proto';

/**
 * Smoke tests for the prototype of a home scent that water blocks, and of choosing a step among
 * passable directions only (the user's proposal of 2026-11-15). Synthetic maps; the simulation is
 * not involved. These are the mechanisms a full implementation would have to keep.
 */
const cell = (x: number, y: number): number => ((y & 255) << 8) | (x & 255);

/** All land except a river: water at x = 100 for y from 20 to 200 (open round both ends). */
function riverMap(): Uint8Array {
  const w = new Uint8Array(CELLS);
  for (let y = 20; y <= 200; y++) w[cell(100, y)] = 1;
  return w;
}
function sourcesAt(...cells: number[]): Float32Array {
  const s = new Float32Array(CELLS);
  for (const c of cells) s[c] = 1;
  return s;
}

describe('home scent prototype: a scent that water blocks', () => {
  it('holds no scent on water and loses none into it', () => {
    const water = riverMap();
    let a = new Float32Array(CELLS), b = new Float32Array(CELLS);
    a[cell(101, 110)] = 100; // right beside the river
    for (let k = 0; k < 200; k++) { diffuseOnLand(a, b, water, 0.1, 0); const t = a; a = b; b = t; }
    let total = 0, onWater = 0;
    for (let c = 0; c < CELLS; c++) { total += a[c]; if (water[c] === 1) onWater += a[c]; }
    expect(onWater).toBe(0);
    expect(total).toBeCloseTo(100, 2); // with no evaporation the total is conserved
  });

  it('does not cross the river: the far bank only gets scent that came round the end', () => {
    const water = riverMap();
    const field = settleField(water, sourcesAt(cell(110, 110)), 0.1, 0.002, 4000);
    const nearBank = field[cell(101, 110)], farBank = field[cell(99, 110)];
    expect(nearBank).toBeGreaterThan(0);
    // Straight across is 2 tiles; round the end is about 200. Free diffusion would make them alike.
    expect(farBank).toBeLessThan(nearBank * 0.01);
  });

  it('an enclosed island gets no scent at all', () => {
    const water = new Uint8Array(CELLS);
    for (let x = 40; x <= 60; x++) { water[cell(x, 40)] = 1; water[cell(x, 60)] = 1; }
    for (let y = 40; y <= 60; y++) { water[cell(40, y)] = 1; water[cell(60, y)] = 1; }
    const field = settleField(water, sourcesAt(cell(80, 50)), 0.1, 0.002, 2000);
    expect(field[cell(50, 50)]).toBe(0);
    expect(field[cell(62, 50)]).toBeGreaterThan(0);
  });

  it('climbing the scent from across the river walks round it, never through, and arrives', () => {
    const water = riverMap();
    const home = cell(110, 190); // near the south end of the river, on the east side
    const field = settleField(water, sourcesAt(home), 0.1, 0.002, 6000);
    const start = cell(95, 190); // 15 tiles away as the crow flies, on the west side
    const walk = climbScent(field, water, start);
    expect(walk.touchedWater).toBe(false);
    expect(walk.end).toBe(home);
    // Least resistance: the walk is the shortest land route, not longer.
    const shortest = landDistance(water, [home])[start];
    expect(shortest).toBeGreaterThan(15); // the river really is in the way
    expect(walk.steps).toBe(shortest);
  });

  it('with no home scent there is no pull', () => {
    const water = riverMap();
    const field = new Float32Array(CELLS);
    const walk = climbScent(field, water, cell(50, 50));
    expect(walk.steps).toBe(0);
    expect(walk.end).toBe(cell(50, 50));
  });

  it('of two homes, the climb reaches the one that is nearer over land, not as the crow flies', () => {
    const water = riverMap();
    const acrossRiver = cell(104, 110); // 8 tiles away in a straight line, about 190 by land
    const sameSide = cell(70, 110); // 26 tiles away, same side
    const field = settleField(water, sourcesAt(acrossRiver, sameSide), 0.1, 0.002, 6000);
    const walk = climbScent(field, water, cell(96, 110));
    expect(walk.end).toBe(sameSide);
  });
});

describe('prototype: a step is chosen among passable directions only', () => {
  const open = (): boolean => true;
  const blocked = (...dirs: number[]) => (d: number): boolean => !dirs.includes(d);

  it('takes the wanted step when it is open', () => {
    expect(bestPassableStep(3, 1, open)).toBe(0);
    expect(bestPassableStep(-1, -4, open)).toBe(3);
  });

  it('never returns a blocked direction, whatever the pull', () => {
    for (let mask = 0; mask < 16; mask++) {
      const pass = (d: number): boolean => ((mask >> d) & 1) === 1;
      for (const [vx, vy] of [[5, 0], [-5, 0], [0, 5], [0, -5], [3, 2], [-2, 3], [4, -4], [-1, -6], [0.01, 0.01]]) {
        const d = bestPassableStep(vx, vy, pass);
        if (d !== 4) expect(pass(d)).toBe(true);
      }
    }
  });

  it('never steps straight away from the pull', () => {
    expect(bestPassableStep(5, 0, blocked(0, 2, 3))).toBe(4); // only west is open: stay
    expect(bestPassableStep(0, -5, blocked(3, 0, 1))).toBe(4);
  });

  it('water ahead: takes the lesser wanted step, else slides along the shore', () => {
    expect(bestPassableStep(5, 2, blocked(0))).toBe(2); // east blocked, pull also leans south
    expect(bestPassableStep(5, 0, blocked(0))).toBe(2); // no lean: first open side
    expect(bestPassableStep(5, 0, blocked(0, 2))).toBe(3);
    expect(bestPassableStep(5, 2, blocked(0, 2))).toBe(3); // both wanted steps blocked: the other side
  });

  it('a negligible pull means staying', () => {
    expect(bestPassableStep(0.01, -0.02, open)).toBe(4);
  });

  // A finding, kept as a test: the step rule keeps people out of the water but cannot find the way
  // round by itself. A straight pull at a point behind a lake leaves the walker pacing its shore.
  // The scent is what finds the route (next test, same lake).
  const lake = (): Uint8Array => {
    const water = new Uint8Array(CELLS);
    for (let y = 95; y <= 105; y++) for (let x = 100; x <= 110; x++) water[cell(x, y)] = 1;
    return water;
  };

  it('with a straight pull at a point behind a lake, the rule never enters the water but does not get round', () => {
    const water = lake();
    let c = cell(90, 100);
    for (let k = 0; k < 200; k++) {
      const vx = 120 - (c & 255), vy = 100 - (c >> 8);
      const d = bestPassableStep(vx, vy, (dir) => water[step(c, dir)] === 0);
      if (d === 4) break;
      c = step(c, d);
      expect(water[c]).toBe(0);
    }
    expect(c).not.toBe(cell(120, 100));
    expect(c & 255).toBeLessThan(100); // still on the near shore
  });

  it('with the pull taken from a land-only scent, the same rule walks round the same lake and arrives', () => {
    const water = lake();
    const home = cell(120, 100);
    const field = settleField(water, (() => { const s = new Float32Array(CELLS); s[home] = 1; return s; })(), 0.1, 0.002, 4000);
    let c = cell(90, 100);
    let steps = 0;
    for (; steps < 200 && c !== home; steps++) {
      // The slope a person would feel: a water neighbour counts as their own tile (the shore fix).
      const v = (dir: number): number => (water[step(c, dir)] === 1 ? field[c] : field[step(c, dir)]);
      const d = bestPassableStep(v(0) - v(1), v(2) - v(3), (dir) => water[step(c, dir)] === 0, 0);
      if (d === 4) break;
      c = step(c, d);
      expect(water[c]).toBe(0);
    }
    expect(c).toBe(home);
    expect(steps).toBeLessThanOrEqual(landDistance(water, [home])[cell(90, 100)] + 4);
  });
});
