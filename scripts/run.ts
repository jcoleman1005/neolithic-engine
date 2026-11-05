import { World } from '../src/sim/world';
import type { SimulationConfig } from '../src/sim/types';
import { parseArgs } from './args';

function main(): void {
  // Any config key may follow: --seasonsEnabled false, --seasonAmplitude 0.5
  const { named, overrides } = parseArgs(process.argv.slice(2), ['seed', 'years']);
  const seed = parseInt(named.seed ?? '3', 10);
  const years = parseInt(named.years ?? '50', 10);
  console.log(`Neolithic Engine — Headless run: seed ${seed}, ${years} years (256x256 wrapped)`);

  const world = new World(overrides as Partial<SimulationConfig>, seed);
  const ticksPerYear = world.config.ticksPerYear || 360;

  for (let y = 1; y <= years; y++) {
    const start = performance.now();
    for (let t = 0; t < ticksPerYear; t++) {
      world.step();
    }
    const elapsedMs = performance.now() - start;
    const usPerTick = (elapsedMs * 1000) / ticksPerYear;
    console.log(`Year ${y.toString().padStart(3, ' ')} (tick ${world.tick.toString().padStart(6, ' ')}): population ${world.population} (${usPerTick.toFixed(1)} µs/tick)`);
  }

  console.log(`Finished ${years} years at tick ${world.tick}. Final state hash: ${world.stateHash()}`);
}

main();
