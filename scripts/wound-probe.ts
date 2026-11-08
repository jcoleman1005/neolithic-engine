/**
 * Wound probe: where wounds come from, whether wounded people heal, and who dies wounded. Reads only.
 *
 *   npx vite-node scripts/wound-probe.ts -- --seed 1 --years 50 --every 5 [config overrides]
 */
import { World } from '../src/sim/world';
import { parseArgs } from './args';
import { slotFromId } from '../src/sim/people';
import { wrapDiff } from '../src/sim/land';
import { Rules } from '../src/sim/rules';
import { HABIT_BELLIGERENCE, HABIT_COUNT } from '../src/sim/people';

const { named, overrides } = parseArgs(process.argv.slice(2), ['seed', 'years', 'every']);
const w = new World(overrides as never, parseInt(named.seed ?? '1', 10));
const years = parseInt(named.years ?? '40', 10), every = parseInt(named.every ?? '5', 10);
const tpy = 360, adultAge = w.config.adultAge ?? 5760, p = w.people;
let cap = p.capacity, prevInj = new Float32Array(cap), prevPreg = new Int16Array(cap).fill(-1), prevAge = new Int32Array(cap);
const src = { birth: 0, clash: 0, wolf: 0, other: 0 };
const srcChild = { bornCold: 0, clash: 0, other: 0 };
const death = { wounded: 0, unwounded: 0, sev: [0, 0, 0, 0], child: 0, adult: 0, hungry: 0, ageSum: 0 };
let healedOut = 0;
let lastFights = 0, lastYields = 0, lastStrangers = 0;
// Where losers and winners are 90 days after a clash: spotted from the wound jump (+clashInjury for
// the loser, + a quarter of it for the winner), so it measures the same with fear on or off.
const LATER = 90, R = 8, MAXS = 1 << 20;
const sId = new Uint32Array(MAXS), sX = new Uint8Array(MAXS), sY = new Uint8Array(MAXS), sT = new Uint32Array(MAXS), sWin = new Uint8Array(MAXS);
let sHead = 0, sTail = 0;
const away = [[0, 0], [0, 0]]; // [loser, winner] x [checked, away]
const hurtL = w.config.clashInjury ?? 60, hurtW = hurtL * (w.config.clashInjuryWinner ?? 0.25);
const origKill = p.kill.bind(p);
p.kill = (s: number) => {
  if (p.alive[s] === 1 && p.age[s] < (w.config.maxAge ?? 21600)) {
    const inj = p.injury[s];
    if (inj > 0) {
      death.wounded++;
      death.sev[inj < 20 ? 0 : inj < 60 ? 1 : inj < 120 ? 2 : 3]++;
      if (p.age[s] < adultAge) death.child++; else death.adult++;
      death.ageSum += p.age[s];
    } else death.unwounded++;
  }
  origKill(s);
};
console.log('years\tpop\twounded%\tmeanInj\twoundedHealing%\tsrc birth/clash/wolf/other\tchild src bornCold/clash/other\twoundDeaths\tunwoundedDeaths\tsev <20/20-60/60-120/120+\tchild/adult\tmeanAgeY\thealedToZero');
for (let t = 1; t <= years * tpy; t++) {
  w.step();
  if (p.capacity !== cap) { const n = p.capacity; const a = new Float32Array(n); a.set(prevInj); prevInj = a; const b = new Int16Array(n).fill(-1); b.set(prevPreg); prevPreg = b; const c = new Int32Array(n); c.set(prevAge); prevAge = c; cap = n; }
  for (let s = 0; s < cap; s++) {
    if (p.alive[s] === 0) { prevInj[s] = 0; prevPreg[s] = -1; continue; }
    const fresh = p.age[s] < prevAge[s] || p.age[s] === 0; // slot reused
    const was = fresh ? 0 : prevInj[s], now = p.injury[s];
    if (now > was + 0.5) {
      const d = now - was;
      if (p.age[s] <= 1) srcChild.bornCold++;
      else if (prevPreg[s] >= 0 && p.pregnant[s] < 0) src.birth++;
      else if (d >= 140) src.wolf++;
      else if (p.age[s] < adultAge) srcChild[d >= 14 && d <= 61 ? 'clash' : 'other']++;
      else if (Math.abs(d - 60) < 1 || Math.abs(d - 15) < 1) src.clash++;
      if ((Math.abs(d - hurtL) < 0.01 || Math.abs(d - hurtW) < 0.01) && sTail - sHead < MAXS) {
        const i = sTail++ & (MAXS - 1);
        sId[i] = p.idOf(s); sX[i] = p.x[s]; sY[i] = p.y[s]; sT[i] = t; sWin[i] = Math.abs(d - hurtW) < 0.01 ? 1 : 0;
      }
      else src.other++;
    } else if (was > 0 && now === 0) healedOut++;
    prevInj[s] = now; prevPreg[s] = p.pregnant[s]; prevAge[s] = p.age[s];
  }
  while (sHead < sTail && t - sT[sHead & (MAXS - 1)] >= LATER) {
    const i = sHead++ & (MAXS - 1);
    if (!p.isValidId(sId[i])) continue;
    const q = slotFromId(sId[i]);
    const dx = wrapDiff(p.x[q], sX[i]), dy = wrapDiff(p.y[q], sY[i]);
    const a = away[sWin[i]]; a[0]++; if (dx * dx + dy * dy > R * R) a[1]++;
  }
  if (t % (every * tpy) === 0) {
    let bellSum = 0;
    for (let s = 0; s < cap; s++) if (p.alive[s]) bellSum += p.habits[s * HABIT_COUNT + HABIT_BELLIGERENCE];
    const cs = Rules.clashStats;
    // With the contest off, every stranger pairing past the culture gate is a fight.
    const fights = (w.config.contestEnabled !== false ? cs.fights : cs.strangers) - (w.config.contestEnabled !== false ? lastFights : lastStrangers);
    const yields = cs.yields - lastYields;
    lastFights = cs.fights; lastYields = cs.yields; lastStrangers = cs.strangers;
    let n = 0, wd = 0, sum = 0, heal = 0, ad = 0, adF = 0, adFed = 0, preg = 0;
    for (let s = 0; s < cap; s++) if (p.alive[s]) { n++; if (p.age[s] >= adultAge) { ad++; if (p.sex[s] === 0) { adF++; if (p.energy[s] >= 65) adFed++; if (p.pregnant[s] >= 0) preg++; } } if (p.injury[s] > 0) { wd++; sum += p.injury[s]; if (p.energy[s] >= 50) heal++; } }
    const y = t / tpy;
    console.log([`${y - every + 1}-${y}`, n, (100 * wd / n).toFixed(0), wd ? (sum / wd).toFixed(0) : '-', wd ? (100 * heal / wd).toFixed(0) : '-',
      `${src.birth}/${src.clash}/${src.wolf}/${src.other}`, `${srcChild.bornCold}/${srcChild.clash}/${srcChild.other}`,
      death.wounded, death.unwounded, death.sev.join('/'), `${death.child}/${death.adult}`, death.wounded ? (death.ageSum / death.wounded / tpy).toFixed(1) : '-', healedOut, `fights/person/yr ${(fights / Math.max(1, p.count) / every).toFixed(2)} yields/person/yr ${(yields / Math.max(1, p.count) / every).toFixed(2)} bell ${(bellSum / Math.max(1, p.count)).toFixed(0)} losersAway ${(100 * away[0][1] / Math.max(1, away[0][0])).toFixed(1)}% winnersAway ${(100 * away[1][1] / Math.max(1, away[1][0])).toFixed(1)}% adults ${(100*ad/n).toFixed(0)}% women ${adF} fed ${(100*adFed/Math.max(1,adF)).toFixed(0)}% preg ${(100*preg/Math.max(1,adF)).toFixed(0)}%`].join('\t'));
    for (const k of Object.keys(src) as (keyof typeof src)[]) src[k] = 0; for (const k of Object.keys(srcChild) as (keyof typeof srcChild)[]) srcChild[k] = 0;
    death.wounded = death.unwounded = death.child = death.adult = death.ageSum = 0; death.sev = [0, 0, 0, 0]; healedOut = 0; away[0][0] = away[0][1] = away[1][0] = away[1][1] = 0;
  }
}
