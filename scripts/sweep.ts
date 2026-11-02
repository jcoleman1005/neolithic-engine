import * as fs from 'fs';
import { World, type WorldState } from '../src/sim/world';
import type { SimulationConfig } from '../src/sim/types';

/**
 * Screens value sets fast, with live progress. One process, one table at the end.
 *   npm run sweep -- --kind farming|stockpiles --sets sets.json [--seed 1] [--warmup 8] [--years 10] [--part 1/2]
 *
 * How it is fast:
 *  - Warm-up once, feature OFF, to --warmup years; every candidate starts from that saved checkpoint, with the
 *    feature switched on and its overrides applied. (A screening shortcut: the feature arrives at the checkpoint,
 *    so confirm finalists from scratch with the plain scripts or `--warmup 0`.)
 *  - A feature-off world runs in step from the same checkpoint, so population is compared year by year.
 *  - A candidate stops early once it is clearly out of range (see ABORT) for two years running.
 * Live progress: one line per candidate per year goes to stdout as it happens. Run it yourself with
 * `! npm run sweep -- ...` to watch it, or `tail -f` the output of a background run.
 *
 * sets.json: [{ "name": "A", "o": { "tillGain": 0.02 } }, ...]
 * --part i/n runs every n-th set, so n processes can share the cores (check `nproc` and load first).
 */
const argv = process.argv.slice(2);
const arg = (k: string, d: string): string => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const kindName = arg('--kind', '');
const seed = parseFloat(arg('--seed', '1'));
const warmup = parseFloat(arg('--warmup', '8'));
const years = parseFloat(arg('--years', '10'));
const [pi, pn] = arg('--part', '1/1').split('/').map(Number);
const setsFile = arg('--sets', '');
if (!setsFile || (kindName !== 'farming' && kindName !== 'stockpiles')) {
  throw new Error('usage: --kind farming|stockpiles --sets <file.json>');
}
const sets: Array<{ name: string; o: Record<string, number | boolean> }> = JSON.parse(fs.readFileSync(setsFile, 'utf8'));

type M = Record<string, number>;
interface Kind {
  offOverrides: Record<string, boolean>;
  onOverrides: Record<string, boolean>;
  measure(w: World): M;
  line(m: M): string;
  /** Pass/fail against the targets, given the population change against the off run. */
  pass(m: M, dPop: number): boolean;
  /** True when a candidate is clearly out of range and not worth finishing. */
  abort(m: M, dPop: number): boolean;
  targets: string;
}

function scan(w: World, f: (i: number, land: number) => void): number {
  let land = 0;
  for (let i = 0; i < 65536; i++) { if (w.land.isWater[i] === 1) continue; land++; f(i, land); }
  return land;
}

const KINDS: Record<string, Kind> = {
  farming: {
    offOverrides: { farmingPhysicsEnabled: false, stockpilesEnabled: false },
    onOverrides: { farmingPhysicsEnabled: true, stockpilesEnabled: false },
    targets: 'worked 10-35%, desert <15%, seeds <20%, pop within 5%',
    measure(w) {
      const l = w.land; let worked = 0, desert = 0, seeds = 0;
      const land = scan(w, (i) => { if (l.tilled[i] > 0.1) worked++; if (l.soilHealth[i] < 0.6) desert++; if (l.seeds[i] > 0.5) seeds++; });
      return { pop: w.population, worked: worked / land, desert: desert / land, seeds: seeds / land };
    },
    line: (m) => `pop ${m.pop} worked ${(100 * m.worked).toFixed(1)}% desert ${(100 * m.desert).toFixed(1)}% seeds ${(100 * m.seeds).toFixed(1)}%`,
    pass: (m, d) => m.worked >= 0.1 && m.worked <= 0.35 && m.desert < 0.15 && m.seeds < 0.2 && Math.abs(d) <= 0.05,
    abort: (m, d) => m.desert > 0.4 || m.worked > 0.8 || Math.abs(d) > 0.25,
  },
  stockpiles: {
    offOverrides: { stockpilesEnabled: false },
    onOverrides: { stockpilesEnabled: true },
    targets: 'heaps 0.3-5%, granary >=5 cells and <1%, at-cap <20%, pop within 5%',
    measure(w) {
      const l = w.land; let heaps = 0, gran = 0, cap = 0, mass = 0, nests = 0, brush = 0;
      const heapMin = w.config.heapMin ?? 2, pileCap = w.config.pileCap ?? 200;
      const land = scan(w, (i) => { if (l.pile[i] >= heapMin) heaps++; if (l.form[i] === 2) gran++; if (l.form[i] === 3) nests++; brush += l.brush[i]; if (l.pile[i] >= pileCap - 1e-3) cap++; mass += l.pile[i]; });
      return { pop: w.population, heaps: heaps / land, gran, granFrac: gran / land, atCap: heaps ? cap / heaps : 0, mass, nests, brush };
    },
    line: (m) => `pop ${m.pop} heaps ${(100 * m.heaps).toFixed(2)}% granary ${m.gran} nests ${m.nests} mass ${m.mass.toFixed(0)} brush ${m.brush.toFixed(0)} atcap ${(100 * m.atCap).toFixed(0)}%`,
    pass: (m, d) => m.heaps >= 0.003 && m.heaps <= 0.05 && m.gran >= 5 && m.granFrac < 0.01 && m.atCap < 0.2 && Math.abs(d) <= 0.05,
    abort: (m, d) => m.heaps > 0.25 || Math.abs(d) > 0.25,
  },
};
const K = KINDS[kindName];
const tpy = 360;

// Warm-up once, feature off, then checkpoint.
const t0 = Date.now();
const base = new World(K.offOverrides as Partial<SimulationConfig>, seed);
for (let t = 0; t < warmup * tpy; t++) base.step();
const checkpoint = JSON.stringify(base.exportState());
const fork = (o: Record<string, number | boolean>): World => {
  const st = JSON.parse(checkpoint) as WorldState;
  return World.fromState({ ...st, config: { ...st.config, ...o } });
};
console.log(`[${kindName}] seed ${seed}, warm-up ${warmup}y (${((Date.now() - t0) / 1000).toFixed(0)}s), then ${years}y per set; targets: ${K.targets}`);

// Feature-off world in step, one population figure per year.
const off = fork(K.offOverrides);
const offPop: number[] = [];
for (let y = 1; y <= years; y++) { for (let t = 0; t < tpy; t++) off.step(); offPop.push(off.population); }
console.log(`[off] pop by year: ${offPop.join(' ')}`);

const rows: string[] = [];
sets.forEach((s, idx) => {
  if (idx % pn !== pi - 1) return;
  const w = fork({ ...K.onOverrides, ...s.o });
  let bad = 0, stoppedAt = 0, m: M = {}, dPop = 0;
  for (let y = 1; y <= years; y++) {
    for (let t = 0; t < tpy; t++) w.step();
    m = K.measure(w);
    dPop = m.pop / offPop[y - 1] - 1;
    console.log(`[${s.name}] y${y}/${years} ${K.line(m)} vs off ${(100 * dPop).toFixed(1)}%`);
    bad = K.abort(m, dPop) ? bad + 1 : 0;
    if (bad >= 2) { stoppedAt = y; console.log(`[${s.name}] stopped early at y${y}: clearly out of range`); break; }
  }
  rows.push(`${s.name.padEnd(4)} | ${stoppedAt ? 'ABORT y' + stoppedAt : K.pass(m, dPop) ? 'PASS   ' : 'no     '} | ${K.line(m)} | vs off ${(100 * dPop).toFixed(1)}%`);
});
console.log('\nset  | result  | final');
console.log(rows.join('\n'));
