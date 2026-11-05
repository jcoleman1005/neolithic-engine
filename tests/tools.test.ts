import { describe, expect, it } from 'vitest';
import { inflateSync } from 'node:zlib';
import { parseArgs } from '../scripts/args';
import { encodePng } from '../scripts/png';

const KEYS = ['diseaseEnabled', 'seasonAmplitude'];

describe('tool arguments', () => {
  it('separates the tool options from config overrides', () => {
    const r = parseArgs(['--seed', '4', '--seasonAmplitude', '0.5'], ['seed'], KEYS);
    expect(r.named).toEqual({ seed: '4' });
    expect(r.overrides).toEqual({ seasonAmplitude: 0.5 });
  });

  it('turns a switch off with false or 0, since switches test !== false', () => {
    expect(parseArgs(['--diseaseEnabled', 'false'], [], KEYS).overrides.diseaseEnabled).toBe(false);
    expect(parseArgs(['--diseaseEnabled', '0'], [], KEYS).overrides.diseaseEnabled).toBe(false);
    expect(parseArgs(['--diseaseEnabled', '1'], [], KEYS).overrides.diseaseEnabled).toBe(true);
  });

  it('ignores a bare -- separator', () => {
    expect(parseArgs(['--', '--seed', '4'], ['seed'], KEYS).named.seed).toBe('4');
  });

  it('rejects what would otherwise silently change nothing', () => {
    expect(() => parseArgs(['--nope', '1'], [], KEYS)).toThrow(/Unknown/);
    expect(() => parseArgs(['--diseaseEnabled false --seasonAmplitude 0.5'], [], KEYS)).toThrow(/zsh/);
    expect(() => parseArgs(['--diseaseEnabled'], [], KEYS)).toThrow(/no value/);
    expect(() => parseArgs(['--seasonAmplitude', 'high'], [], KEYS)).toThrow(/number/);
    expect(() => parseArgs(['--diseaseEnabled', '2'], [], KEYS)).toThrow(/switch/);
  });
});

describe('png encoder', () => {
  it('writes the signature, size and pixels back out intact', () => {
    const rgb = Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    const png = encodePng(2, 2, rgb);
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(png.readUInt32BE(16)).toBe(2);
    expect(png.readUInt32BE(20)).toBe(2);
    const idat = png.indexOf('IDAT');
    const raw = inflateSync(png.subarray(idat + 4, idat + 4 + png.readUInt32BE(idat - 4)));
    expect([...raw]).toEqual([0, 1, 2, 3, 4, 5, 6, 0, 7, 8, 9, 10, 11, 12]);
  });

  it('refuses a pixel buffer of the wrong size', () => {
    expect(() => encodePng(2, 2, new Uint8Array(3))).toThrow();
  });
});
