import { World } from '../src/sim/world';
import type { SimulationConfig } from '../src/sim/types';
import { parseArgs } from './args';

// npm run perf -- [--someSwitchEnabled true] (config overrides; none by default)
const { overrides } = parseArgs(process.argv.slice(2), []);

console.log('Benchmarking Neolithic Engine at ~10,000 people...');

// Initialize world with capacity to sustain >= 10,000 people
const world = new World({ initialPopulation: 12500, landFoodMax: 45.0, ...(overrides as Partial<SimulationConfig>) }, 42);

// Warm-up 20 ticks
for (let t = 0; t < 20; t++) {
  world.step();
}

const ticks = 500;
const start = performance.now();
let totalPersonTicks = 0;

for (let t = 0; t < ticks; t++) {
  world.step();
  totalPersonTicks += world.population;
}

const elapsedMs = performance.now() - start;
const avgPopulation = Math.round(totalPersonTicks / ticks);
const msPerTick = elapsedMs / ticks;
const usPerPersonPerTick = (elapsedMs * 1000) / totalPersonTicks;

console.log(`Average population: ${avgPopulation}`);
console.log(`Elapsed time: ${elapsedMs.toFixed(1)} ms for ${ticks} ticks`);
console.log(`Tick duration: ${msPerTick.toFixed(3)} ms/tick`);
console.log(`Perf budget: ${usPerPersonPerTick.toFixed(3)} µs / person / tick (budget: <= 15.0 µs)`);
