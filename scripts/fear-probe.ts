/**
 * Fear probe: compares frightened people with everyone else, and a fear-on world with a fear-off
 * one. Every 30 ticks it samples, by group: share standing still, plant food under them, steps from
 * fresh water, energy, and energy change over the window; plus how often each group loses a clash.
 * Reads only.
 *
 *   npx vite-node scripts/fear-probe.ts -- --seed 1 --from 10 --years 35 [config overrides]
 */
import { World } from '../src/sim/world';
import { parseArgs } from './args';
import { slotFromId } from '../src/sim/people';
import { Rules } from '../src/sim/rules';

const { named, overrides } = parseArgs(process.argv.slice(2), ['seed', 'years', 'from']);
const w = new World(overrides as never, parseInt(named.seed ?? '1', 10));
const years = parseInt(named.years ?? '35', 10), from = parseInt(named.from ?? '10', 10);
const p = w.people, land = w.land, tpy = 360, adultAge = w.config.adultAge ?? 5760, WIN = 30;
const hurtL = w.config.clashInjury ?? 60;
const G = ['inside', 'outside', 'none'];
const acc = G.map(() => ({ n: 0, still: 0, food: 0, water: 0, energy: 0, gainN: 0, gain: 0, losses: 0, ticksAlive: 0, cap: 0 }));
let ids = new Uint32Array(0), gs = new Uint8Array(0), es = new Float32Array(0), cnt = 0;
let prevInj = new Float32Array(p.capacity), prevId = new Uint32Array(p.capacity), prevG = new Uint8Array(p.capacity).fill(2);
const group = (s: number): number => (p.fear[s] <= 0 ? 2 : Rules.inFearRegion(s, p, w.config) ? 0 : 1);
for (let t = 1; t <= years * tpy; t++) {
  w.step();
  if (prevInj.length < p.capacity) { const a = new Float32Array(p.capacity); a.set(prevInj); prevInj = a; const b = new Uint32Array(p.capacity); b.set(prevId); prevId = b; const c = new Uint8Array(p.capacity).fill(2); c.set(prevG); prevG = c; }
  const sampling = t >= from * tpy;
  for (let s = 0; s < p.capacity; s++) {
    if (p.alive[s] === 0) { prevInj[s] = 0; prevId[s] = 0; continue; }
    const id = p.idOf(s);
    const was = prevId[s] === id ? prevInj[s] : 0;
    if (sampling && p.age[s] >= adultAge) {
      // A loss counts for the group the person was in before it.
      const g = prevId[s] === id ? prevG[s] : 2;
      acc[g].ticksAlive++;
      if (Math.abs(p.injury[s] - was - hurtL) < 0.01) acc[g].losses++;
    }
    prevInj[s] = p.injury[s]; prevId[s] = id; prevG[s] = group(s);
  }
  if (!sampling || t % WIN !== 0) continue;
  for (let i = 0; i < cnt; i++) {
    if (!p.isValidId(ids[i])) continue;
    const a = acc[gs[i]]; a.gainN++; a.gain += p.energy[slotFromId(ids[i])] - es[i];
  }
  if (ids.length < p.capacity) { ids = new Uint32Array(p.capacity); gs = new Uint8Array(p.capacity); es = new Float32Array(p.capacity); }
  cnt = 0;
  for (let s = 0; s < p.capacity; s++) {
    if (p.alive[s] === 0 || p.age[s] < adultAge) continue;
    const g = group(s), a = acc[g], c = (p.y[s] << 8) | p.x[s];
    a.n++; if (p.prevDir[s] === 4) a.still++;
    a.food += land.food[c]; a.cap += land.capacityAt(c, w.config); a.water += land.waterDist[c]; a.energy += p.energy[s];
    ids[cnt] = p.idOf(s); gs[cnt] = g; es[cnt] = p.energy[s]; cnt++;
  }
}
console.log('adults, years ' + from + ' to ' + years + '\tshare\tstill%\tfood\tcapacity\tstepsFromWater\tenergy\tgain/30t\tlosses/yr');
const tot = acc.reduce((x, a) => x + a.n, 0);
acc.forEach((a, i) => {
  if (!a.n) return;
  console.log([G[i], (100 * a.n / tot).toFixed(1) + '%', (100 * a.still / a.n).toFixed(1), (a.food / a.n).toFixed(1), (a.cap / a.n).toFixed(1), (a.water / a.n).toFixed(1), (a.energy / a.n).toFixed(1), (a.gain / Math.max(1, a.gainN)).toFixed(2), (360 * a.losses / Math.max(1, a.ticksAlive)).toFixed(2)].join('\t'));
});
const all = acc.reduce((x, a) => ({ n: x.n + a.n, still: x.still + a.still, food: x.food + a.food, cap: x.cap + a.cap, water: x.water + a.water, energy: x.energy + a.energy, gain: x.gain + a.gain, gainN: x.gainN + a.gainN, losses: x.losses + a.losses, ticksAlive: x.ticksAlive + a.ticksAlive }), { n: 0, still: 0, food: 0, cap: 0, water: 0, energy: 0, gain: 0, gainN: 0, losses: 0, ticksAlive: 0 });
console.log(['all', '100%', (100 * all.still / all.n).toFixed(1), (all.food / all.n).toFixed(1), (all.cap / all.n).toFixed(1), (all.water / all.n).toFixed(1), (all.energy / all.n).toFixed(1), (all.gain / Math.max(1, all.gainN)).toFixed(2), (360 * all.losses / Math.max(1, all.ticksAlive)).toFixed(2)].join('\t'));
