import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';
import { slotFromId } from '../src/sim/people';

/** Watchability: the walk back after drinking, and founders placed where water can be reached. */
function quiet(config: Record<string, number | boolean> = {}): World {
  return new World({ initialPopulation: 0, wolfInitialCount: 0, herdInitialCount: 0, coldEnabled: false, ...config }, 8);
}
/** A land tile exactly `d` walking tiles from fresh water. */
function tileAt(w: World, d: number): number {
  for (let c = 0; c < 65536; c++) if (w.land.isWater[c] === 0 && w.land.waterDist[c] === d) return c;
  throw new Error(`no tile ${d} from water`);
}
const wrap = (a: number, b: number): number => { const v = Math.abs(a - b); return v > 128 ? 256 - v : v; };

describe('the walk back after drinking', () => {
  it('a thirsty person walks to water, drinks, and returns to where they were', () => {
    const w = quiet();
    const home = tileAt(w, 8);
    const hx = home & 255, hy = home >> 8;
    const s = slotFromId(w.people.spawn(hx, hy, 80, 0, 0, 0, 0, new Uint8Array(8), new Uint8Array(8), 0));
    w.people.hydration[s] = 50; // below thirstSeek
    let reachedWater = false, back = -1;
    for (let t = 0; t < 60 && back < 0; t++) {
      w.step();
      const c = (w.people.y[s] << 8) | w.people.x[s];
      if (w.land.waterDist[c] <= 1) reachedWater = true;
      if (reachedWater && wrap(w.people.x[s], hx) <= 1 && wrap(w.people.y[s], hy) <= 1) back = t;
    }
    expect(reachedWater).toBe(true);
    expect(back).toBeGreaterThan(0);
    expect(w.people.hydration[s]).toBeGreaterThan(80); // drank up before leaving
    expect(w.people.homeState[s]).toBeLessThanOrEqual(2);
  });

  it('with the switch off nothing is remembered', () => {
    const w = quiet({ thirstReturnEnabled: false });
    const home = tileAt(w, 8);
    const s = slotFromId(w.people.spawn(home & 255, home >> 8, 80, 0, 0, 0, 0, new Uint8Array(8), new Uint8Array(8), 0));
    w.people.hydration[s] = 50;
    for (let t = 0; t < 30; t++) { w.step(); expect(w.people.homeState[s]).toBe(0); }
  });

  it('the remembered place survives a save and load, and the two worlds stay identical', () => {
    const w = quiet();
    const home = tileAt(w, 8);
    const s = slotFromId(w.people.spawn(home & 255, home >> 8, 80, 0, 0, 0, 0, new Uint8Array(8), new Uint8Array(8), 0));
    w.people.hydration[s] = 50;
    for (let t = 0; t < 4; t++) w.step();
    expect(w.people.homeState[s]).toBe(1);
    const copy = World.fromState(JSON.parse(JSON.stringify(w.exportState())));
    expect(copy.people.homeX[s]).toBe(home & 255);
    expect(copy.people.homeY[s]).toBe(home >> 8);
    expect(copy.people.homeState[s]).toBe(1);
    for (let t = 0; t < 40; t++) { w.step(); copy.step(); }
    expect(copy.stateHash()).toBe(w.stateHash());
  });
});

describe('founders and fresh water', () => {
  it('no founder stands on land with no route to fresh water', () => {
    const w = new World({}, 2);
    const p = w.people;
    let stranded = 0;
    for (let q = 0; q < p.capacity; q++) if (p.alive[q] === 1 && w.land.waterDist[(p.y[q] << 8) | p.x[q]] === 255) stranded++;
    expect(p.count).toBe(w.config.initialPopulation);
    expect(stranded).toBe(0);
  });

  it('with the switch off some do (seed 2 has such land)', () => {
    const w = new World({ founderWaterReachEnabled: false }, 2);
    const p = w.people;
    let stranded = 0;
    for (let q = 0; q < p.capacity; q++) if (p.alive[q] === 1 && w.land.waterDist[(p.y[q] << 8) | p.x[q]] === 255) stranded++;
    expect(stranded).toBeGreaterThan(0);
  });
});
