/**
 * Headless map images, so an agent can look at what a run built without a browser.
 *
 *   npm run map -- --seed 1 --years 20 --every 5 --out scratch/map [--scale 4] [--save scratch/w/world.json] [--stagesEnabled false]
 *
 * Writes <out>-yNN.png at each snapshot and prints one stats line. Only reads the world.
 *
 * Colours: water blue; land green, brighter with plant food; woodland dark green; rock grey-brown;
 * tilled soil tan; worn paths pale sand, paler with use; heap orange; granary gold; nest brown; hut white; fire red; cave black;
 * set-down stone not yet a hut pale grey; people magenta, brighter when more share a tile.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { World } from '../src/sim/world';
import { FORM_GRANARY, FORM_HEAP, FORM_NEST } from '../src/sim/land';
import type { SimulationConfig } from '../src/sim/types';
import type { SavedWorld } from '../src/sim/protocol';
import { Chronicle } from '../src/sim/chronicle';
import { isBuiltCell, TIER_NAMES } from '../src/sim/settlements';
import { parseArgs } from './args';
import { encodePng } from './png';

const SIZE = 256;
const CELLS = SIZE * SIZE;
/** An adult this close to a built cell counts as in a camp. */
const NEAR_RADIUS = 3;

const isBuilt = (w: World, c: number): boolean => isBuiltCell(w.land, c);

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
    if (l.wear[c] >= 64) { const k = l.wear[c] / 255; r = Math.round(r + (200 - r) * k); g = Math.round(g + (170 - g) * k); b = Math.round(b + (120 - b) * k); }
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

/** Lifetimes in years of settlements that have ended plus those still standing. */
function lifetimes(chronicle: Chronicle, tick: number, ticksPerYear: number): number[] {
  const t = chronicle.settlements;
  const out = t.endedLifetimes.map((l) => l / ticksPerYear);
  for (const r of t.records.values()) out.push((tick - r.foundedTick) / ticksPerYear);
  return out.sort((a, b) => a - b);
}

function statsLine(w: World, chronicle: Chronicle, year: number): string {
  const l = w.land;
  let heaps = 0, granaries = 0, nests = 0, huts = 0, fires = 0, landCells = 0, worn = 0;
  const near = new Uint8Array(CELLS);
  for (let c = 0; c < CELLS; c++) {
    if (l.form[c] === FORM_HEAP) heaps++;
    if (l.form[c] === FORM_GRANARY) granaries++;
    if (l.form[c] === FORM_NEST) nests++;
    if (l.structure[c] === 1) huts++;
    if (l.fire[c] === 1) fires++;
    if (l.isWater[c] === 0) { landCells++; if (l.wear[c] >= 64) worn++; }
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
  const nearPct = adults > 0 ? Math.round((100 * adultsNear) / adults) : 0;
  const tiers = TIER_NAMES.map(() => 0);
  for (const r of chronicle.settlements.records.values()) tiers[r.tier]++;
  const tierText = TIER_NAMES.map((n, i) => `${n}s ${tiers[i]}`).join(', ');
  const views = chronicle.settlementViews();
  const top = views[0] ? `${views[0].name} (${views[0].built} built, ${views[0].residents} people) at ${views[0].x},${views[0].y}` : 'none';
  const lives = lifetimes(chronicle, w.tick, w.config.ticksPerYear || 360);
  let largestBand = 0;
  for (const b of chronicle.tracker.bands.values()) if (b.size > largestBand) largestBand = b.size;
  const median = lives.length > 0 ? lives[Math.floor(lives.length / 2)].toFixed(1) : '0';
  const lasted = lives.filter((l) => l >= 10).length;
  return `Year ${String(year).padStart(3)}: people ${w.population}, adults outside camps ${100 - nearPct}%, ` +
    `heaps ${heaps}, granaries ${granaries}, nests ${nests}, huts ${huts}, fires ${fires}; ` +
    `worn land ${((100 * worn) / Math.max(1, landCells)).toFixed(1)}%, bands ${chronicle.tracker.bands.size} (largest ${largestBand}); ${tierText}; median life ${median}y of ${lives.length}, lasted 10y+ ${lasted}; top ${top}`;
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
  const chronicle = new Chronicle();
  for (let y = 1; y <= years; y++) {
    for (let t = 0; t < ticksPerYear; t++) {
      world.step();
      chronicle.record(world);
    }
    if (y % every === 0 || y === years) {
      const path = `${out}-y${String(y).padStart(2, '0')}.png`;
      render(world, scale, path);
      console.log(`${statsLine(world, chronicle, y)} -> ${path}`);
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
      chronicle: chronicle.exportState(),
    };
    mkdirSync(dirname(named.save), { recursive: true });
    writeFileSync(named.save, JSON.stringify(saved));
    console.log(`Saved world to ${named.save}`);
  }
  console.log(`Final state hash: ${world.stateHash()}`);
}

main();
