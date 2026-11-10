import { describe, expect, it } from 'vitest';
import { SimulationHost, type HostEnvironment } from '../src/sim/host';
import type { FromWorker } from '../src/sim/protocol';
import { fastBase64Decode, fastBase64Encode } from '../src/sim/base64';
import { applyGroundDiff } from '../src/ui/simulation-client';
import { ViewerStream } from '../server/viewer-stream';

type Frame = Extract<FromWorker, { kind: 'frame' }>;
const frame = (tick: number, extra: Partial<Frame> = {}): Frame => ({
  kind: 'frame', tick, organisms: [], foodPatches: [], ticksPerSecond: 0, running: true,
  targetTicksPerSecond: 60, fromStep: false, events: [], ...extra,
});
const diff = (...cells: [number, number][]) =>
  fastBase64Encode(Uint8Array.from(cells.flatMap(([i, v]) => [i & 255, i >> 8, v])));

describe('ground channel diffs (viewer smoothness, 2026-11-09)', () => {
  it('a viewer rebuilding the ground from full sends and diffs matches the world after each send', () => {
    let time = 0;
    const timers: { at: number; fn: () => void; id: number }[] = [];
    let nextId = 1;
    let host: SimulationHost | null = null;
    let mirror: Uint8Array | null = null;
    let fulls = 0;
    let diffs = 0;
    let mismatches = 0;
    const env: HostEnvironment = {
      post: (m: FromWorker) => {
        if (!host) return;
        if (m.kind === 'static' && m.landPaths) mirror = fastBase64Decode(m.landPaths);
        if (m.kind !== 'frame') return;
        if (m.landPaths) {
          mirror = fastBase64Decode(m.landPaths);
          fulls++;
        }
        if (m.landPathsDiff) {
          applyGroundDiff(mirror!, fastBase64Decode(m.landPathsDiff));
          diffs++;
        }
        if (m.landPaths || m.landPathsDiff !== undefined) {
          const truth = fastBase64Decode(host.world.packLandPaths());
          for (let i = 0; i < truth.length; i++) if (truth[i] !== mirror![i]) mismatches++;
        }
      },
      now: () => time,
      schedule: (fn, ms) => {
        const id = nextId++;
        timers.push({ at: time + ms, fn, id });
        return id;
      },
      cancel: (h) => {
        const i = timers.findIndex((t) => t.id === h);
        if (i >= 0) timers.splice(i, 1);
      },
    };
    host = new SimulationHost(env, { seed: 4 });
    host.handle({ kind: 'speed', ticksPerSecond: 30 });
    host.handle({ kind: 'play' });
    const end = 7000;
    for (;;) {
      timers.sort((a, b) => a.at - b.at);
      const next = timers[0];
      if (!next || next.at > end) break;
      timers.shift();
      time = next.at;
      next.fn();
    }
    expect(fulls).toBeGreaterThanOrEqual(3);
    expect(diffs).toBeGreaterThan(fulls);
    expect(mismatches).toBe(0);
  });

  it('a server frame merged for a slow viewer keeps every diff (newest wins) and every contest', () => {
    const sent: FromWorker[] = [];
    let queued: (() => void) | null = null;
    const clock = { now: () => 0, schedule: (fn: () => void) => { queued = fn; return 1; }, cancel: () => { queued = null; } };
    const stream = new ViewerStream((m) => sent.push(m), 100, clock);
    stream.post(frame(1, { landPathsDiff: diff([5, 1], [300, 2]), contests: [1, 1, 1, 1] }));
    stream.post(frame(2, { landPathsDiff: diff([300, 9], [65535, 4]), contests: [2, 2, 2, 2] }));
    (queued as (() => void) | null)?.();
    expect(sent).toHaveLength(1);
    const m = sent[0] as Frame;
    const g = new Uint8Array(65536);
    applyGroundDiff(g, fastBase64Decode(m.landPathsDiff!));
    expect([g[5], g[300], g[65535]]).toEqual([1, 9, 4]);
    expect(m.contests).toEqual([1, 1, 1, 1, 2, 2, 2, 2]);
  });

  it('a full ground in the newer frame drops the older diffs', () => {
    const sent: FromWorker[] = [];
    let queued: (() => void) | null = null;
    const clock = { now: () => 0, schedule: (fn: () => void) => { queued = fn; return 1; }, cancel: () => { queued = null; } };
    const stream = new ViewerStream((m) => sent.push(m), 100, clock);
    stream.post(frame(1, { landPathsDiff: diff([5, 1]) }));
    stream.post(frame(2, { landPaths: 'AAAA' }));
    (queued as (() => void) | null)?.();
    const m = sent[0] as Frame;
    expect(m.landPaths).toBe('AAAA');
    expect(m.landPathsDiff).toBeUndefined();
  });
});
