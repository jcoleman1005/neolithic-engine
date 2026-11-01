import { World } from '../src/sim/world';

const w = new World({}, 42);
for (let t = 1; t <= 1000; t++) {
  w.step();
}
console.log(`fingerprint: ${w.stateHash()}`);
