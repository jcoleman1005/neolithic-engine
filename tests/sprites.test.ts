import { describe, it, expect } from 'vitest';
import { createWorldBoxSpriteAtlas, hexToABGR, type SpriteKey } from '../src/render/sprites';

describe('WorldBox Sprite Atlas', () => {
  it('converts hex colors to 32-bit little-endian ABGR integers', () => {
    // Red: #ff0000 -> (A=255, B=0, G=0, R=255) -> 0xff0000ff
    const red = hexToABGR('#ff0000', 255);
    expect(red >>> 0).toBe(0xff0000ff >>> 0);

    // Green: #00ff00 -> (A=255, B=0, G=255, R=0) -> 0xff00ff00
    const green = hexToABGR('#00ff00', 255);
    expect(green >>> 0).toBe(0xff00ff00 >>> 0);

    // Blue: #0000ff -> (A=255, B=255, G=0, R=0) -> 0xffff0000
    const blue = hexToABGR('#0000ff', 255);
    expect(blue >>> 0).toBe(0xffff0000 >>> 0);
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
    ];

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
