/** Statistics for npm run compare: a rank test within a seed and a sign-flip test across seeds. */

export const T95 = [NaN, 12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228];

export function mean(a: number[]): number { return a.reduce((s, v) => s + v, 0) / a.length; }

/** Two-sided p from a standard normal z. */
export function normalP(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return 2 * p;
}

/** Mann-Whitney U test with average ranks for ties and a tie-corrected variance. Returns z and p. */
export function mannWhitney(a: number[], b: number[]): { z: number; p: number } {
  const all: Array<[number, number]> = [...a.map((v): [number, number] => [v, 0]), ...b.map((v): [number, number] => [v, 1])];
  all.sort((x, y) => x[0] - y[0]);
  const n = all.length, n1 = a.length, n2 = b.length;
  let rankA = 0, tieTerm = 0;
  for (let i = 0; i < n; ) {
    let j = i;
    while (j < n && all[j][0] === all[i][0]) j++;
    const r = (i + 1 + j) / 2;
    const t = j - i;
    tieTerm += t * t * t - t;
    for (let k = i; k < j; k++) if (all[k][1] === 0) rankA += r;
    i = j;
  }
  const u = rankA - (n1 * (n1 + 1)) / 2;
  const mu = (n1 * n2) / 2;
  const sigma = Math.sqrt(((n1 * n2) / 12) * (n + 1 - tieTerm / (n * (n - 1))));
  const z = sigma > 0 ? (u - mu) / sigma : 0;
  return { z, p: normalP(z) };
}

/** Exact two-sided sign-flip test on paired differences. */
export function signFlip(diffs: number[]): number {
  const n = diffs.length;
  const observed = Math.abs(mean(diffs));
  let extreme = 0;
  for (let m = 0; m < 1 << n; m++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += m & (1 << i) ? -diffs[i] : diffs[i];
    if (Math.abs(s / n) >= observed - 1e-12) extreme++;
  }
  return extreme / (1 << n);
}

