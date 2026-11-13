import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';
import { Rules } from '../src/sim/rules';
import { slotFromId } from '../src/sim/people';

/**
 * W1a shore fix. Scent drifts over water; before the fix a hungry person on the bank whose strongest
 * scent lay over the water chose that step, was blocked, and stood still (docs/findings.md).
 */
function shoreWorld(config: Record<string, number | boolean>): { w: World; slot: number; cell: number } {
  // No far sight, searching or paths, so the food scent is the only pull.
  const w = new World({
    initialPopulation: 0, wolfInitialCount: 0, herdInitialCount: 0,
    farSightEnabled: false, hungerSearchEnabled: false, pathsEnabled: false, ...config,
  }, 8);
  const L = w.land;
  let cell = -1;
  for (let c = 0; c < 65536 && cell < 0; c++) {
    const x = c & 255, y = c >> 8;
    if (L.isWater[c] === 1) continue;
    const e = (y << 8) | ((x + 1) & 255), wst = (y << 8) | ((x - 1) & 255);
    const s = (((y + 1) & 255) << 8) | x, n = (((y - 1) & 255) << 8) | x;
    if (L.isWater[e] === 1 && L.isWater[wst] === 0 && L.isWater[s] === 0 && L.isWater[n] === 0) cell = c;
  }
  if (cell < 0) throw new Error('no tile with water to the east only');
  const x = cell & 255, y = cell >> 8;
  // Starving, watered, on bare ground: the stay check fails and nothing but scent moves them.
  const slot = slotFromId(w.people.spawn(x, y, 15, 0, 0, 0, 0, new Uint8Array(8), new Uint8Array(8), 0));
  w.people.hydration[slot] = 100;
  L.food[cell] = 0;
  L.pile.fill(0);
  w.fields.foodCurrent.fill(0);
  w.fields.foodCurrent[(y << 8) | ((x + 1) & 255)] = 200; // strong scent lying over the water
  w.fields.foodCurrent[(y << 8) | ((x - 1) & 255)] = 10; // a little on the land behind
  return { w, slot, cell };
}

const climb = (w: World, slot: number): number => Rules.climb(slot, w.people, w.land, w.fields, w.config, w.prng, 1);

describe('W1a shore fix', () => {
  it('without it, scent over the water holds a starving person at the bank', () => {
    const { w, slot } = shoreWorld({ shoreScentEnabled: false, shoreSlideEnabled: false });
    for (let k = 0; k < 20; k++) expect(climb(w, slot)).toBe(4);
  });

  it('with shoreScentEnabled the slope ignores water, so they follow the scent on land', () => {
    const { w, slot } = shoreWorld({ shoreScentEnabled: true, shoreSlideEnabled: false });
    for (let k = 0; k < 20; k++) expect(climb(w, slot)).toBe(1); // west, toward the land scent
  });

  it('with shoreSlideEnabled a step blocked by water becomes a step along the shore, never into water', () => {
    const { w, slot, cell } = shoreWorld({ shoreScentEnabled: false, shoreSlideEnabled: true });
    const x = cell & 255, y = cell >> 8;
    for (let k = 0; k < 20; k++) {
      const d = climb(w, slot);
      expect(d === 2 || d === 3).toBe(true);
      const ny = d === 2 ? (y + 1) & 255 : (y - 1) & 255;
      expect(w.land.isWater[(ny << 8) | x]).toBe(0);
    }
  });
});
