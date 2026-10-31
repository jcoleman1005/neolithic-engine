import { CoreWorld } from '../src/core/world';
// What do founders do? Counts chosen actions (via legal+decide is private, so infer from lastOk and energy).
const overrides = JSON.parse(process.argv[2] ?? '{}');
const w = new CoreWorld({ seed: 1, ...overrides });
for (let t = 0; t <= 300; t++) {
  if (t % 50 === 0) {
    let n = 0, e = 0, onFood = 0, canRepro = 0;
    for (let s = 0; s < w.capacity; s++) {
      if (!w.alive[s]) continue;
      n++; e += w.energy[s];
      if (w.food[w.cellOf(s)] > 1) onFood++;
      if (w.energy[s] >= w.config.reproduceThreshold) canRepro++;
    }
    let foodTotal = 0; for (let i = 0; i < w.food.length; i++) foodTotal += w.food[i];
    console.log(`t${t} pop ${n} meanE ${(e / Math.max(n, 1)).toFixed(1)} onFood>1 ${onFood} atThreshold ${canRepro} totalFood ${foodTotal.toFixed(0)} flows eat ${w.flows.plantMeal.toFixed(0)} upkeep ${w.flows.upkeep.toFixed(0)} move ${w.flows.move.toFixed(0)}`);
  }
  w.step();
}
