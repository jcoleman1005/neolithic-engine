import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';
import { BLOCKS, BLOCK_COUNT, Weather, YEAR_DROUGHT, type BlockGround } from '../src/sim/weather';
import { DEFAULT_CONFIG } from '../src/sim/config';

const ground = (): BlockGround => ({ waterShare: new Float32Array(BLOCK_COUNT), meanUp: new Float32Array(BLOCK_COUNT), woodShare: new Float32Array(BLOCK_COUNT) });
const b = (bx: number, by: number): number => by * BLOCKS + bx;
// Wind from the west: Land.setWind's vector points to where the wind comes from, so air moves east.
const WEST_X = -1, WEST_Y = 0;

describe('6b-1 weather: climate from the map', () => {
  it('air gains humidity over water', () => {
    const w = new Weather(1);
    const g = ground();
    g.waterShare[b(3, 3)] = 1;
    w.step(g, 0, 0, 0.5, false, { ...DEFAULT_CONFIG, weatherAirSpeed: 0 });
    expect(w.humidity[b(3, 3)]).toBeGreaterThan(w.humidity[b(10, 10)]);
  });

  it('rains more on the windward side of a ridge and less in its lee (rain shadow)', () => {
    const w = new Weather(1);
    const g = ground();
    for (let by = 0; by < BLOCKS; by++) { g.waterShare[b(1, by)] = 1; g.meanUp[b(8, by)] = 0.6; }
    for (let t = 0; t < 120; t++) w.step(g, WEST_X, WEST_Y, 0.5, false, DEFAULT_CONFIG);
    const row = 5;
    expect(w.rain[b(8, row)]).toBeGreaterThan(w.rain[b(6, row)]); // the ridge itself, where air rises
    expect(w.rain[b(11, row)]).toBeLessThan(w.rain[b(6, row)]); // flat land past it, in the shadow
  });

  it('forest gives part of its rain back to the air', () => {
    const run = (wood: number): number => {
      const w = new Weather(1);
      const g = ground();
      g.woodShare.fill(wood);
      w.humidity.fill(2);
      w.step(g, 0, 0, 0.5, false, { ...DEFAULT_CONFIG, weatherAirSpeed: 0 });
      return w.humidity[b(5, 5)];
    };
    expect(run(1)).toBeGreaterThan(run(0));
  });

  it('a drought year cuts what the air takes up from water', () => {
    const run = (drought: boolean): number => {
      const w = new Weather(1);
      const g = ground();
      g.waterShare.fill(1);
      w.step(g, 0, 0, 0.5, true, { ...DEFAULT_CONFIG, weatherAirSpeed: 0, weatherDroughtChance: drought ? 1 : 0, weatherWetChance: 0 });
      if (drought) expect(w.yearKind).toBe(YEAR_DROUGHT);
      return w.humidity[b(4, 4)];
    };
    expect(run(true)).toBeLessThan(run(false));
  });

  it('storms grow only in the warm season', () => {
    const run = (warm: number): number => {
      const w = new Weather(1);
      const g = ground();
      g.waterShare.fill(1);
      w.humidity.fill(4);
      const cfg = { ...DEFAULT_CONFIG, weatherStormChance: 1, weatherStormRain: 0.01, weatherAirSpeed: 0 };
      for (let t = 0; t < 5; t++) w.step(g, 0, 0, warm, false, cfg);
      return w.storms.length;
    };
    expect(run(0)).toBe(0);
    expect(run(1)).toBeGreaterThan(0);
  });
});

describe('6b-1 weather: soil moisture and plants', () => {
  const quiet = (): World => new World({ initialPopulation: 0, wolfInitialCount: 0, weatherEnabled: true, moistureSlices: 1 }, 5);
  const landTile = (w: World): number => { for (let i = 0; i < 65536; i++) if (w.land.isWater[i] === 0 && w.land.riparian[i] === 0 && w.land.maxFood[i] > 5) return i; return -1; };

  it('rain wets the soil, and it dries faster in summer than in winter', () => {
    const w = quiet();
    const i = landTile(w);
    w.land.weather.rain.fill(0.05);
    w.land.moisture[i] = 50;
    w.land.updateMoisture(0, 0.5, w.config);
    expect(w.land.moisture[i]).toBeGreaterThan(50);
    w.land.weather.rain.fill(0);
    w.land.weather.storms = [];
    w.land.moisture[i] = 100; w.land.updateMoisture(0, 1, w.config); const summer = 100 - w.land.moisture[i];
    w.land.moisture[i] = 100; w.land.updateMoisture(0, 0, w.config); const winter = 100 - w.land.moisture[i];
    expect(summer).toBeGreaterThan(winter);
  });

  it('plants grow slower on dry ground, and very dry ground withers', () => {
    const w = quiet();
    const i = landTile(w);
    let j = -1; for (let k = i + 1; k < 65536; k++) if (w.land.isWater[k] === 0 && w.land.maxFood[k] === w.land.maxFood[i] && w.land.riparian[k] === 0) { j = k; break; }
    expect(j).toBeGreaterThan(0);
    w.land.food[i] = 5; w.land.food[j] = 5;
    w.land.moisture[i] = 200; w.land.moisture[j] = 60;
    w.land.step(w.config, 1);
    expect(w.land.food[i] - 5).toBeGreaterThan(w.land.food[j] - 5);
    w.land.food[j] = 10; w.land.moisture[j] = 5;
    w.land.step(w.config, 1);
    expect(w.land.food[j]).toBeLessThan(10);
  });

  it('keeps the state hash alone while off', () => {
    const w = new World({ initialPopulation: 0, wolfInitialCount: 0 }, 5);
    const h = w.stateHash();
    w.land.moisture[100] = 7;
    w.land.weather.humidity[3] = 9;
    expect(w.stateHash()).toBe(h);
  });

  it('a saved and loaded world continues exactly, weather included', () => {
    const a = new World({ initialPopulation: 60, weatherEnabled: true }, 7);
    for (let t = 0; t < 400; t++) a.step();
    const b2 = World.fromState(JSON.parse(JSON.stringify(a.exportState())));
    for (let t = 0; t < 60; t++) { a.step(); b2.step(); }
    expect(b2.stateHash()).toBe(a.stateHash());
  });
});
