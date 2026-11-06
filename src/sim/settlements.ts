import type { World } from './world';
import type { Land } from './land';
import { FORM_GRANARY, FORM_NEST } from './land';
import type { BandTracker } from './bands';
import { makeTongue, hash32, type Tongue } from '../core/naming';

/**
 * Settlement tracker: finds clusters of built cells and gives them names and tiers. Read-only
 * observer (Agent rule 11): it draws no random numbers and changes no outcome, and the simulation
 * never reads anything here. A tier is only a label for what is already on the land.
 */

const SIZE = 256;
const CELLS = SIZE * SIZE;
const MASK = SIZE - 1;

export const TIER_NAMES = ['camp', 'hamlet', 'village', 'town', 'city'] as const;

/** What counts as built. Caves and other natural features do not. */
export function isBuiltCell(land: Land, c: number): boolean {
  const f = land.form[c];
  return f === FORM_NEST || f === FORM_GRANARY || land.structure[c] === 1 || land.fire[c] === 1;
}

export interface SettlementRecord {
  id: number;
  name: string;
  foundedTick: number;
  x: number;
  y: number;
  radius: number;
  built: number;
  /** Smoothed over recent scans, so a passing band does not count. */
  residents: number;
  stores: number;
  /** Stored water near the settlement (S3w). */
  water: number;
  tier: number;
  peakTier: number;
  /** Last scan that met the camp minimum. */
  lastQualified: number;
  cells: number[];
  /** [tick, tier] each time a new highest tier was reached. */
  history: Array<[number, number]>;
}

/** What the viewer needs about a settlement. */
export interface SettlementView {
  readonly id: number;
  readonly name: string;
  readonly foundedTick: number;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly built: number;
  readonly residents: number;
  readonly stores: number;
  readonly water: number;
  readonly tier: number;
  readonly peakTier: number;
  readonly history: ReadonlyArray<readonly [number, number]>;
}

export interface SettlementState {
  readonly nextId: number;
  readonly records: readonly SettlementRecord[];
}

export type SettlementChange =
  | { readonly kind: 'rose'; readonly record: SettlementRecord }
  | { readonly kind: 'abandoned'; readonly record: SettlementRecord }
  | { readonly kind: 'absorbed'; readonly record: SettlementRecord; readonly into: SettlementRecord };

/** Names a new settlement at a cell; salt moves to another name when one is taken. */
export type Namer = (world: World, x: number, y: number, tongue: Tongue, salt: number) => string;

interface Cluster {
  readonly start: number;
  readonly end: number;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  residents: number;
  stores: number;
  water: number;
}

export class SettlementTracker {
  public readonly records = new Map<number, SettlementRecord>();
  /** How long abandoned settlements lasted, in ticks, for the tools. Not saved. */
  public readonly endedLifetimes: number[] = [];
  private nextId = 1;
  private readonly seen = new Uint8Array(CELLS);
  private readonly order = new Int32Array(CELLS);
  private readonly near = new Int32Array(CELLS);
  private readonly owner = new Int32Array(CELLS);

  /** One pass, on the configured interval. Returns what changed. */
  public update(world: World, bands: BandTracker, namer: Namer): SettlementChange[] {
    const config = world.config;
    const changes: SettlementChange[] = [];
    if (!(config.settlementTrackEnabled ?? true)) return changes;
    if (world.tick % (config.settlementScanInterval ?? 30) !== 0) return changes;

    const clusters = this.findClusters(world);
    this.countAround(world, clusters);
    this.markOwners(config.settlementGap ?? 2);

    const tick = world.tick;
    const campBuilt = config.settlementCampBuilt ?? 3;
    const campResidents = config.settlementCampResidents ?? 5;
    const alpha = config.settlementResidentSmoothing ?? 0.2;
    const taken = new Set<number>();

    // Largest first, so when a settlement splits its biggest part keeps the name.
    const bySize = clusters.map((c, i) => ({ c, i }));
    bySize.sort((a, b) => b.c.end - b.c.start - (a.c.end - a.c.start) || a.i - b.i);

    for (const { c, i } of bySize) {
      const built = c.end - c.start;
      const overlap = new Map<number, number>();
      for (let k = c.start; k < c.end; k++) {
        const id = this.owner[this.order[k]];
        if (id !== 0) overlap.set(id, (overlap.get(id) ?? 0) + 1);
      }
      let best = 0;
      let bestCount = 0;
      for (const [id, count] of overlap) {
        if (taken.has(id)) continue;
        if (count > bestCount || (count === bestCount && id < best)) {
          best = id;
          bestCount = count;
        }
      }

      let rec = best !== 0 ? this.records.get(best) : undefined;
      if (rec) {
        taken.add(rec.id);
        rec.residents += (c.residents - rec.residents) * alpha;
      } else {
        if (built < campBuilt || c.residents < campResidents) continue;
        rec = {
          id: this.nextId++,
          name: this.uniqueName(world, c.x, c.y, this.tongueOf(world, bands, i + 1, c), namer),
          foundedTick: tick,
          x: c.x, y: c.y, radius: c.radius, built, residents: c.residents, stores: c.stores, water: c.water,
          tier: 0, peakTier: 0, lastQualified: tick, cells: [],
          history: [[tick, 0]],
        };
        this.records.set(rec.id, rec);
        taken.add(rec.id);
      }
      rec.x = c.x;
      rec.y = c.y;
      rec.radius = c.radius;
      rec.built = built;
      rec.stores = c.stores;
      rec.water = c.water;
      rec.cells = Array.from(this.order.subarray(c.start, c.end));
      if (built >= campBuilt && rec.residents >= campResidents) rec.lastQualified = tick;
      rec.tier = this.tierOf(world, rec);
      if (rec.tier > rec.peakTier) {
        rec.peakTier = rec.tier;
        rec.history.push([tick, rec.tier]);
        changes.push({ kind: 'rose', record: rec });
      }
      // Other settlements this cluster has swallowed end here rather than fading out as abandoned.
      for (const [id, count] of overlap) {
        const other = id === rec.id || taken.has(id) ? undefined : this.records.get(id);
        if (other && count * 2 >= other.cells.length) {
          this.records.delete(id);
          changes.push({ kind: 'absorbed', record: other, into: rec });
        }
      }
    }

    // A settlement gets a grace period, because fires burn out and people come and go.
    const grace = config.settlementGraceTicks ?? 360;
    for (const [id, rec] of this.records) {
      if (taken.has(id)) {
        if (tick - rec.lastQualified <= grace) continue;
      } else if (tick - rec.lastQualified <= grace) {
        rec.residents += (0 - rec.residents) * alpha;
        continue;
      }
      this.records.delete(id);
      this.endedLifetimes.push(rec.lastQualified - rec.foundedTick);
      changes.push({ kind: 'abandoned', record: rec });
    }
    return changes;
  }

  /** Groups built cells within the gap, across the wrap. Cells end up in `order`, cluster by cluster. */
  private findClusters(world: World): Cluster[] {
    const land = world.land;
    const gap = world.config.settlementGap ?? 2;
    const { seen, order } = this;
    seen.fill(0);
    const clusters: Cluster[] = [];
    let tail = 0;
    for (let startCell = 0; startCell < CELLS; startCell++) {
      if (seen[startCell] === 1 || !isBuiltCell(land, startCell)) continue;
      const start = tail;
      let head = tail;
      order[tail++] = startCell;
      seen[startCell] = 1;
      const x0 = startCell & MASK;
      const y0 = startCell >> 8;
      let sumX = 0;
      let sumY = 0;
      while (head < tail) {
        const c = order[head++];
        const x = c & MASK;
        const y = c >> 8;
        sumX += wrapOffset(x - x0);
        sumY += wrapOffset(y - y0);
        for (let dy = -gap; dy <= gap; dy++) {
          for (let dx = -gap; dx <= gap; dx++) {
            const n = (((y + dy) & MASK) << 8) | ((x + dx) & MASK);
            if (seen[n] === 0 && isBuiltCell(land, n)) {
              seen[n] = 1;
              order[tail++] = n;
            }
          }
        }
      }
      const n = tail - start;
      const ox = sumX / n;
      const oy = sumY / n;
      let radius = 0;
      for (let k = start; k < tail; k++) {
        const c = order[k];
        const dx = wrapOffset((c & MASK) - x0) - ox;
        const dy = wrapOffset((c >> 8) - y0) - oy;
        const d = dx * dx + dy * dy;
        if (d > radius) radius = d;
      }
      clusters.push({
        start,
        end: tail,
        x: (x0 + Math.round(ox) + SIZE) & MASK,
        y: (y0 + Math.round(oy) + SIZE) & MASK,
        radius: Math.sqrt(radius),
        residents: 0,
        stores: 0,
        water: 0,
      });
    }
    return clusters;
  }

  /** Counts people and stored food within reach of each cluster. */
  private countAround(world: World, clusters: Cluster[]): void {
    const r = world.config.settlementResidentRadius ?? 3;
    const { near, order } = this;
    near.fill(0);
    for (let i = 0; i < clusters.length; i++) {
      for (let k = clusters[i].start; k < clusters[i].end; k++) {
        const c = order[k];
        const x = c & MASK;
        const y = c >> 8;
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            const n = (((y + dy) & MASK) << 8) | ((x + dx) & MASK);
            if (near[n] === 0) {
              near[n] = i + 1;
              clusters[i].stores += world.land.pile[n];
              clusters[i].water += world.land.waterStore[n];
            }
          }
        }
      }
    }
    const p = world.people;
    for (let s = 0; s < p.capacity; s++) {
      if (p.alive[s] === 0) continue;
      const i = near[(p.y[s] << 8) | p.x[s]];
      if (i !== 0) clusters[i - 1].residents++;
    }
  }

  /** Marks the cells each known settlement held last scan, widened by the gap so small moves still match. */
  private markOwners(gap: number): void {
    const { owner } = this;
    owner.fill(0);
    for (const rec of this.records.values()) {
      for (const c of rec.cells) {
        const x = c & MASK;
        const y = c >> 8;
        for (let dy = -gap; dy <= gap; dy++) {
          for (let dx = -gap; dx <= gap; dx++) {
            const n = (((y + dy) & MASK) << 8) | ((x + dx) & MASK);
            if (owner[n] === 0) owner[n] = rec.id;
          }
        }
      }
    }
  }

  private tierOf(world: World, rec: SettlementRecord): number {
    const c = world.config;
    const years = (world.tick - rec.foundedTick) / (c.ticksPerYear || 360);
    const meets = (built: number, residents: number, lasted: number): boolean =>
      rec.built >= built && rec.residents >= residents && years >= lasted;
    if (meets(c.settlementCityBuilt ?? 300, c.settlementCityResidents ?? 1000, c.settlementCityYears ?? 30)) return 4;
    if (meets(c.settlementTownBuilt ?? 120, c.settlementTownResidents ?? 400, c.settlementTownYears ?? 20)) return 3;
    if (meets(c.settlementVillageBuilt ?? 30, c.settlementVillageResidents ?? 80, c.settlementVillageYears ?? 10)) return 2;
    if (meets(c.settlementHamletBuilt ?? 10, c.settlementHamletResidents ?? 20, c.settlementHamletYears ?? 5)) return 1;
    return 0;
  }

  /** The tongue of the band most present around a new settlement, or one from the place itself. */
  private tongueOf(world: World, bands: BandTracker, label: number, c: Cluster): Tongue {
    const p = world.people;
    const counts = new Map<number, number>();
    for (let s = 0; s < p.capacity; s++) {
      if (p.alive[s] === 0 || this.near[(p.y[s] << 8) | p.x[s]] !== label) continue;
      const root = p.rootLeaderId[s] !== 0 ? p.rootLeaderId[s] : p.idOf(s);
      counts.set(root, (counts.get(root) ?? 0) + 1);
    }
    let best: Tongue | null = null;
    let bestCount = 0;
    let bestId = 0;
    for (const [id, n] of counts) {
      const band = bands.bands.get(id);
      if (band && (n > bestCount || (n === bestCount && id < bestId))) {
        best = band.tongue;
        bestCount = n;
        bestId = id;
      }
    }
    return best ?? makeTongue(hash32(c.x, c.y, 0x5e771));
  }

  private uniqueName(world: World, x: number, y: number, tongue: Tongue, namer: Namer): string {
    const used = new Set<string>();
    for (const rec of this.records.values()) used.add(rec.name);
    let name = namer(world, x, y, tongue, 0);
    for (let salt = 1; used.has(name) && salt < 32; salt++) name = namer(world, x, y, tongue, salt);
    return name;
  }

  public views(): SettlementView[] {
    const out: SettlementView[] = [];
    for (const r of this.records.values()) {
      out.push({
        id: r.id, name: r.name, foundedTick: r.foundedTick, x: r.x, y: r.y,
        radius: Math.round(r.radius * 10) / 10, built: r.built, residents: Math.round(r.residents),
        stores: Math.round(r.stores), water: Math.round(r.water ?? 0), tier: r.tier, peakTier: r.peakTier, history: r.history,
      });
    }
    return out.sort((a, b) => b.tier - a.tier || b.residents - a.residents || a.id - b.id);
  }

  public exportState(): SettlementState {
    return { nextId: this.nextId, records: Array.from(this.records.values()) };
  }

  public importState(state: SettlementState): void {
    this.records.clear();
    this.nextId = state.nextId;
    for (const r of state.records) {
      this.records.set(r.id, { ...r, cells: [...r.cells], history: r.history.map(([t, n]) => [t, n]) });
    }
  }
}

/** The shortest signed difference on the wrapping map. */
function wrapOffset(d: number): number {
  return ((d + SIZE + SIZE / 2) % SIZE) - SIZE / 2;
}
