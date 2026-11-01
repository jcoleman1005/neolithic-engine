import { World } from '../src/sim/world';

const w = new World({}, 42);
const start = performance.now();
const ticks = 3000;
for (let t = 0; t < ticks; t++) {
  w.step();
}
const elapsedMs = performance.now() - start;
const avgMs = elapsedMs / ticks;
console.log(`Phase 0 perf (empty world): ${avgMs.toFixed(3)} ms/tick avg over ${ticks} ticks`);
