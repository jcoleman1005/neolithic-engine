import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';

const cell = (x: number, y: number): number => ((y & 255) << 8) | (x & 255);

function quietWorld(config: Record<string, number | boolean> = {}): World {
  const w = new World({ initialPopulation: 0, wolfInitialCount: 0, ...config }, 6);
  w.land.durability.fill(0);
  w.land.brush.fill(0);
  w.land.trees.fill(0);
  w.land.treeMax.fill(0);
  w.land.upland.fill(0);
  w.land.cave.fill(0);
  w.land.isWater.fill(0);
  w.land.wooded.fill(0);
  w.land.stone.fill(0);
  return w;
}

describe('S3-pre: packed earth', () => {
  it('can be dug only from trodden ground', () => {
    const w = quietWorld();
    const c = cell(10, 10);
    expect(w.land.dig(c, 1, w.config)).toBe(0);
    w.land.wear[c] = 64;
    expect(w.land.dig(c, 1, w.config)).toBe(1);
    w.land.durability[c] = 5;
    expect(w.land.dig(c, 1, w.config)).toBe(0);
  });

  it('builds less durability than stone and marks the tile as earth', () => {
    const w = quietWorld();
    w.land.build(5, 5, 4, w.config, true);
    w.land.build(7, 5, 4, w.config, false);
    expect(w.land.durability[cell(5, 5)]).toBeLessThan(w.land.durability[cell(7, 5)]);
    expect(w.land.material[cell(5, 5)]).toBe(1);
    expect(w.land.material[cell(7, 5)]).toBe(2);
    w.land.build(5, 5, 1, w.config, false);
    expect(w.land.material[cell(5, 5)]).toBe(2);
  });

  it('wears away faster than stone, and clears its material at zero', () => {
    const w = quietWorld();
    w.land.durability[cell(1, 1)] = 40; w.land.material[cell(1, 1)] = 1;
    w.land.durability[cell(2, 1)] = 40; w.land.material[cell(2, 1)] = 2;
    for (let t = 0; t < 640; t++) w.land.erode(t, w.config);
    expect(w.land.durability[cell(1, 1)]).toBeLessThan(w.land.durability[cell(2, 1)]);
    for (let t = 640; t < 4000; t++) w.land.erode(t, w.config);
    expect(w.land.durability[cell(1, 1)]).toBe(0);
    expect(w.land.material[cell(1, 1)]).toBe(0);
  });
});

describe('S3a: exposure and directional building', () => {
  it('is fully open with nothing around, and falls as barriers go up', () => {
    const w = quietWorld();
    const c = cell(50, 50);
    expect(w.land.exposureOf(c, w.config)).toBe(255);
    w.land.durability[cell(51, 50)] = 255;
    const one = w.land.exposureOf(c, w.config);
    expect(one).toBeLessThan(255);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) w.land.durability[cell(50 + dx, 50 + dy)] = 255;
    expect(w.land.exposureOf(c, w.config)).toBe(0);
  });

  it('counts the upwind side more than the downwind side', () => {
    const w = quietWorld();
    w.land.setWind(0); // wind from the east (+x)
    const upwind = quietWorld();
    upwind.land.setWind(0);
    upwind.land.durability[cell(51, 50)] = 200;
    w.land.durability[cell(49, 50)] = 200;
    expect(upwind.land.exposureOf(cell(50, 50), upwind.config)).toBeLessThan(w.land.exposureOf(cell(50, 50), w.config));
  });

  it('treats caves as covered and higher ground as shelter', () => {
    const w = quietWorld();
    w.land.cave[cell(20, 20)] = 1;
    expect(w.land.exposureOf(cell(20, 20), w.config)).toBe(0);
    w.land.upland[cell(31, 30)] = 0.5;
    expect(w.land.exposureOf(cell(30, 30), w.config)).toBeLessThan(255);
  });

  it('sets material down on the upwind neighbour, skipping occupied tiles and routes', () => {
    const w = quietWorld();
    w.land.setWind(0.25); // wind from the south (+y)
    const none = (): boolean => false;
    expect(w.land.bestShelterNeighbour(60, 60, 8, none, w.config)).toBe(cell(60, 61));
    expect(w.land.bestShelterNeighbour(60, 60, 8, (c) => c === cell(60, 61), w.config)).not.toBe(cell(60, 61));
    w.land.wear[cell(60, 61)] = 200;
    expect(w.land.bestShelterNeighbour(60, 60, 8, none, w.config)).not.toBe(cell(60, 61));
  });

  it('moves on once the best side is already a full wall', () => {
    const w = quietWorld();
    w.land.setWind(0.25);
    w.land.durability[cell(60, 61)] = 255;
    const n = w.land.bestShelterNeighbour(60, 60, 8, () => false, w.config);
    expect(n).not.toBe(cell(60, 61));
    expect(n).toBeGreaterThanOrEqual(0);
  });

  it('keeps material and exposure through a save and load', () => {
    const w = new World({ initialPopulation: 150, exposureEnabled: true, directionalBuildEnabled: true }, 3);
    for (let t = 0; t < 120; t++) w.step();
    w.land.material[cell(4, 4)] = 1;
    const loaded = World.fromState(JSON.parse(JSON.stringify(w.exportState())));
    expect(Array.from(loaded.land.exposure)).toEqual(Array.from(w.land.exposure));
    expect(loaded.land.material[cell(4, 4)]).toBe(1);
    for (let t = 0; t < 40; t++) { w.step(); loaded.step(); }
    expect(loaded.stateHash()).toBe(w.stateHash());
  });

  it('unit C rays: a tile walled in on all four sides within roomMaxSpan is low; one open side is not', () => {
    const w = quietWorld({ windShadowEnabled: false });
    const c = cell(100, 100);
    // Walls 3 tiles out (outside the 3x3 barrier average) on N, S and W only.
    w.land.durability[cell(100, 97)] = 40;
    w.land.durability[cell(100, 103)] = 40;
    w.land.durability[cell(97, 100)] = 40;
    expect(w.land.exposureOf(c, w.config)).toBe(255);
    w.land.durability[cell(103, 100)] = 40;
    expect(w.land.exposureOf(c, w.config)).toBe(w.config.indoorBaseExposure);
    const off = quietWorld({ windShadowEnabled: false, exposureRaysEnabled: false });
    off.land.durability.set(w.land.durability);
    expect(off.land.exposureOf(c, off.config)).toBe(255);
  });

  it('unit C rays: walls below wallThreshold or beyond roomMaxSpan do not enclose; a cave does', () => {
    const w = quietWorld({ windShadowEnabled: false });
    const c = cell(100, 100);
    for (const n of [cell(100, 98), cell(100, 102), cell(98, 100)]) w.land.durability[n] = 40;
    w.land.durability[cell(105, 100)] = 40; // 5 tiles east: beyond the default span of 4
    expect(w.land.exposureOf(c, w.config)).toBeGreaterThan(w.config.indoorBaseExposure);
    w.land.durability[cell(102, 100)] = 29; // just under the threshold
    expect(w.land.exposureOf(c, w.config)).toBeGreaterThan(w.config.indoorBaseExposure);
    w.land.cave[cell(102, 100)] = 1;
    expect(w.land.exposureOf(c, w.config)).toBe(w.config.indoorBaseExposure);
  });

  it('unit C rays: exposure falls step by step as walls are added around a room', () => {
    const w = quietWorld({ windShadowEnabled: false });
    const c = cell(140, 140);
    const seen: number[] = [w.land.exposureOf(c, w.config)];
    for (const n of [cell(141, 140), cell(139, 140), cell(140, 141), cell(140, 139)]) {
      w.land.durability[n] = 60;
      seen.push(w.land.exposureOf(c, w.config));
    }
    for (let k = 1; k < seen.length; k++) expect(seen[k]).toBeLessThan(seen[k - 1]);
    expect(seen[seen.length - 1]).toBeLessThanOrEqual(w.config.indoorBaseExposure);
  });

  it('unit C wind shadow: the downwind side of a wall is lower than the upwind side', () => {
    const w = quietWorld({ exposureRaysEnabled: false });
    w.land.setWind(0); // wind from the east (+x)
    w.land.durability[cell(80, 80)] = 60;
    const downwind = w.land.exposureOf(cell(78, 80), w.config); // 2 tiles west: sheltered by the wall
    const upwind = w.land.exposureOf(cell(82, 80), w.config); // 2 tiles east: facing the wind
    expect(downwind).toBeLessThan(upwind);
    expect(downwind).toBe(Math.max(w.config.windShadowFloor, 255 - w.config.windbreakReduction));
    expect(upwind).toBe(255);
    const off = quietWorld({ exposureRaysEnabled: false, windShadowEnabled: false });
    off.land.setWind(0);
    off.land.durability.set(w.land.durability);
    expect(off.land.exposureOf(cell(78, 80), off.config)).toBe(255);
  });

  it('unit C wind shadow: a nearly-east wind still casts a wall\'s shadow straight west', () => {
    const w = quietWorld({ exposureRaysEnabled: false });
    w.land.setWind(0.04); // about 14 degrees off east
    w.land.durability[cell(80, 80)] = 60;
    expect(w.land.exposureOf(cell(78, 80), w.config)).toBe(Math.max(w.config.windShadowFloor, 255 - w.config.windbreakReduction));
  });

  it('unit C wind shadow: woods, caves and higher ground cast it; the reach is windShadowReach', () => {
    const w = quietWorld({ exposureRaysEnabled: false });
    w.land.setWind(0.25); // wind from the south (+y)
    const shadow = Math.max(w.config.windShadowFloor, 255 - w.config.windbreakReduction);
    w.land.wooded[cell(30, 33)] = 1;
    expect(w.land.exposureOf(cell(30, 30), w.config)).toBe(shadow); // 3 south: within reach
    w.land.cave[cell(40, 44)] = 1;
    expect(w.land.exposureOf(cell(40, 40), w.config)).toBe(255); // 4 south: beyond reach
    w.land.upland[cell(50, 52)] = 0.2;
    expect(w.land.exposureOf(cell(50, 50), w.config)).toBe(shadow);
  });

  it('leaves the state hash alone while exposure is off', () => {
    const w = quietWorld({ exposureEnabled: false });
    const h = w.stateHash();
    w.land.exposure[cell(7, 7)] = 3;
    expect(w.stateHash()).toBe(h);
  });
});
