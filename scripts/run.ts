import { World } from '../src/sim/world';

function parseArgs(): { seed: number; years: number } {
  const args = process.argv.slice(2);
  let seed = 3;
  let years = 50;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--seed' && i + 1 < args.length) {
      seed = parseInt(args[++i], 10);
    } else if (args[i] === '--years' && i + 1 < args.length) {
      years = parseInt(args[++i], 10);
    }
  }

  return { seed, years };
}

function main(): void {
  const { seed, years } = parseArgs();
  console.log(`Neolithic Engine — Headless run: seed ${seed}, ${years} years (256x256 wrapped)`);

  const world = new World({}, seed);
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
