/**
 * Headless map images, so an agent can look at what a run built without a browser.
 *
 *   npm run map -- --seed 1 --years 20 --every 5 --out scratch/map [--scale 4] [--save scratch/w/world.json] [--stagesEnabled false]
 *
 * Writes <out>-yNN.png at each snapshot and prints one stats line. Only reads the world.
 *
 * Colours: water blue; land green, brighter with plant food; woodland dark green; rock grey-brown;
 * tilled soil tan; heap orange; granary gold; nest brown; hut white; fire red; cave black;
 * set-down stone not yet a hut pale grey; people magenta, brighter when more share a tile.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { World } from '../src/sim/world';
import { FORM_GRANARY, FORM_HEAP, FORM_NEST } from '../src/sim/land';
import type { SimulationConfig } from '../src/sim/types';
import type { SavedWorld } from '../src/sim/protocol';
import { parseArgs } from './args';
import { encodePng } from './png';

const SIZE = 256;
const CELLS = SIZE * SIZE;
/** Built cells this close (in tiles) count as one cluster. */
const CLUSTER_GAP = 2;
/** An adult this close to a built cell counts as in a camp. */
const NEAR_RADIUS = 3;

function isBuilt(w: World, c: number): boolean {
  const f = w.land.form[c];
  return f === FORM_NEST || f === FORM_GRANARY || w.land.structure[c] === 1 || w.land.fire[c] === 1;
}

/** Colours one map cell from the land under it. */
function cellColor(w: World, c: number, out: Uint8Array, o: number): void {
  const l = w.land;
  let r: number, g: number, b: number;
  if (l.isWater[c] === 1) {
    r = 30; g = 60; b = 110;
  } else {
    const max = l.maxFood[c] > 0 ? l.maxFood[c] : 1;
    const v = Math.min(1, l.food[c] / max);
    if (l.stone[c] > 0 || l.upland[c] > 0.6) { r = 96; g = 88; b = 78; }
    else if (l.wooded[c] === 1 && l.treeMax[c] > 0) { r = 22; g = 62 + v * 25; b = 30; }
    else { r = 44 + v * 20; g = 70 + v * 70; b = 40; }
    if (l.tilled[c] > 0.3) { r = 130; g = 104; b = 62; }
    if (l.durability[c] > 0) { r = 170; g = 170; b = 165; }
    if (l.form[c] === FORM_HEAP || l.pile[c] > 1) { r = 230; g = 130; b = 30; }
    if (l.form[c] === FORM_GRANARY) { r = 245; g = 205; b = 60; }
    if (l.form[c] === FORM_NEST) { r = 120; g = 72; b = 34; }
    if (l.structure[c] === 1) { r = 250; g = 250; b = 250; }
    if (l.cave[c] === 1) { r = 0; g = 0; b = 0; }
    if (l.fire[c] === 1) { r = 255; g = 40; b = 20; }
  }
  out[o] = r; out[o + 1] = g; out[o + 2] = b;
}

function render(w: World, scale: number, path: string): void {
  const counts = new Uint16Array(CELLS);
  const p = w.people;
  for (let s = 0; s < p.capacity; s++) {
    if (p.alive[s] === 1) counts[(p.y[s] << 8) | p.x[s]]++;
  }
  const px = SIZE * scale;
  const rgb = new Uint8Array(px * px * 3);
  const cell = new Uint8Array(3);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const c = (y << 8) | x;
      cellColor(w, c, cell, 0);
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const o = ((y * scale + dy) * px + x * scale + dx) * 3;
          rgb[o] = cell[0]; rgb[o + 1] = cell[1]; rgb[o + 2] = cell[2];
        }
      }
      // People take the middle of the cell, so what they stand on still shows round the edge.
      if (counts[c] > 0) {
        const v = Math.min(255, 110 + counts[c] * 25);
        const m = scale >= 3 ? 1 : 0;
        for (let dy = m; dy < scale - m; dy++) {
          for (let dx = m; dx < scale - m; dx++) {
            const o = ((y * scale + dy) * px + x * scale + dx) * 3;
            rgb[o] = v; rgb[o + 1] = 0; rgb[o + 2] = v;
          }
        }
      }
    }
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, encodePng(px, px, rgb));
}

interface Cluster { readonly size: number; readonly x: number; readonly y: number }

/** Groups built cells within CLUSTER_GAP tiles, across the wrap. Biggest first. */
function clusters(w: World): Cluster[] {
  const seen = new Uint8Array(CELLS);
  const queue = new Int32Array(CELLS);
  const found: Cluster[] = [];
  for (let start = 0; start < CELLS; start++) {
    if (seen[start] === 1 || !isBuilt(w, start)) continue;
    let head = 0, tail = 0;
    queue[tail++] = start;
    seen[start] = 1;
    const x0 = start & 255, y0 = start >> 8;
    let sumX = 0, sumY = 0;
    while (head < tail) {
      const c = queue[head++];
      const x = c & 255, y = c >> 8;
      // Offsets from the first cell, unwrapped, so a cluster across the edge has a true centre.
      sumX += ((x - x0 + 384) % 256) - 128;
      sumY += ((y - y0 + 384) % 256) - 128;
      for (let dy = -CLUSTER_GAP; dy <= CLUSTER_GAP; dy++) {
        for (let dx = -CLUSTER_GAP; dx <= CLUSTER_GAP; dx++) {
          const n = (((y + dy) & 255) << 8) | ((x + dx) & 255);
          if (seen[n] === 0 && isBuilt(w, n)) { seen[n] = 1; queue[tail++] = n; }
        }
      }
    }
    found.push({
      size: tail,
      x: (x0 + Math.round(sumX / tail) + 256) % 256,
      y: (y0 + Math.round(sumY / tail) + 256) % 256,
    });
  }
  return found.sort((a, b) => b.size - a.size);
}

function statsLine(w: World, year: number): string {
  const l = w.land;
  let heaps = 0, granaries = 0, nests = 0, huts = 0, fires = 0;
  const near = new Uint8Array(CELLS);
  for (let c = 0; c < CELLS; c++) {
    if (l.form[c] === FORM_HEAP) heaps++;
    if (l.form[c] === FORM_GRANARY) granaries++;
    if (l.form[c] === FORM_NEST) nests++;
    if (l.structure[c] === 1) huts++;
    if (l.fire[c] === 1) fires++;
    if (isBuilt(w, c)) {
      const x = c & 255, y = c >> 8;
      for (let dy = -NEAR_RADIUS; dy <= NEAR_RADIUS; dy++) {
        for (let dx = -NEAR_RADIUS; dx <= NEAR_RADIUS; dx++) near[(((y + dy) & 255) << 8) | ((x + dx) & 255)] = 1;
      }
    }
  }
  const p = w.people;
  const adultAge = w.config.adultAge ?? 5760;
  let adults = 0, adultsNear = 0;
  for (let s = 0; s < p.capacity; s++) {
    if (p.alive[s] === 1 && p.age[s] >= adultAge) {
      adults++;
      if (near[(p.y[s] << 8) | p.x[s]] === 1) adultsNear++;
    }
  }
  const cs = clusters(w);
  const camps = cs.filter((c) => c.size >= 3);
  const top = cs[0] ? `${cs[0].size} at ${cs[0].x},${cs[0].y}` : 'none';
  const nearPct = adults > 0 ? Math.round((100 * adultsNear) / adults) : 0;
  return `Year ${String(year).padStart(3)}: people ${w.population}, adults near built ${nearPct}%, ` +
    `heaps ${heaps}, granaries ${granaries}, nests ${nests}, huts ${huts}, fires ${fires}, ` +
    `clusters of 3+ ${camps.length}, largest ${top}`;
}

function main(): void {
  const { named, overrides } = parseArgs(process.argv.slice(2), ['seed', 'years', 'every', 'out', 'scale', 'save']);
  const seed = parseInt(named.seed ?? '3', 10);
  const years = parseInt(named.years ?? '20', 10);
  const every = parseInt(named.every ?? String(years), 10);
  const scale = parseInt(named.scale ?? '4', 10);
  const out = named.out ?? `scratch/map-seed${seed}`;
  const world = new World(overrides as Partial<SimulationConfig>, seed);
  const ticksPerYear = world.config.ticksPerYear || 360;
  for (let y = 1; y <= years; y++) {
    for (let t = 0; t < ticksPerYear; t++) world.step();
    if (y % every === 0 || y === years) {
      const path = `${out}-y${String(y).padStart(2, '0')}.png`;
      render(world, scale, path);
      console.log(`${statsLine(world, y)} -> ${path}`);
    }
    if (world.population === 0) { console.log(`Died out in year ${y}`); break; }
  }
  if (named.save) {
    const saved: SavedWorld = {
      format: 'neolithic-world',
      version: 1,
      savedAt: new Date().toISOString(),
      world: world.exportState(),
      events: [],
    };
    mkdirSync(dirname(named.save), { recursive: true });
    writeFileSync(named.save, JSON.stringify(saved));
    console.log(`Saved world to ${named.save}`);
  }
  console.log(`Final state hash: ${world.stateHash()}`);
}

main();
