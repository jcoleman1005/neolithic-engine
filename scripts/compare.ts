/**
 * Is there a real difference between two sets of runs? Reads sample files written by
 * `npm run map -- --samples <file>`, pairs them by seed, and reports:
 *  - per seed: the two means and a Mann-Whitney rank test (normal approximation);
 *  - across seeds: the mean paired difference, a 95% interval (t), and an exact sign-flip test.
 *
 *   npm run compare -- --a "off1.json,off2.json" --b "on1.json,on2.json"
 */
import { readFileSync } from 'node:fs';
import { parseArgs } from './args';
import { mannWhitney, mean, signFlip, T95 } from './stats';

interface SampleFile { seed: number; samples: number[] }

function main(): void {
  const { named } = parseArgs(process.argv.slice(2), ['a', 'b'], []);
  if (!named.a || !named.b) throw new Error('usage: --a "f1,f2" --b "f1,f2" (sample files from npm run map -- --samples)');
  const load = (list: string): SampleFile[] => list.split(',').map((f) => JSON.parse(readFileSync(f.trim(), 'utf8')) as SampleFile);
  const a = load(named.a), b = load(named.b);
  const diffs: number[] = [];
  console.log('seed   mean A   mean B   B - A    rank test z    p');
  for (const fa of a) {
    const fb = b.find((f) => f.seed === fa.seed);
    if (!fb) continue;
    const ma = mean(fa.samples), mb = mean(fb.samples);
    const mw = mannWhitney(fb.samples, fa.samples);
    diffs.push(mb - ma);
    console.log(`${String(fa.seed).padEnd(6)} ${ma.toFixed(2).padStart(7)}  ${mb.toFixed(2).padStart(7)}  ${(mb - ma).toFixed(2).padStart(6)}  ${mw.z.toFixed(1).padStart(12)}  ${mw.p < 1e-4 ? '<0.0001' : mw.p.toFixed(4)}`);
  }
  const n = diffs.length;
  const md = mean(diffs);
  const sd = Math.sqrt(diffs.reduce((s, v) => s + (v - md) ** 2, 0) / Math.max(1, n - 1));
  const half = n > 1 ? (T95[Math.min(n - 1, 10)] * sd) / Math.sqrt(n) : NaN;
  const p = signFlip(diffs);
  console.log(`\nAcross ${n} seeds: mean difference B - A ${md.toFixed(3)}, 95% interval ${(md - half).toFixed(3)} to ${(md + half).toFixed(3)}, sign-flip p ${p.toFixed(4)}`);
  console.log(p < 0.05 && (md - half > 0 || md + half < 0) ? 'Significant difference.' : 'No significant difference.');
}

main();
