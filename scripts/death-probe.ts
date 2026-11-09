/**
 * Death and birth probe: counts every death by cause and every birth, decade by decade.
 * Wraps people.kill and people.spawn to look at the person's state first; reads only, draws no
 * random numbers, so the run is the same run as without the probe.
 *
 *   npx vite-node scripts/death-probe.ts -- --seed 1 --years 80 [config overrides]
 */
import { World } from '../src/sim/world';
import type { SimulationConfig } from '../src/sim/types';
import { parseArgs } from './args';

const CAUSES = ['oldAge', 'wolf', 'clash', 'starveThirst', 'starveWound', 'starveSick', 'starvePregnant', 'starveChild', 'starveOther'] as const;
type Cause = (typeof CAUSES)[number];

function main(): void {
  const { named, overrides } = parseArgs(process.argv.slice(2), ['seed', 'years', 'every']);
  const w = new World(overrides as Partial<SimulationConfig>, parseInt(named.seed ?? '1', 10));
  const years = parseInt(named.years ?? '80', 10);
  const every = parseInt(named.every ?? '10', 10);
  const tpy = w.config.ticksPerYear || 360;
  const maxAge = w.config.maxAge ?? 21600;
  const adultAge = w.config.adultAge ?? 5760;
  const thirstWarn = w.config.thirstWarn ?? 30;
  const p = w.people;

  let deaths: Record<Cause, number> = Object.fromEntries(CAUSES.map((c) => [c, 0])) as Record<Cause, number>;
  let births = 0, ageSum = 0, n = 0;
  const origKill = p.kill.bind(p);
  p.kill = (slot: number): void => {
    if (p.alive[slot] === 0) return origKill(slot);
    const st = new Error().stack ?? '';
    let c: Cause;
    if (st.includes('wolves.ts')) c = 'wolf';
    else if (st.includes('rules.ts')) c = 'clash';
    else if (p.age[slot] >= maxAge) c = 'oldAge';
    else if (p.hydration[slot] < thirstWarn) c = 'starveThirst';
    else if (p.injury[slot] > 0) c = 'starveWound';
    else if (p.sick[slot] > 0) c = 'starveSick';
    else if (p.pregnant[slot] >= 0) c = 'starvePregnant';
    else if (p.age[slot] < adultAge) c = 'starveChild';
    else c = 'starveOther';
    deaths[c]++;
    ageSum += p.age[slot]; n++;
    origKill(slot);
  };
  const origSpawn = p.spawn.bind(p);
  (p as unknown as { spawn: (...a: unknown[]) => number }).spawn = (...a: unknown[]): number => {
    births++;
    return (origSpawn as (...b: unknown[]) => number)(...a);
  };

  const head = ['years', 'pop', 'births', 'deaths', ...CAUSES, 'meanAgeY'];
  console.log(head.join('\t'));
  for (let y = 1; y <= years; y++) {
    for (let t = 0; t < tpy; t++) w.step();
    if (y % every !== 0) continue;
    const row = [`${y - every + 1}-${y}`, String(p.count), String(births), String(n), ...CAUSES.map((c) => String(deaths[c])), n ? (ageSum / n / tpy).toFixed(1) : '-'];
    console.log(row.join('\t'));
    deaths = Object.fromEntries(CAUSES.map((c) => [c, 0])) as Record<Cause, number>;
    births = 0; ageSum = 0; n = 0;
  }
}
main();
