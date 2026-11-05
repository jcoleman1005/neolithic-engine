import { World } from '../src/sim/world';
import type { SimulationConfig } from '../src/sim/types';
import { parseArgs } from './args';

// npm run fingerprint -- [--ticks 1800] [--seed 42] [--someSwitchEnabled false]
const { named, overrides } = parseArgs(process.argv.slice(2), ['ticks', 'seed']);
const ticks = parseInt(named.ticks ?? '1000', 10);
const w = new World(overrides as Partial<SimulationConfig>, parseInt(named.seed ?? '42', 10));
for (let t = 1; t <= ticks; t++) {
  w.step();
}
console.log(`fingerprint: ${w.stateHash()}`);
