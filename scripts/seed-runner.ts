import { World } from '../src/sim/world';

const seed = parseInt(process.argv[2] ?? '1', 10);
const years = parseInt(process.argv[3] ?? '200', 10);

const world = new World({}, seed);
const ticksPerYear = world.config.ticksPerYear || 360;

let minPop = Infinity;
let maxPop = -Infinity;
let y25 = 0;
let y50 = 0;
let y100 = 0;
let y150 = 0;
let y200 = 0;

const t0 = performance.now();
for (let y = 1; y <= years; y++) {
  for (let t = 0; t < ticksPerYear; t++) {
    world.step();
  }
  const pop = world.population;
  if (y === 25) { y25 = pop; console.log(`[Seed ${seed}] Year 25: pop ${pop}`); }
  if (y === 50) { y50 = pop; console.log(`[Seed ${seed}] Year 50: pop ${pop}`); }
  if (y === 100) { y100 = pop; console.log(`[Seed ${seed}] Year 100: pop ${pop}`); }
  if (y === 150) { y150 = pop; console.log(`[Seed ${seed}] Year 150: pop ${pop}`); }
  if (y === 200) { y200 = pop; console.log(`[Seed ${seed}] Year 200: pop ${pop}`); }

  if (y >= 20) {
    if (pop < minPop) minPop = pop;
    if (pop > maxPop) maxPop = pop;
  }
}
const elapsedSec = ((performance.now() - t0) / 1000).toFixed(1);

console.log(JSON.stringify({
  seed,
  elapsedSec,
  y25,
  y50,
  y100,
  y150,
  y200,
  minPopAfterSettled: minPop,
  maxPopAfterSettled: maxPop,
  finalHash: world.stateHash(),
}));
