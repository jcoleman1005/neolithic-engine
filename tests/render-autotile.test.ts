/**
 * tests/render-autotile.test.ts
 */
import { describe, it, expect } from 'vitest';
import { BITMASK_47_LOOKUP, BIT_N, BIT_S, BIT_E, BIT_W, generateAutotileAtlas } from '../src/render/autotile';
import { quantizeElevation01, buildTerraces, createTerraceData } from '../src/render/terrace';
import { hexToABGR, applyAtmosphericHaze, PALETTE } from '../src/render/palette';
import { getWallBitmask, populateWallSpatialMask, WALL_N, WALL_E } from '../src/render/walls';
import {
  createTerrainAtlas,
  T_GRASS,
  T_DIRT,
  T_SAND,
  T_SHALLOWS,
  T_OCEAN,
  T_ROCK,
  T_SNOW,
  CLIFF_S,
  CLIFF_E,
  CLIFF_W,
  CLIFF_SE,
  CLIFF_SW,
  FOAM_N,
  FOAM_S,
} from '../src/render/terrain-tiles';

describe('Planimetric Render Subsystem', () => {
  it('maps all 256 8-neighbor bitmasks to valid canonical 0..46 indices', () => {
    for (let b = 0; b < 256; b++) {
      const idx = BITMASK_47_LOOKUP[b];
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(47);
    }
    // Cardinal symmetry check: single edges
    expect(BITMASK_47_LOOKUP[BIT_N]).toBe(BITMASK_47_LOOKUP[2]);
    expect(BITMASK_47_LOOKUP[BIT_W]).toBe(BITMASK_47_LOOKUP[8]);
  });

  it('runs generateAutotileAtlas safely in headless environment', () => {
    const atlas = generateAutotileAtlas(PALETTE.grass, PALETTE.sand);
    expect(atlas).toBeDefined();
    expect(atlas.width).toBe(16 * 47);
    expect(atlas.height).toBe(16);
  });

  it('correctly quantizes elevation into discrete 0..5 tiers', () => {
    expect(quantizeElevation01(0.10)).toBe(0); // Deep water
    expect(quantizeElevation01(0.35)).toBe(1); // Shore
    expect(quantizeElevation01(0.50)).toBe(2); // Lowland
    expect(quantizeElevation01(0.70)).toBe(3); // Highland
    expect(quantizeElevation01(0.85)).toBe(4); // Crag
    expect(quantizeElevation01(0.95)).toBe(5); // Snow peak
  });

  it('generates bluff drop-shadow flags for lower cells adjacent to higher cells', () => {
    const raw = new Uint16Array(65536);
    // Make cell (10, 10) high peak (Tier 4), neighbors low meadow (Tier 2)
    const center = (10 << 8) | 10;
    raw.fill(Math.floor(0.5 * 65535)); // Tier 2
    raw[center] = Math.floor(0.85 * 65535); // Tier 4

    const data = createTerraceData();
    buildTerraces(raw, data);

    // Cell directly South of peak should flag South drop shadow (flags & 1)
    const southOfCenter = (11 << 8) | 10;
    expect(data.shadowMask[southOfCenter] & 1).toBe(1);

    // Cell directly East of peak should flag East drop shadow (flags & 2)
    const eastOfCenter = (10 << 8) | 11;
    expect(data.shadowMask[eastOfCenter] & 2).toBe(2);
  });

  it('applies atmospheric slate-blue haze monotonically', () => {
    const baseColor = hexToABGR('#608643'); // Lowland grass green (warm earthy)
    const tier0 = applyAtmosphericHaze(baseColor, 0);
    const tier1 = applyAtmosphericHaze(baseColor, 1);
    const tier2 = applyAtmosphericHaze(baseColor, 2);

    expect(tier0).toBe(baseColor);

    const r0 = baseColor & 0xff, g0 = (baseColor >>> 8) & 0xff, b0 = (baseColor >>> 16) & 0xff;
    const r1 = tier1 & 0xff, g1 = (tier1 >>> 8) & 0xff, b1 = (tier1 >>> 16) & 0xff;
    const r2 = tier2 & 0xff, g2 = (tier2 >>> 8) & 0xff, b2 = (tier2 >>> 16) & 0xff;

    // Relative blue-to-warm ratio increases as depth haze deepens
    const blueRatio0 = b0 / (r0 + g0);
    const blueRatio1 = b1 / (r1 + g1);
    const blueRatio2 = b2 / (r2 + g2);

    expect(blueRatio1).toBeGreaterThan(blueRatio0);
    expect(blueRatio2).toBeGreaterThan(blueRatio1);

    // Overall brightness/exposure dims
    const lum0 = r0 + g0 + b0;
    const lum1 = r1 + g1 + b1;
    const lum2 = r2 + g2 + b2;
    expect(lum1).toBeLessThan(lum0);
    expect(lum2).toBeLessThan(lum1);
  });

  it('populates wall spatial mask and computes cardinal connections', () => {
    const mask = new Uint8Array(65536);
    // Two adjacent huts at (5, 5) and (5, 6) [x, y, kind]
    const features = new Uint8Array([
      5, 5, 8, // hut at (5, 5)
      6, 5, 9, // hut at (6, 5)
      5, 4, 10 // hut at (5, 4)
    ]);

    populateWallSpatialMask(features, mask);
    expect(mask[(5 << 8) | 5]).toBe(1);
    expect(mask[(5 << 8) | 6]).toBe(1);
    expect(mask[(4 << 8) | 5]).toBe(1);

    // Cell (5, 5) has neighbors to North (5, 4) and East (6, 5)
    const connections = getWallBitmask(mask, 5, 5);
    expect(connections & WALL_N).toBe(WALL_N);
    expect(connections & WALL_E).toBe(WALL_E);
  });

  it('generates Dwarf Fortress Steam terrain atlases across all 3 themes', () => {
    const themes = ['classic', 'mountainhome', 'wilds'] as const;
    for (const theme of themes) {
      const atlas = createTerrainAtlas(theme);
      expect(atlas).toBeDefined();
      expect(atlas.theme).toBe(theme);
      expect(atlas.canvas.width).toBe(64);
      expect(atlas.canvas.height).toBe(64);

      // Verify all 7 biome kinds and 4 variations have valid coordinates within the 64x64 atlas
      const kinds = [T_GRASS, T_DIRT, T_SAND, T_SHALLOWS, T_OCEAN, T_ROCK, T_SNOW];
      for (const kind of kinds) {
        for (let v = 0; v < 4; v++) {
          const tx = atlas.getTileX(kind, v);
          const ty = atlas.getTileY(kind);
          expect(tx).toBeGreaterThanOrEqual(0);
          expect(tx + 8).toBeLessThanOrEqual(64);
          expect(ty).toBeGreaterThanOrEqual(0);
          expect(ty + 8).toBeLessThanOrEqual(64);
        }
      }

      // Verify cliff faces and shore foam coordinates
      const cliffs = [CLIFF_S, CLIFF_E, CLIFF_W, CLIFF_SE, CLIFF_SW];
      for (const cliff of cliffs) {
        const cx = atlas.getCliffX(cliff);
        const cy = atlas.getCliffY();
        expect(cx).toBeGreaterThanOrEqual(0);
        expect(cx + 8).toBeLessThanOrEqual(64);
        expect(cy).toBeGreaterThanOrEqual(0);
        expect(cy + 8).toBeLessThanOrEqual(64);
      }

      const foams = [FOAM_N, FOAM_S];
      for (const foam of foams) {
        const fx = atlas.getFoamX(foam);
        const fy = atlas.getFoamY();
        expect(fx).toBeGreaterThanOrEqual(0);
        expect(fx + 8).toBeLessThanOrEqual(64);
        expect(fy).toBeGreaterThanOrEqual(0);
        expect(fy + 8).toBeLessThanOrEqual(64);
      }
    }
  });
});
