/**
 * A saved world that is a few ticks short of its first band split, for scripts/visual-check.ts.
 *
 * The check needs the same split at the same place every run. Waiting for one in a live browser
 * would take about 30 simulated years and a different number of ticks each time, so the sim runs
 * here instead: headless, from a fixed seed, to the first `split` chronicle entry. A yearly
 * checkpoint is kept on the way; the last one is loaded, run on to the first split of that loaded
 * world, and saved LEAD_TICKS before it. The save is then loaded cold and stepped to prove it
 * produces the same split.
 *
 * The result is cached under visual/.cache, keyed by the seed and a hash of src/sim, so any change
 * to the simulation builds a new one.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { World } from '../src/sim/world';
import { Chronicle } from '../src/sim/chronicle';
import type { SavedWorld } from '../src/sim/protocol';

/** How many ticks before the split the saved world is taken. */
export const LEAD_TICKS = 3;
const MAX_TICKS = 360 * 60;
const CHECKPOINT_EVERY = 360;
const SNAPSHOT_VERSION = 2; // 2: the split must arrive alone

export interface SplitMeta {
  readonly seed: number;
  /** Tick of the world as saved. */
  readonly savedTick: number;
  /** Tick at which the split entry appears. */
  readonly splitTick: number;
  readonly x: number;
  readonly y: number;
  readonly band: number;
  readonly priority: number;
  readonly population: number;
}

export interface SplitSnapshot {
  readonly meta: SplitMeta;
  readonly saved: SavedWorld;
}

interface SplitFound {
  readonly x: number;
  readonly y: number;
  readonly band: number;
  readonly priority: number;
}

/** Other camera-worthy entries (priority above 0, not a split) in one tick's chronicle record. */
function othersIn(bodies: ReturnType<Chronicle['record']>): number {
  let n = 0;
  for (const b of bodies) if (b.kind === 'chronicle' && b.type !== 'split' && b.priority > 0) n++;
  return n;
}

function findSplit(bodies: ReturnType<Chronicle['record']>): SplitFound | null {
  for (const b of bodies) {
    if (b.kind === 'chronicle' && b.type === 'split') return { x: b.x, y: b.y, band: b.band, priority: b.priority };
  }
  return null;
}

function hashDir(dir: string, h: ReturnType<typeof createHash>): void {
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) hashDir(p, h);
    else {
      h.update(p);
      h.update(readFileSync(p));
    }
  }
}

/** Identifies the simulation code, so a cached world is rebuilt when the sim changes. */
export function simHash(root = resolve('.')): string {
  const h = createHash('sha1');
  h.update(`v${SNAPSHOT_VERSION}`);
  hashDir(join(root, 'src', 'sim'), h);
  return h.digest('hex').slice(0, 10);
}

function load(worldState: unknown, chronicleState: unknown): { world: World; chronicle: Chronicle } {
  // Through JSON, as the app's Load does.
  const world = World.fromState(JSON.parse(JSON.stringify(worldState)));
  const chronicle = new Chronicle();
  chronicle.importState(JSON.parse(JSON.stringify(chronicleState)));
  return { world, chronicle };
}

/**
 * Why the split is taken from a loaded world and not from the first run: loading a save does not
 * continue the run bit for bit. At seed 4, tick 10080, the state hash differs one tick after
 * World.fromState, and the first split comes 60 ticks earlier. A second load of a world that was
 * itself loaded is exact, so the timeline to use is the one that starts from a load. The app's
 * Load button and this builder take the same path (fromState, importState, step).
 */
function build(seed: number): SplitSnapshot {
  // 1. Run the seed to its first split, keeping a checkpoint each year, to find where splits start.
  const world = new World({}, seed);
  const chronicle = new Chronicle();
  let checkpoint: { world: unknown; chronicle: unknown } | null = null;
  let firstRunSplit = false;
  while (world.tick < MAX_TICKS && !firstRunSplit) {
    if (world.tick % CHECKPOINT_EVERY === 0) {
      checkpoint = { world: JSON.parse(JSON.stringify(world.exportState())), chronicle: JSON.parse(JSON.stringify(chronicle.exportState())) };
    }
    world.step();
    firstRunSplit = findSplit(chronicle.record(world)) !== null;
  }
  if (!firstRunSplit || !checkpoint) throw new Error(`Seed ${seed} has no band split within ${MAX_TICKS} ticks; pick another seed`);

  // 2. Load the checkpoint and run on to the first split of that loaded timeline that arrives alone:
  // no other camera-worthy entry on its tick or in the LEAD_TICKS before it, so the camera's cut can
  // only be to the split. (With the settlement observer, a camp can be founded on the same tick.)
  const probe = load(checkpoint.world, checkpoint.chronicle);
  const checkpointTick = probe.world.tick;
  const splitTicks = new Set<number>();
  let lastOther = -Infinity;
  let found: SplitFound | null = null;
  const window = 6 * CHECKPOINT_EVERY;
  while (!found && probe.world.tick < checkpointTick + window) {
    probe.world.step();
    const bodies = probe.chronicle.record(probe.world);
    const split = findSplit(bodies);
    const others = othersIn(bodies);
    if (split) {
      splitTicks.add(probe.world.tick);
      if (others === 0 && probe.world.tick - lastOther > LEAD_TICKS) found = split;
    }
    if (others > 0 || (split && !found)) lastOther = probe.world.tick;
  }
  if (!found) throw new Error(`No split arriving alone within ${window} ticks of the tick ${checkpointTick} checkpoint`);
  const splitTick = probe.world.tick;

  // 3. Load it again and stop LEAD_TICKS short of the split: this is the save.
  const replay = load(checkpoint.world, checkpoint.chronicle);
  while (replay.world.tick < splitTick - LEAD_TICKS) {
    replay.world.step();
    if (findSplit(replay.chronicle.record(replay.world)) && !splitTicks.has(replay.world.tick)) {
      throw new Error('The same checkpoint split at a different tick on a second load: loading is not deterministic');
    }
  }
  const saved: SavedWorld = {
    format: 'neolithic-world',
    version: 1,
    savedAt: '2000-01-01T00:00:00.000Z', // fixed, so the cached file is the same every time
    world: replay.world.exportState(),
    events: [],
    chronicle: replay.chronicle.exportState(),
  };

  // 4. Prove the save is enough: load it cold, as the app will, and step to the split.
  const check = load(saved.world, saved.chronicle);
  let again: SplitFound | null = null;
  for (let i = 0; i < LEAD_TICKS && !again; i++) {
    check.world.step();
    again = findSplit(check.chronicle.record(check.world));
  }
  if (!again || check.world.tick !== splitTick || again.x !== found.x || again.y !== found.y) {
    throw new Error(`The saved world did not reproduce the split at tick ${splitTick} (got ${again ? `tick ${check.world.tick}` : 'none'})`);
  }

  return {
    meta: { seed, savedTick: replay.world.tick, splitTick, x: found.x, y: found.y, band: found.band, priority: found.priority, population: replay.world.population },
    saved,
  };
}

/** Loads the cached snapshot for this seed and sim, or builds and caches it. */
export function splitSnapshot(seed: number, cacheDir: string, log: (msg: string) => void = () => {}): SplitSnapshot {
  const file = join(cacheDir, `split-seed${seed}-${simHash()}.json`);
  if (existsSync(file)) {
    log(`using cached world ${file}`);
    return JSON.parse(readFileSync(file, 'utf8')) as SplitSnapshot;
  }
  log(`building a world for seed ${seed} that is ${LEAD_TICKS} ticks before its first band split (about a minute, cached afterwards)`);
  const t0 = Date.now();
  const snap = build(seed);
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(file, JSON.stringify(snap));
  log(`built in ${((Date.now() - t0) / 1000).toFixed(0)}s: split at tick ${snap.meta.splitTick}, ${snap.meta.x.toFixed(1)},${snap.meta.y.toFixed(1)}; saved ${file}`);
  return snap;
}
