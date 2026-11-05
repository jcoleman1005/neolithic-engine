/**
 * S1a probe: does staying near a camp pay today? Compares people near built cells or food heaps with
 * people away from them, over 30-tick windows. Only reads the world.
 *
 *   npm run probe -- --seed 1 --years 20 [any config overrides]
 */
import { World } from '../src/sim/world';
import { FORM_NEST } from '../src/sim/land';
import { isBuiltCell } from '../src/sim/settlements';
import { slotFromId } from '../src/sim/people';
import type { SimulationConfig } from '../src/sim/types';
import { parseArgs } from './args';

const CELLS = 65536;
const WINDOW = 30;
const RADIUS = 3;

interface Zone { n: number; energy: number; gain: number; survivors: number; died: number; stayed: number; wounded: number; injury: number; newborn: number; residents: number }
const zone = (): Zone => ({ n: 0, energy: 0, gain: 0, survivors: 0, died: 0, stayed: 0, wounded: 0, injury: 0, newborn: 0, residents: 0 });

function campMask(w: World, out: Uint8Array): void {
  out.fill(0);
  for (let c = 0; c < CELLS; c++) {
    if (!isBuiltCell(w.land, c) && w.land.pile[c] <= 1) continue;
    const x = c & 255, y = c >> 8;
    for (let dy = -RADIUS; dy <= RADIUS; dy++) for (let dx = -RADIUS; dx <= RADIUS; dx++) out[(((y + dy) & 255) << 8) | ((x + dx) & 255)] = 1;
  }
}

function main(): void {
  const { named, overrides } = parseArgs(process.argv.slice(2), ['seed', 'years']);
  const w = new World(overrides as Partial<SimulationConfig>, parseInt(named.seed ?? '1', 10));
  const years = parseInt(named.years ?? '20', 10);
  const zones = [zone(), zone()]; // 0 away, 1 camp
  const mask = new Uint8Array(CELLS);
  const crowd = new Uint16Array(CELLS);
  let ids = new Uint32Array(0), zs = new Uint8Array(0), es = new Float32Array(0), count = 0;
  let shelterTiles = 0, shelterPeople = 0, over4 = 0;
  const p = w.people;
  const total = years * (w.config.ticksPerYear || 360);
  for (let t = 1; t <= total; t++) {
    w.step();
    if (t % WINDOW !== 0) continue;
    campMask(w, mask);
    // Close the last window: who survived, where they are now, how their energy moved.
    for (let i = 0; i < count; i++) {
      const z = zones[zs[i]];
      if (!p.isValidId(ids[i])) { z.died++; continue; }
      const s = slotFromId(ids[i]);
      z.survivors++;
      z.gain += p.energy[s] - es[i];
      if (zs[i] === 1 && mask[(p.y[s] << 8) | p.x[s]] === 1) z.stayed++;
    }
    // Open the next one, after a two-year warm-up.
    if (t < 720) { count = 0; continue; }
    if (ids.length < p.capacity) { ids = new Uint32Array(p.capacity); zs = new Uint8Array(p.capacity); es = new Float32Array(p.capacity); }
    count = 0;
    crowd.fill(0);
    for (let s = 0; s < p.capacity; s++) {
      if (p.alive[s] === 0) continue;
      const c = (p.y[s] << 8) | p.x[s];
      crowd[c]++;
      const k = mask[c];
      const z = zones[k];
      z.n++;
      z.energy += p.energy[s];
      if (p.injury[s] > 0) z.wounded++;
      z.injury += p.injury[s];
      if (p.age[s] < WINDOW) z.newborn++;
      ids[count] = p.idOf(s); zs[count] = k; es[count] = p.energy[s]; count++;
    }
    for (let c = 0; c < CELLS; c++) {
      if (crowd[c] === 0) continue;
      if (w.land.structure[c] === 1 || w.land.form[c] === FORM_NEST) {
        shelterTiles++; shelterPeople += crowd[c];
        if (crowd[c] > 4) over4++;
      }
    }
  }
  const pct = (a: number, b: number): string => (b > 0 ? ((100 * a) / b).toFixed(1) : '-') + '%';
  for (const [name, z] of [['away', zones[0]], ['camp', zones[1]]] as const) {
    const closed = z.survivors + z.died;
    console.log(
      `${name}: share ${pct(z.n, zones[0].n + zones[1].n)}, energy ${(z.energy / z.n).toFixed(1)}, ` +
      `gain/30t ${(z.gain / Math.max(1, z.survivors)).toFixed(2)}, deaths/30t ${pct(z.died, closed)}, ` +
      `newborn share ${pct(z.newborn, z.n)}, wounded ${pct(z.wounded, z.n)}, mean injury ${(z.injury / z.n).toFixed(1)}` +
      (name === 'camp' ? `, still in a camp 30t later ${pct(z.stayed, z.survivors)}` : '')
    );
  }
  console.log(`occupied hut/nest tiles: mean ${(shelterPeople / Math.max(1, shelterTiles)).toFixed(1)} people, over 4 on ${pct(over4, shelterTiles)}`);
}

main();
