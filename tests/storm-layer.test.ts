import { describe, expect, it } from 'vitest';
import { StormLayer } from '../src/render/storm-layer';

describe('StormLayer tracking', () => {
  it('keeps one storm (same key) as it drifts with the wind between payloads', () => {
    const layer = new StormLayer();
    layer.update([100, 100], 0, 10);
    const key = layer.snapshot()[0].key;
    // 6 ticks a payload at 6 tiles a tick: 36 tiles, further than the base match reach.
    layer.update([130, 80], 2000, 15);
    layer.update([160, 60], 4000, 20);
    layer.update([190, 40], 6000, 25);
    const live = layer.snapshot().filter((s) => !s.gone);
    expect(live).toHaveLength(1);
    expect(live[0].key).toBe(key);
    expect(layer.snapshot()).toHaveLength(1);
  });

  it('does not rebuild storms when the sim pauses after drifting', () => {
    const layer = new StormLayer();
    layer.update([10, 10, 200, 200], 0, 0);
    layer.update([40, 10, 230, 200], 2000, 6);
    const keys = layer.snapshot().map((s) => s.key).sort();
    // Paused: same tick, same places, a fresh payload array.
    layer.update([40, 10, 230, 200], 4000, 6);
    layer.update([40, 10, 230, 200], 6000, 6);
    expect(layer.snapshot().map((s) => s.key).sort()).toEqual(keys);
    expect(layer.snapshot().every((s) => !s.gone)).toBe(true);
  });

  it('follows a storm across the wrapped map edge', () => {
    const layer = new StormLayer();
    layer.update([250, 5], 0, 0);
    const key = layer.snapshot()[0].key;
    layer.update([4, 5], 2000, 2);
    const live = layer.snapshot().filter((s) => !s.gone);
    expect(live).toHaveLength(1);
    expect(live[0].key).toBe(key);
  });

  it('fades out a storm that leaves the payload and starts a new one elsewhere', () => {
    const layer = new StormLayer();
    layer.update([50, 50], 0, 0);
    layer.update([180, 180], 2000, 1);
    const s = layer.snapshot();
    expect(s.filter((x) => x.gone)).toHaveLength(1);
    expect(s.filter((x) => !x.gone)).toHaveLength(1);
  });

  it('ignores a payload it has already seen (same array)', () => {
    const layer = new StormLayer();
    const p = [50, 50];
    layer.update(p, 0, 0);
    layer.update(p, 2000, 5);
    expect(layer.snapshot()).toHaveLength(1);
  });
});
