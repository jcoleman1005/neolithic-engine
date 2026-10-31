import { PRNG } from '../sim/prng';

/** Smooth seeded value noise in [0, 1]: two octaves of bilinear lattice noise. */
export function noiseField(width: number, height: number, scale: number, seed: number | string): Float64Array {
  const rng = new PRNG(seed);
  const octave = (cell: number): Float64Array => {
    const gw = Math.ceil(width / cell) + 2;
    const gh = Math.ceil(height / cell) + 2;
    const lattice = new Float64Array(gw * gh);
    for (let i = 0; i < lattice.length; i++) lattice[i] = rng.next();
    const out = new Float64Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const fx = x / cell;
        const fy = y / cell;
        const ix = Math.floor(fx);
        const iy = Math.floor(fy);
        const tx = smooth(fx - ix);
        const ty = smooth(fy - iy);
        const a = lattice[iy * gw + ix];
        const b = lattice[iy * gw + ix + 1];
        const c = lattice[(iy + 1) * gw + ix];
        const d = lattice[(iy + 1) * gw + ix + 1];
        out[y * width + x] = a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
      }
    }
    return out;
  };
  const coarse = octave(Math.max(2, scale));
  const fine = octave(Math.max(2, scale / 2));
  const out = new Float64Array(width * height);
  for (let i = 0; i < out.length; i++) out[i] = coarse[i] * 0.7 + fine[i] * 0.3;
  return out;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}
