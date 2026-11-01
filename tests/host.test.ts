import { describe, expect, it } from 'vitest';
import { SimulationHost, type HostEnvironment } from '../src/sim/host';
import type { FromWorker } from '../src/sim/protocol';
import { World } from '../src/sim/world';

function fakeEnv() {
  let time = 0;
  const timers: { at: number; fn: () => void; id: number }[] = [];
  let nextId = 1;
  const posted: FromWorker[] = [];
  const env: HostEnvironment = {
    post: (m) => posted.push(m),
    now: () => time,
    schedule: (fn, ms) => {
      const id = nextId++;
      timers.push({ at: time + ms, fn, id });
      return id;
    },
    cancel: (handle) => {
      const i = timers.findIndex((t) => t.id === handle);
      if (i >= 0) timers.splice(i, 1);
    },
  };

  const advance = (ms: number) => {
    const end = time + ms;
    for (;;) {
      timers.sort((a, b) => a.at - b.at);
      const next = timers[0];
      if (!next || next.at > end) break;
      timers.shift();
      time = next.at;
      next.fn();
    }
    time = end;
  };
  const frames = () => posted.filter((m): m is Extract<FromWorker, { kind: 'frame' }> => m.kind === 'frame');
  return { env, posted, advance, frames };
}

const SMALL = { seed: 42, worldWidth: 32, worldHeight: 32, gridWidth: 32, gridHeight: 32 };

describe('Simulation host (the Web Worker side)', () => {
  it('sends the terrain and a first frame on start', () => {
    const { env, posted } = fakeEnv();
    new SimulationHost(env, SMALL);
    expect(posted.map((m) => m.kind)).toEqual(['static', 'frame']);
    const first = posted[1] as Extract<FromWorker, { kind: 'frame' }>;
    expect(first.tick).toBe(0);
    expect(first.organisms).toHaveLength(0);
  });

  it('steps once per Step, and runs at the requested speed while playing', () => {
    const { env, advance, frames } = fakeEnv();
    const host = new SimulationHost(env, SMALL);
    host.handle({ kind: 'step' });
    expect(host.world.tick).toBe(1);
    expect(frames().at(-1)).toMatchObject({ tick: 1, fromStep: true });

    host.handle({ kind: 'speed', ticksPerSecond: 20 });
    host.handle({ kind: 'play' });
    advance(1000);
    expect(host.world.tick).toBe(21);
    host.handle({ kind: 'pause' });
    advance(1000);
    expect(host.world.tick).toBe(21);
    host.handle({ kind: 'step' });
    expect(host.world.tick).toBe(22);
  });

  it('gives exactly the same world as stepping a World by hand', () => {
    const { env, advance, frames } = fakeEnv();
    const host = new SimulationHost(env, SMALL);
    host.handle({ kind: 'speed', ticksPerSecond: 60 });
    host.handle({ kind: 'play' });
    advance(1000);
    host.handle({ kind: 'pause' });

    const direct = new World(SMALL, SMALL.seed);
    while (direct.tick < host.world.tick) direct.step();
    const last = frames().at(-1)!;
    expect(last.tick).toBe(direct.tick);
    expect(direct.stateHash()).toBe(host.world.stateHash());
  });

  it('applies live settings, resets with new settings', () => {
    const { env, posted } = fakeEnv();
    const host = new SimulationHost(env, SMALL);
    host.handle({ kind: 'config', config: { ticksPerYear: 720 } });
    expect(host.world.config.ticksPerYear).toBe(720);

    posted.length = 0;
    host.handle({ kind: 'reset', seed: 7, config: { worldWidth: 64, worldHeight: 64 } });
    expect(posted[0]).toMatchObject({ kind: 'static', config: { seed: 7, worldWidth: 64 } });
    expect(host.world.tick).toBe(0);
  });

  it('saves and loads a world', () => {
    const { env, posted, frames } = fakeEnv();
    const host = new SimulationHost(env, SMALL);
    for (let i = 0; i < 40; i++) host.handle({ kind: 'step' });
    host.handle({ kind: 'save', requestId: 9 });
    const saved = (posted.at(-1) as Extract<FromWorker, { kind: 'saved' }>).saved;
    expect(saved).toMatchObject({ format: 'neolithic-world', version: 1, world: { tick: 40 } });
    for (let i = 0; i < 25; i++) host.handle({ kind: 'step' });

    host.handle({ kind: 'load', saved: JSON.parse(JSON.stringify(saved)) });
    expect(host.world.tick).toBe(40);
    expect(posted.at(-2)).toMatchObject({ kind: 'static' });
  });

  it('keeps the current world when a save cannot be loaded', () => {
    const { env, posted } = fakeEnv();
    const host = new SimulationHost(env, SMALL);
    host.handle({ kind: 'step' });
    host.handle({
      kind: 'load',
      saved: { format: 'neolithic-world', version: 1, savedAt: '', world: { formatVersion: 7 } as never, events: [] },
    });
    expect(posted.at(-1)).toMatchObject({ kind: 'error' });
    expect(host.world.tick).toBe(1);
  });
});
