import { describe, expect, it } from 'vitest';
import { SimulationHost, type HostEnvironment } from '../src/sim/host';
import type { FromWorker } from '../src/sim/protocol';
import { fastBase64Decode, fastBase64Encode } from '../src/sim/base64';
import { ViewerStream } from '../server/viewer-stream';
import { applyGroundDiff } from '../src/ui/simulation-client';
import { World } from '../src/sim/world';

type Frame = Extract<FromWorker, { kind: 'frame' }>;
const frame = (tick: number, extra: Partial<Frame> = {}): Frame => ({
  kind: 'frame', tick, organisms: [], foodPatches: [], ticksPerSecond: 0, running: true,
  targetTicksPerSecond: 60, fromStep: false, events: [], ...extra,
});
const diff = (...cells: [number, number][]) =>
  fastBase64Encode(Uint8Array.from(cells.flatMap(([i, v]) => [i & 255, i >> 8, v])));

/** Posts frames to a slow viewer stream and returns the one merged frame it sends. */
function merged(...frames: Frame[]): Frame {
  const sent: FromWorker[] = [];
  let queued: (() => void) | null = null;
  const clock = { now: () => 0, schedule: (fn: () => void) => { queued = fn; return 1; }, cancel: () => { queued = null; } };
  const stream = new ViewerStream((m) => sent.push(m), 100, clock);
  for (const f of frames) stream.post(f);
  (queued as (() => void) | null)?.();
  expect(sent).toHaveLength(1);
  return sent[0] as Frame;
}

/** Runs a host on a fake clock for `ms`, handing every message to `seen`. */
function runHost(config: Record<string, unknown>, ms: number, seen: (m: FromWorker, host: SimulationHost) => void): SimulationHost {
  let time = 0;
  const timers: { at: number; fn: () => void; id: number }[] = [];
  let nextId = 1;
  let host: SimulationHost | null = null;
  const env: HostEnvironment = {
    post: (m: FromWorker) => { if (host) seen(m, host); },
    now: () => time,
    schedule: (fn, wait) => { const id = nextId++; timers.push({ at: time + wait, fn, id }); return id; },
    cancel: (h) => { const i = timers.findIndex((t) => t.id === h); if (i >= 0) timers.splice(i, 1); },
  };
  host = new SimulationHost(env, config);
  host.handle({ kind: 'speed', ticksPerSecond: 60 });
  host.handle({ kind: 'play' });
  for (;;) {
    timers.sort((a, b) => a.at - b.at);
    const next = timers[0];
    if (!next || next.at > ms) break;
    timers.shift();
    time = next.at;
    next.fn();
  }
  return host;
}

describe('6b-1 weather channel (viewer)', () => {
  it('packWeather classes dryness by the config thresholds and leaves water at 0', () => {
    const world = new World({ seed: 3, weatherEnabled: true });
    const land = world.land;
    const cfg = { ...world.config, moistureWitherBelow: 25, moistureDryPoint: 40, moistureWetPoint: 150 };
    const dry = land.isWater.indexOf(0);
    const wet = land.isWater.indexOf(1);
    const out = new Uint8Array(256 * 256);
    const cases: [number, number][] = [[0, 3], [24, 3], [25, 2], [39, 2], [40, 1], [94, 1], [95, 0], [255, 0]];
    for (const [m, want] of cases) {
      land.moisture[dry] = m;
      land.packWeather(out, cfg);
      expect(out[dry]).toBe(want);
    }
    if (wet >= 0) {
      land.moisture[wet] = 0;
      land.packWeather(out, cfg);
      expect(out[wet]).toBe(0);
    }
  });

  it('with weather on, a viewer rebuilding the channel from full sends and diffs matches the world, with storms and year kind', () => {
    let mirror: Uint8Array | null = null;
    let fulls = 0, mismatches = 0, stormSends = 0, yearKinds = 0;
    const truth = new Uint8Array(256 * 256);
    runHost({ seed: 1, weatherEnabled: true }, 5000, (m, host) => {
      if (m.kind === 'static' && m.landWeather) mirror = fastBase64Decode(m.landWeather);
      if (m.kind !== 'frame') return;
      if (m.landWeather) { mirror = fastBase64Decode(m.landWeather); fulls++; }
      if (m.landWeatherDiff) applyGroundDiff(mirror!, fastBase64Decode(m.landWeatherDiff));
      if (m.storms) {
        stormSends++;
        expect(m.storms.length % 2).toBe(0);
        for (const v of m.storms) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(256); }
      }
      if (m.yearKind !== undefined) yearKinds++;
      if (m.landWeather || m.landWeatherDiff !== undefined) {
        host.world.land.packWeather(truth, host.world.config);
        for (let i = 0; i < truth.length; i++) if (truth[i] !== mirror![i]) mismatches++;
      }
    });
    expect(fulls).toBeGreaterThanOrEqual(3);
    expect(stormSends).toBeGreaterThanOrEqual(3);
    expect(yearKinds).toBeGreaterThanOrEqual(3);
    expect(mismatches).toBe(0);
  });

  it('with weather off (the default), nothing weather-related is sent', () => {
    let any = 0;
    runHost({ seed: 1 }, 3000, (m) => {
      const x = m as { landWeather?: unknown; landWeatherDiff?: unknown; storms?: unknown; yearKind?: unknown };
      if (x.landWeather !== undefined || x.landWeatherDiff !== undefined || x.storms !== undefined || x.yearKind !== undefined) any++;
    });
    expect(any).toBe(0);
  });

  it('a merged server frame keeps weather diffs (newest wins), storms and year kind; a newer full drops older diffs', () => {
    const m = merged(
      frame(1, { landWeatherDiff: diff([5, 1], [300, 2]), storms: [10, 20], yearKind: 1 }),
      frame(2, { landWeatherDiff: diff([300, 3]) })
    );
    const g = new Uint8Array(65536);
    applyGroundDiff(g, fastBase64Decode(m.landWeatherDiff!));
    expect([g[5], g[300]]).toEqual([1, 3]);
    expect(m.storms).toEqual([10, 20]);
    expect(m.yearKind).toBe(1);
    const f = merged(frame(1, { landWeatherDiff: diff([5, 1]) }), frame(2, { landWeather: 'AAAA' }));
    expect(f.landWeather).toBe('AAAA');
    expect(f.landWeatherDiff).toBeUndefined();
  });
});
