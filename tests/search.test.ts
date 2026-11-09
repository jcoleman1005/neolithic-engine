import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';
import { Rules } from '../src/sim/rules';
import { PRNG } from '../src/sim/prng';
import { slotFromId } from '../src/sim/people';

/** An open, dry, water-free world with one hungry person, so only the search rules move them. */
function hungryAlone(config: Record<string, number | boolean>): { w: World; s: number } {
  const w = new World({ initialPopulation: 0, wolfInitialCount: 0, thirstEnabled: false, calmMovementEnabled: false, hungerSearchExplore: 0, ...config }, 4);
  w.land.isWater.fill(0);
  w.land.food.fill(1);
  w.fields.reset();
  const s = slotFromId(w.people.spawn(100, 100, 25, 0, 0, 0, 0, new Uint8Array(8), new Uint8Array(8), 0));
  return { w, s };
}

describe('Shore test 1: hunger search', () => {
  it('keeps a hungry person going the way they were heading when nothing smells better', () => {
    const { w, s } = hungryAlone({ farSightEnabled: false });
    w.people.prevDir[s] = 2; // south
    let south = 0;
    for (let i = 0; i < 20; i++) if (Rules.climb(s, w.people, w.land, w.fields, w.config, new PRNG(i)) === 2) south++;
    expect(south).toBe(20);
  });

  it('does nothing of the kind with the switch off', () => {
    const { w, s } = hungryAlone({ hungerSearchEnabled: false, farSightEnabled: false });
    w.people.prevDir[s] = 2;
    let south = 0;
    for (let i = 0; i < 20; i++) if (Rules.climb(s, w.people, w.land, w.fields, w.config, new PRNG(i)) === 2) south++;
    expect(south).toBeLessThan(20);
  });
});

describe('Shore test 2: far sight', () => {
  it('maps mean standing plant food per 16 x 16 block, leaving out water', () => {
    const { w } = hungryAlone({});
    w.land.food.fill(2);
    w.land.isWater[0] = 1;
    w.land.food[0] = 999;
    w.land.refreshBlockFood();
    expect(w.land.blockFood[0]).toBeCloseTo(2, 6);
  });

  it('draws a searching person toward a clearly richer neighbouring block', () => {
    const { w, s } = hungryAlone({ hungerSearchPersist: 0 });
    w.people.prevDir[s] = 4;
    for (let y = 96; y < 112; y++) for (let x = 112; x < 128; x++) w.land.food[(y << 8) | x] = 20; // block east
    w.land.refreshBlockFood();
    expect(Rules.climb(s, w.people, w.land, w.fields, w.config, new PRNG(1))).toBe(0);
  });

  it('keeps the block map through a save and load and steps the same', () => {
    const w = new World({ initialPopulation: 200 }, 6);
    for (let t = 0; t < 345; t++) w.step(); // mid-interval, so the saved map matters
    const loaded = World.fromState(JSON.parse(JSON.stringify(w.exportState())));
    for (let t = 0; t < 60; t++) { w.step(); loaded.step(); }
    expect(loaded.stateHash()).toBe(w.stateHash());
  });
});
