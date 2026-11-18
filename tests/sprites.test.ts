import { describe, it, expect } from 'vitest';
import { createWorldBoxSpriteAtlas, hexToABGR, PERSON_FRAMES, type SpriteKey } from '../src/render/sprites';

describe('WorldBox Sprite Atlas', () => {
  it('converts hex colors to 32-bit little-endian ABGR integers', () => {
    // Palette colours map to themselves (the limited palette is on by default), so the byte order shows.
    // #d03838 -> (A=255, B=0x38, G=0x38, R=0xd0) -> 0xff3838d0
    expect(hexToABGR('#d03838', 255) >>> 0).toBe(0xff3838d0 >>> 0);
    // #40a048 -> 0xff48a040
    expect(hexToABGR('#40a048', 255) >>> 0).toBe(0xff48a040 >>> 0);
    // #2850a8 -> 0xffa85028, with alpha 128 -> 0x80a85028
    expect(hexToABGR('#2850a8', 128) >>> 0).toBe(0x80a85028 >>> 0);
  });

  it('generates all person stick-figure variants and trees in procedural atlas', () => {
    const atlas = createWorldBoxSpriteAtlas();
    expect(atlas).toBeDefined();
    expect(atlas.canvas.width).toBe(128);
    expect(atlas.canvas.height).toBe(128);

    const requiredKeys: SpriteKey[] = [
      'person_male_idle',
      'person_male_walk_0',
      'person_male_walk_1',
      'person_female_idle',
      'person_female_walk_0',
      'person_female_walk_1',
      'person_pregnant_idle',
      'person_pregnant_walk_0',
      'person_pregnant_walk_1',
      'person_child_idle',
      'person_child_walk_0',
      'person_child_walk_1',
      'person_elder_idle',
      'person_elder_walk_0',
      'person_elder_walk_1',
      'person_starving_idle',
      'person_starving_walk_0',
      'person_starving_walk_1',
      'tree_oak',
      'tree_pine',
      'tree_fruit',
      'selector_chevron',
      'star_leader',
    ];
    for (const type of ['male', 'female', 'pregnant', 'child', 'elder', 'starving'] as const) {
      for (const frame of PERSON_FRAMES) {
        requiredKeys.push(`person_${type}_${frame}` as SpriteKey);
      }
    }

    for (const key of requiredKeys) {
      const rect = atlas.getSprite(key);
      expect(rect, `Sprite key '${key}' should be present`).toBeDefined();
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.w).toBeGreaterThan(0);
      expect(rect.h).toBeGreaterThan(0);
      expect(rect.x + rect.w).toBeLessThanOrEqual(128);
      expect(rect.y + rect.h).toBeLessThanOrEqual(128);
    }
  });

  it('falls back safely to default sprite for unknown keys', () => {
    const atlas = createWorldBoxSpriteAtlas();
    const fallback = atlas.getSprite('unknown_sprite' as any);
    expect(fallback).toBeDefined();
    expect(fallback.w).toBeGreaterThan(0);
  });
});
