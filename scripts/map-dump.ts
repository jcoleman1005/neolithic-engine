/**
 * Headless map images, so an agent can look at what a run built without a browser.
 *
 *   npm run map -- --seed 1 --years 20 --every 5 --out scratch/map [--scale 4] [--save scratch/w/world.json] [--stagesEnabled false]
 *
 * Writes <out>-yNN.png at each snapshot and prints one stats line. Only reads the world.
 *
 * Colours: water blue; land green, brighter with plant food; woodland dark green; rock grey-brown;
 * stored water bright blue; tilled soil tan; worn paths pale sand, paler with use; heap orange; granary gold; nest brown; hut white; fire red; cave black;
 * set-down stone not yet a hut pale grey; people magenta, brighter when more share a tile.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { World } from '../src/sim/world';
import { FORM_GRANARY, FORM_HEAP, FORM_NEST } from '../src/sim/land';
import type { SimulationConfig } from '../src/sim/types';
import type { SavedWorld } from '../src/sim/protocol';
import { Chronicle } from '../src/sim/chronicle';
import { builtWallMin, isBuiltCell, TIER_NAMES } from '../src/sim/settlements';
import { parseArgs } from './args';
import { encodePng } from './png';

const SIZE = 256;
const CELLS = SIZE * SIZE;
/** An adult this close to a built cell counts as in a camp. */
const NEAR_RADIUS = 3;

const isBuilt = (w: World, c: number): boolean => isBuiltCell(w.land, c, builtWallMin(w.config));

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
    if (l.durability[c] > 0) {
      // Built-up tiles: packed earth brown, stone grey, darker and denser the more durable.
      const k = Math.min(1, l.durability[c] / 120);
      if (l.material[c] === 1) { r = 150 - k * 60; g = 105 - k * 45; b = 60 - k * 25; }
      else { r = 175 - k * 75; g = 175 - k * 75; b = 170 - k * 70; }
    }
    if (l.form[c] === FORM_HEAP || l.pile[c] > 1) { r = 230; g = 130; b = 30; }
    if (l.waterStore[c] > 0) { r = 60; g = 120; b = 230; }
    if (l.form[c] === FORM_GRANARY) { r = 245; g = 205; b = 60; }
    if (l.form[c] === FORM_NEST) { r = 120; g = 72; b = 34; }
    if (l.structure[c] === 1 && l.material[c] !== 1) { r = 250; g = 250; b = 250; }
    if (l.structure[c] === 1 && l.material[c] === 1) { r = 230; g = 200; b = 150; }
    if (l.cave[c] === 1) { r = 0; g = 0; b = 0; }
    if (l.fire[c] === 1) { r = 255; g = 40; b = 20; }
  }
  out[o] = r; out[o + 1] = g; out[o + 2] = b;
}

function render(w: World, scale: number, path: string, crop: { x: number; y: number; r: number } | null = null): void {
  const counts = new Uint16Array(CELLS);
  const p = w.people;
  for (let s = 0; s < p.capacity; s++) {
    if (p.alive[s] === 1) counts[(p.y[s] << 8) | p.x[s]]++;
  }
  const span = crop ? crop.r * 2 + 1 : SIZE;
  const px = span * scale;
  const rgb = new Uint8Array(px * px * 3);
  const cell = new Uint8Array(3);
  for (let y = 0; y < span; y++) {
    for (let x = 0; x < span; x++) {
      const c = crop ? (((crop.y - crop.r + y) & 255) << 8) | ((crop.x - crop.r + x) & 255) : (y << 8) | x;
      cellColor(w, c, cell, 0);
      // In crops, everything that is not built is dimmed, so walls and their shapes stand out.
      if (crop && w.land.durability[c] === 0 && w.land.form[c] !== FORM_NEST && w.land.fire[c] === 0) {
        cell[0] *= 0.45; cell[1] *= 0.45; cell[2] *= 0.45;
      }
      // With exposure on, sheltered ground is drawn darker (only in crops, to keep the full map readable).
      if (crop && w.config.exposureEnabled === true && w.land.isWater[c] === 0) {
        const k = 0.45 + 0.55 * (w.land.exposure[c] / 255);
        cell[0] *= k; cell[1] *= k; cell[2] *= k;
      }
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const o = ((y * scale + dy) * px + x * scale + dx) * 3;
          rgb[o] = cell[0]; rgb[o + 1] = cell[1]; rgb[o + 2] = cell[2];
        }
      }
      // People take the middle of the cell, so what they stand on still shows round the edge.
      if (counts[c] > 0) {
        const v = Math.min(255, 110 + counts[c] * 25);
        // In crops people are small dots, so the ground and walls under them stay readable.
        const m = crop ? Math.floor(scale / 2) - 1 : scale >= 3 ? 1 : 0;
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

/**
 * Layout of built tiles (durability > 0): how many stand alone, how many sit in lines (two or more
 * built neighbours of 8), and how many open tiles are walled in on at least 3 of their 4 sides.
 */
function layoutLine(w: World): string {
  const d = w.land.durability;
  let built = 0, alone = 0, lines = 0, enclosed = 0;
  for (let c = 0; c < CELLS; c++) {
    const x = c & 255, y = c >> 8;
    const at = (dx: number, dy: number): number => (d[(((y + dy) & 255) << 8) | ((x + dx) & 255)] > 0 ? 1 : 0);
    if (d[c] > 0) {
      built++;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx !== 0 || dy !== 0) n += at(dx, dy);
      if (n === 0) alone++;
      else if (n >= 2) lines++;
    } else if (w.land.isWater[c] === 0 && at(1, 0) + at(-1, 0) + at(0, 1) + at(0, -1) >= 3) {
      enclosed++;
    }
  }
  const pct = (a: number): string => (built > 0 ? Math.round((100 * a) / built) : 0) + '%';
  return `  layout: built ${built}, alone ${pct(alone)}, in lines ${pct(lines)}, open tiles walled on 3+ sides ${enclosed}`;
}

function statsLine(w: World, chronicle: Chronicle, year: number): string {
  const l = w.land;
  let heaps = 0, granaries = 0, nests = 0, huts = 0, fires = 0, landCells = 0, worn = 0, earthBuilt = 0, stoneBuilt = 0;
  const near = new Uint8Array(CELLS);
  for (let c = 0; c < CELLS; c++) {
    if (l.form[c] === FORM_HEAP) heaps++;
    if (l.form[c] === FORM_GRANARY) granaries++;
    if (l.form[c] === FORM_NEST) nests++;
    if (l.structure[c] === 1) huts++;
    if (l.fire[c] === 1) fires++;
    if (l.isWater[c] === 0) { landCells++; if (l.wear[c] >= 64) worn++; }
    if (l.durability[c] > 0) { if (l.material[c] === 1) earthBuilt++; else stoneBuilt++; }
    if (isBuilt(w, c)) {
      const x = c & 255, y = c >> 8;
      for (let dy = -NEAR_RADIUS; dy <= NEAR_RADIUS; dy++) {
        for (let dx = -NEAR_RADIUS; dx <= NEAR_RADIUS; dx++) near[(((y + dy) & 255) << 8) | ((x + dx) & 255)] = 1;
      }
    }
  }
  const p = w.people;
  const adultAge = w.config.adultAge ?? 5760;
  let adults = 0, adultsNear = 0, far = 0, alive = 0, hungry = 0;
  for (let s = 0; s < p.capacity; s++) {
    if (p.alive[s] === 1) { alive++; if (w.land.waterDist[(p.y[s] << 8) | p.x[s]] >= 13) far++; if (p.energy[s] < 35) hungry++; }
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
    `heaps ${heaps}, granaries ${granaries}, nests ${nests}, huts ${huts}, fires ${fires}, built earth ${earthBuilt} stone ${stoneBuilt}; ` +
    `hungry ${((100 * hungry) / Math.max(1, alive)).toFixed(1)}%, 13+ from water ${((100 * far) / Math.max(1, alive)).toFixed(1)}%, worn land ${((100 * worn) / Math.max(1, landCells)).toFixed(1)}%, bands ${chronicle.tracker.bands.size} (largest ${largestBand}); ${tierText}; median life ${median}y of ${lives.length}, lasted 10y+ ${lasted}; top ${top}`;
}

function main(): void {
  const { named, overrides } = parseArgs(process.argv.slice(2), ['seed', 'years', 'every', 'out', 'scale', 'save', 'crop', 'samples', 'from']);
  const seed = parseInt(named.seed ?? '3', 10);
  const years = parseInt(named.years ?? '20', 10);
  const every = parseInt(named.every ?? String(years), 10);
  const scale = parseInt(named.scale ?? '4', 10);
  const out = named.out ?? `scratch/map-seed${seed}`;
  const world = new World(overrides as Partial<SimulationConfig>, seed);
  const ticksPerYear = world.config.ticksPerYear || 360;
  const chronicle = new Chronicle();
  // --samples <file>: how far from natural fresh water people standing still are, every 90 ticks
  // from year --from (default 10), for npm run compare.
  const samples: number[] = [];
  const fromTick = parseInt(named.from ?? '10', 10) * ticksPerYear;
  for (let y = 1; y <= years; y++) {
    for (let t = 0; t < ticksPerYear; t++) {
      world.step();
      chronicle.record(world);
      if (named.samples && world.tick >= fromTick && world.tick % 90 === 0) {
        const p = world.people;
        for (let s = 0; s < p.capacity; s++) {
          if (p.alive[s] === 1 && p.prevDir[s] === 4) samples.push(world.land.waterDist[(p.y[s] << 8) | p.x[s]]);
        }
      }
    }
    if (y % every === 0 || y === years) {
      const path = `${out}-y${String(y).padStart(2, '0')}.png`;
      render(world, scale, path);
      if (named.crop) {
        // --crop top (around the largest settlement) or --crop x,y; 20 tiles each way at 12 pixels a tile.
        const top = chronicle.settlementViews()[0];
        const [cx, cy] = named.crop === 'top' ? (top ? [top.x, top.y] : [128, 128]) : named.crop.split(',').map(Number);
        const cropPath = `${out}-y${String(y).padStart(2, '0')}-crop.png`;
        render(world, 12, cropPath, { x: cx, y: cy, r: 20 });
        console.log(`  crop at ${cx},${cy} -> ${cropPath}`);
      }
      console.log(`${statsLine(world, chronicle, y)} -> ${path}`);
      console.log(layoutLine(world));
    }
    if (world.population === 0) { console.log(`Died out in year ${y}`); break; }
  }
  if (named.samples) {
    mkdirSync(dirname(named.samples), { recursive: true });
    writeFileSync(named.samples, JSON.stringify({ seed, overrides, samples }));
    console.log(`Wrote ${samples.length} samples to ${named.samples}`);
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
