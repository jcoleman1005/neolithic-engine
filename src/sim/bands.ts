import type { World } from './world';
import { slotFromId } from './people';
import { driftTongue, makeTongue, type Tongue } from '../core/naming';

/**
 * Band tracker for the chronicle. A band is everyone sharing one `rootLeaderId`.
 * Read-only observer (Agent rule 11): draws no random numbers and changes no
 * outcome. Scratch arrays are typed and reused; records are allocated per band,
 * not per person.
 */
export interface BandRecord {
  /** Current root leader's person id; also the band's key. */
  id: number;
  /** The first root leader this band had. */
  founderId: number;
  /** Band this one split from, or 0 when it gathered around a loner. */
  parentId: number;
  foundedTick: number;
  size: number;
  peakSize: number;
  /** Centroid on the wrapping grid. */
  cx: number;
  cy: number;
  /** Total distance the centroid has moved, in cells. */
  travelled: number;
  tongue: Tongue;
}

export type BandChange =
  | { readonly kind: 'founded'; readonly band: number }
  | { readonly kind: 'split'; readonly band: number; readonly parent: number }
  | { readonly kind: 'succession'; readonly band: number; readonly from: number }
  | { readonly kind: 'died'; readonly band: number; readonly lastSize: number };

export class BandTracker {
  public readonly bands = new Map<number, BandRecord>();
  private counts = new Uint32Array(0);
  private sinX = new Float64Array(0);
  private cosX = new Float64Array(0);
  private sinY = new Float64Array(0);
  private cosY = new Float64Array(0);
  private prevRoot = new Uint32Array(0);
  private prevId = new Uint32Array(0);

  private ensure(capacity: number): void {
    if (this.counts.length >= capacity) return;
    const grow32 = (a: Uint32Array) => {
      const n = new Uint32Array(capacity);
      n.set(a);
      return n;
    };
    this.prevRoot = grow32(this.prevRoot);
    this.prevId = grow32(this.prevId);
    this.counts = new Uint32Array(capacity);
    this.sinX = new Float64Array(capacity);
    this.cosX = new Float64Array(capacity);
    this.sinY = new Float64Array(capacity);
    this.cosY = new Float64Array(capacity);
  }

  /** One pass, on the configured interval. Returns what changed since the last pass. */
  public update(world: World): BandChange[] {
    const config = world.config;
    const changes: BandChange[] = [];
    if (!(config.bandTrackEnabled ?? true)) return changes;
    const interval = config.bandTrackInterval ?? 60;
    if (world.tick % interval !== 0) return changes;

    const people = world.people;
    const cap = people.capacity;
    this.ensure(cap);
    const size = world.land.width;
    const toAngle = (2 * Math.PI) / size;
    this.counts.fill(0, 0, cap);
    this.sinX.fill(0, 0, cap);
    this.cosX.fill(0, 0, cap);
    this.sinY.fill(0, 0, cap);
    this.cosY.fill(0, 0, cap);

    for (let s = 0; s < cap; s++) {
      if (people.alive[s] === 0) continue;
      let root = people.rootLeaderId[s];
      if (root === 0) root = people.idOf(s);
      const r = slotFromId(root);
      this.counts[r]++;
      const ax = people.x[s] * toAngle;
      const ay = people.y[s] * toAngle;
      this.sinX[r] += Math.sin(ax);
      this.cosX[r] += Math.cos(ax);
      this.sinY[r] += Math.sin(ay);
      this.cosY[r] += Math.cos(ay);
    }

    const minSize = config.bandTrackMinSize ?? 10;
    const dropBelow = Math.floor(minSize / 2);

    // Candidate roots at or above the tracking size, largest first.
    const candidates: number[] = [];
    for (let r = 0; r < cap; r++) {
      if (this.counts[r] >= minSize && people.alive[r] === 1) candidates.push(r);
    }
    candidates.sort((a, b) => this.counts[b] - this.counts[a] || a - b);

    const seen = new Set<number>();
    for (const r of candidates) {
      const rootId = people.idOf(r);
      seen.add(rootId);
      const n = this.counts[r];
      const cx = this.centroid(this.sinX[r], this.cosX[r], size);
      const cy = this.centroid(this.sinY[r], this.cosY[r], size);
      let rec = this.bands.get(rootId);
      if (!rec) {
        const was = this.prevId[r] === rootId ? this.prevRoot[r] : 0;
        const prior = was !== 0 && was !== rootId ? this.bands.get(was) : undefined;
        if (prior && !people.isValidId(prior.id)) {
          // The old root leader is gone and this one took over: same band.
          this.bands.delete(prior.id);
          rec = { ...prior, id: rootId };
          this.bands.set(rootId, rec);
          changes.push({ kind: 'succession', band: rootId, from: prior.id });
        } else if (prior) {
          rec = {
            id: rootId, founderId: rootId, parentId: prior.id, foundedTick: world.tick,
            size: n, peakSize: n, cx, cy, travelled: 0,
            tongue: driftTongue(prior.tongue, rootId),
          };
          this.bands.set(rootId, rec);
          changes.push({ kind: 'split', band: rootId, parent: prior.id });
        } else {
          rec = {
            id: rootId, founderId: rootId, parentId: 0, foundedTick: world.tick,
            size: n, peakSize: n, cx, cy, travelled: 0,
            tongue: makeTongue(people.motherId[r] || rootId),
          };
          this.bands.set(rootId, rec);
          changes.push({ kind: 'founded', band: rootId });
        }
      }
      rec.travelled += Math.hypot(this.wrapDelta(cx - rec.cx, size), this.wrapDelta(cy - rec.cy, size));
      rec.cx = cx;
      rec.cy = cy;
      rec.size = n;
      if (n > rec.peakSize) rec.peakSize = n;
    }

    for (const [id, rec] of this.bands) {
      if (seen.has(id)) continue;
      const r = slotFromId(id);
      const stillAlive = people.isValidId(id) && r < cap && this.counts[r] >= dropBelow;
      if (stillAlive) {
        rec.size = this.counts[r];
        continue;
      }
      this.bands.delete(id);
      changes.push({ kind: 'died', band: id, lastSize: rec.size });
    }

    for (let s = 0; s < cap; s++) {
      if (people.alive[s] === 0) {
        this.prevRoot[s] = 0;
        this.prevId[s] = 0;
      } else {
        this.prevRoot[s] = people.rootLeaderId[s];
        this.prevId[s] = people.idOf(s);
      }
    }
    return changes;
  }

  private centroid(sin: number, cos: number, size: number): number {
    let a = Math.atan2(sin, cos);
    if (a < 0) a += 2 * Math.PI;
    return (a * size) / (2 * Math.PI);
  }

  private wrapDelta(d: number, size: number): number {
    if (d > size / 2) return d - size;
    if (d < -size / 2) return d + size;
    return d;
  }

  public exportState(): BandRecord[] {
    return Array.from(this.bands.values(), (b) => ({ ...b, tongue: b.tongue.slice() }));
  }

  public importState(records: readonly BandRecord[]): void {
    this.bands.clear();
    for (const b of records) this.bands.set(b.id, { ...b, tongue: b.tongue.slice() });
  }
}
