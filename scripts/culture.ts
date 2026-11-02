import { World } from '../src/sim/world';
import { Rules } from '../src/sim/rules';
import { HABIT_COUNT } from '../src/sim/people';
import type { SimulationConfig } from '../src/sim/types';

/**
 * Habit spread and stranger clashes per 30 years.
 *   npm run culture -- --seed 1 --years 200 [--experience=off]
 * Spread = mean over the eight habits of the standard deviation across living people.
 */
function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(name);
  return i >= 0 ? parseFloat(process.argv[i + 1]) : fallback;
}

const seed = arg('--seed', 1);
const years = arg('--years', 200);
const period = arg('--period', 30);
const overrides: Partial<SimulationConfig> = {};
if (process.argv.includes('--experience=off')) overrides.experienceHabitsEnabled = false;

const world = new World(overrides, seed);
const tpy = world.config.ticksPerYear || 360;
const people = world.people;

function spread(): number {
  const n = world.population;
  if (n < 2) return 0;
  let total = 0;
  for (let h = 0; h < HABIT_COUNT; h++) {
    let sum = 0;
    let sq = 0;
    for (let s = 0; s < people.capacity; s++) {
      if (people.alive[s] === 0) continue;
      const v = people.habits[s * HABIT_COUNT + h];
      sum += v;
      sq += v * v;
    }
    const mean = sum / n;
    total += Math.sqrt(Math.max(0, sq / n - mean * mean));
  }
  return total / HABIT_COUNT;
}

console.log(`\n=== Culture: seed ${seed}, ${years} years, experience ${overrides.experienceHabitsEnabled === false ? 'OFF' : 'ON'} ===\n`);
console.log('| Year | Pop | Habit spread (SD) | Stranger clashes / yr |');
console.log('|--:|--:|--:|--:|');
console.log(`| 0 | ${world.population} | ${spread().toFixed(1)} | - |`);
Rules.resetClashStats();
let last = 0;
for (let y = 1; y <= years; y++) {
  for (let t = 0; t < tpy; t++) world.step();
  if (y % period === 0 || y === years) {
    const span = y - last;
    console.log(`| ${y} | ${world.population} | ${spread().toFixed(1)} | ${Math.round(Rules.clashStats.strangers / span)} |`);
    Rules.resetClashStats();
    last = y;
  }
}
