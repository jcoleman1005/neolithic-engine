import type { People } from './people';

export const SPATIAL_CELLS = 256 * 256; // 65536
export const SPATIAL_MASK = 255;

export class SpatialIndex {
  public readonly cellStarts: Uint32Array; // Size 65536 + 1
  private readonly cellCounts: Uint32Array; // Scratch: size 65536
  public cellPeople: Uint32Array; // Size people.capacity

  constructor(initialCapacity = 2048) {
    this.cellStarts = new Uint32Array(SPATIAL_CELLS + 1);
    this.cellCounts = new Uint32Array(SPATIAL_CELLS);
    this.cellPeople = new Uint32Array(initialCapacity);
  }

  /**
   * Rebuilds the counting-sort spatial index over all living people.
   * Runs in O(N + 65536) with zero allocations.
   */
  public build(people: People): void {
    if (this.cellPeople.length < people.capacity) {
      this.cellPeople = new Uint32Array(people.capacity);
    }

    this.cellCounts.fill(0);

    const cap = people.capacity;
    const alive = people.alive;
    const px = people.x;
    const py = people.y;

    // Pass 1: Count people per cell
    for (let slot = 0; slot < cap; slot++) {
      if (alive[slot] === 1) {
        const cell = (py[slot] << 8) | px[slot];
        this.cellCounts[cell]++;
      }
    }

    // Pass 2: Prefix sums into cellStarts (cellStarts[cell]..cellStarts[cell+1])
    let running = 0;
    this.cellStarts[0] = 0;
    for (let c = 0; c < SPATIAL_CELLS; c++) {
      running += this.cellCounts[c];
      this.cellStarts[c + 1] = running;
    }

    // Pass 3: Scatter slots into cellPeople using cellCounts as offsets
    this.cellCounts.fill(0);
    for (let slot = 0; slot < cap; slot++) {
      if (alive[slot] === 1) {
        const cell = (py[slot] << 8) | px[slot];
        const offset = this.cellStarts[cell] + this.cellCounts[cell]++;
        this.cellPeople[offset] = slot;
      }
    }
  }

  /**
   * Queries all living people in cells within Chebyshev or Euclidean radius.
   * Returns early if fn returns false.
   */
  public query(
    cx: number,
    cy: number,
    radius: number,
    fn: (slot: number) => boolean | void
  ): void {
    const rSq = radius * radius;
    for (let dy = -radius; dy <= radius; dy++) {
      const y = (cy + dy) & SPATIAL_MASK;
      const row = y << 8;
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > rSq) continue;
        const x = (cx + dx) & SPATIAL_MASK;
        const cell = row | x;
        const start = this.cellStarts[cell];
        const end = this.cellStarts[cell + 1];
        for (let idx = start; idx < end; idx++) {
          if (fn(this.cellPeople[idx]) === false) return;
        }
      }
    }
  }

  /**
   * Gets the slot index range for a single cell (x, y).
   */
  public getCellRange(x: number, y: number): { start: number; end: number } {
    const cell = ((y & SPATIAL_MASK) << 8) | (x & SPATIAL_MASK);
    return {
      start: this.cellStarts[cell],
      end: this.cellStarts[cell + 1],
    };
  }
}
