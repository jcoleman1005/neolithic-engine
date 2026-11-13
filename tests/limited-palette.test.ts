import { describe, expect, it } from 'vitest';
import {
  BAND_COLOURS, LIMITED, LIMITED_PALETTE, paletteCss, paletteHex, quantizeABGR, quantizeImage, quantizeOver,
} from '../src/render/limited-palette';
import {
  PALETTE_LIMITED_CLASSIC, PALETTE_LIMITED_MOUNTAINHOME, PALETTE_LIMITED_WILDS, getPaletteForTheme, hexToABGR,
} from '../src/render/palette';

const PAL = new Set(LIMITED_PALETTE);
const abgr = (hex: string): number => {
  const v = parseInt(hex.slice(1), 16);
  return (0xff000000 | ((v & 0xff) << 16) | (v & 0xff00) | (v >> 16)) >>> 0;
};
const hexOf = (c: number): string =>
  '#' + [c & 0xff, (c >> 8) & 0xff, (c >> 16) & 0xff].map((v) => v.toString(16).padStart(2, '0')).join('');

describe('limited palette (viewer)', () => {
  it('is on by default outside a browser, with 34 distinct colours, each RGB555-exact (GBA)', () => {
    expect(LIMITED).toBe(true);
    expect(PAL.size).toBe(34);
    for (const h of PAL) for (const k of [1, 3, 5]) expect(parseInt(h.slice(k, k + 2), 16) % 8).toBe(0);
  });

  it('every hand-picked ramp and band colour is a palette colour', () => {
    for (const set of [PALETTE_LIMITED_CLASSIC, PALETTE_LIMITED_MOUNTAINHOME, PALETTE_LIMITED_WILDS]) {
      for (const ramp of Object.values(set)) {
        for (const h of [ramp.highlightHex, ramp.baseHex, ramp.shadowHex, ramp.rimHex]) expect(PAL.has(h)).toBe(true);
      }
    }
    for (const b of BAND_COLOURS) expect(PAL.has(b)).toBe(true);
    expect(getPaletteForTheme('wilds')).toBe(PALETTE_LIMITED_WILDS);
  });

  it('maps any colour into the palette, keeping hand picks and alpha', () => {
    expect(paletteHex('#2563eb')).toBe('#3880d0'); // the man's tunic, picked by hand
    for (const h of ['#000000', '#ffffff', '#ff00ff', '#123456', '#0b0f19']) expect(PAL.has(paletteHex(h))).toBe(true);
    expect(hexOf(hexToABGR('#ff3b1f'))).toBe(paletteHex('#ff3b1f'));
    expect(paletteCss('rgba(20, 24, 36, 0.75)')).toMatch(/^rgba\(\d+, \d+, \d+, 0\.75\)$/);
    expect(paletteCss('hsl(200, 85%, 55%)')).toMatch(/^rgb\(/);
    expect(paletteCss('#fff')).toBe(paletteHex('#ffffff'));
    expect(paletteCss('600 11px system-ui')).toBe('600 11px system-ui');
  });

  it('snaps image data in place, leaving clear pixels and keeping alpha', () => {
    const d = new Uint32Array([0, abgr('#ff00ff'), (0x80000000 | 0x123456) >>> 0, abgr('#40a048')]);
    quantizeImage(d, 4);
    expect(d[0]).toBe(0);
    expect(PAL.has(hexOf(d[1]))).toBe(true);
    expect(d[2] >>> 24).toBe(0x80);
    expect(PAL.has(hexOf(d[2]))).toBe(true);
    expect(d[3]).toBe(abgr('#40a048'));
    expect(quantizeABGR(abgr('#101828'))).toBe(abgr('#101828'));
  });

  it('makes an overlay solid in the palette, and a faint one clear', () => {
    const ground = new Uint32Array([abgr('#40a048'), abgr('#40a048')]);
    const strong = ((235 << 24) | (abgr('#f8e090') & 0xffffff)) >>> 0;
    const faint = ((20 << 24) | (abgr('#f8e090') & 0xffffff)) >>> 0;
    const d = new Uint32Array([strong, faint]);
    quantizeOver(d, ground, 2);
    expect(d[0] >>> 24).toBe(255);
    expect(PAL.has(hexOf(d[0]))).toBe(true);
    expect(d[0] & 0xffffff).not.toBe(ground[0] & 0xffffff);
    expect(d[1]).toBe(0);
  });
});
