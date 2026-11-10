import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../src/sim/config';
import { FEATURE_GROUPS, FEATURE_SWITCHES, blockedBy, enabledKeysOf, type FeatureKey } from '../src/ui/feature-switches';

describe('feature switch table', () => {
  const configKeys = enabledKeysOf(DEFAULT_CONFIG);
  const tableKeys = FEATURE_SWITCHES.map((f) => f.key as string);

  it('has an entry for every *Enabled key in DEFAULT_CONFIG', () => {
    const missing = configKeys.filter((k) => !tableKeys.includes(k));
    expect(missing, 'add these to FEATURE_SWITCHES in src/ui/feature-switches.ts').toEqual([]);
  });

  it('names only keys that exist, once each', () => {
    const unknown = tableKeys.filter((k) => !configKeys.includes(k));
    expect(unknown).toEqual([]);
    expect(new Set(tableKeys).size).toBe(tableKeys.length);
  });

  it('every switch defaults to a boolean and has a group, label and help', () => {
    for (const f of FEATURE_SWITCHES) {
      expect(typeof (DEFAULT_CONFIG as unknown as Record<string, unknown>)[f.key], f.key).toBe('boolean');
      expect(FEATURE_GROUPS).toContain(f.group);
      expect(f.label.length, f.key).toBeGreaterThan(0);
      expect(f.help.length, f.key).toBeGreaterThan(0);
    }
  });

  it('requirements name real switches, never the switch itself', () => {
    for (const f of FEATURE_SWITCHES) {
      for (const r of [...(f.requires ?? []), ...(f.requiresOff ?? [])]) {
        expect(tableKeys, `${f.key} -> ${r}`).toContain(r);
        expect(r).not.toBe(f.key);
      }
    }
  });

  it('blocks a child when a parent, or a grandparent, is off', () => {
    const on = (off: FeatureKey[]) => (k: FeatureKey) => !off.includes(k);
    expect(blockedBy('windShadowEnabled', on([]))).toBeNull();
    expect(blockedBy('windShadowEnabled', on(['exposureEnabled']))).toBe('needs Wind exposure');
    // fireDetersWolves needs fires, which needs cold.
    expect(blockedBy('fireDetersWolvesEnabled', on(['coldEnabled']))).toBe('needs Campfires');
    expect(blockedBy('clashCourageEnabled', on([]))).toMatch(/only when Weighed fights is off/);
    expect(blockedBy('clashCourageEnabled', on(['contestEnabled']))).toBeNull();
  });
});
