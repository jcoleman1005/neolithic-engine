import { CoreLedger } from '../src/core/ledger';
import { CoreWorld } from '../src/core/world';

// Untuned baseline: what do random founders do in the core world? Prints, does not assert.
// Usage: npm run core:smoke -- <ticks> '<json config overrides>'
const ticks = Number(process.argv[2] ?? 3000);
const overrides = JSON.parse(process.argv[3] ?? '{}');
for (const seed of [1, 2, 3, 4]) {
  const world = new CoreWorld({ seed, ...overrides });
  const ledger = new CoreLedger(world);
  let worst = 0;
  const line: string[] = [];
  for (let t = 1; t <= ticks; t++) {
    world.step();
    worst = Math.max(worst, Math.abs(ledger.check().residual));
    if (t % (ticks / 6) === 0) line.push(String(world.population()));
  }
  const { births, deaths, starved, aged } = world.totals;
  console.log(`seed ${seed}: pop by sixth [${line.join(' ')}] births ${births} deaths ${deaths} (starved ${starved}, aged ${aged}) ledger residual ${worst.toExponential(1)}`);
}
