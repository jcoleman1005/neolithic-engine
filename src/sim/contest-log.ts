import { CONTEST_FIGHT } from './protocol';

export const CONTEST_LOG_SIZE = 128;
export const CONTEST_FIGHTS_PER_TICK = 4;
export const CONTEST_GIVES_PER_TICK = 3;

/**
 * Observer ring of recent contests for the viewer (rule 11): written by Rules.touch, read only by the
 * host; no random draws, not saved, not part of the state hash. One per Land, so worlds never share it.
 *
 * Two ints per entry: x | y << 8 | kind << 16 (CONTEST_FIGHT, CONTEST_YIELD, CONTEST_CONCEDE), then the
 * tick. `count` only grows, so a reader keeps its own watermark. A busy tick can hold hundreds of
 * contests, so each tick keeps an even sample (a reservoir picked by a hash of the count and tick): up
 * to CONTEST_FIGHTS_PER_TICK fights and CONTEST_GIVES_PER_TICK give-ways, staged until the tick changes
 * or a reader flushes.
 */
export class ContestLog {
  public readonly entries = new Int32Array(CONTEST_LOG_SIZE * 2);
  public count = 0;
  private readonly stageFights = new Int32Array(CONTEST_FIGHTS_PER_TICK);
  private readonly stageGives = new Int32Array(CONTEST_GIVES_PER_TICK);
  private seenFights = 0;
  private seenGives = 0;
  private stageTick = -1;

  public record(x: number, y: number, kind: number, tick: number): void {
    if (this.stageTick !== tick) {
      this.flush();
      this.stageTick = tick;
    }
    const v = (x & 0xff) | ((y & 0xff) << 8) | (kind << 16);
    if (kind === CONTEST_FIGHT) this.seenFights = this.sampleInto(this.stageFights, this.seenFights, v, tick);
    else this.seenGives = this.sampleInto(this.stageGives, this.seenGives, v, tick);
  }

  private sampleInto(stage: Int32Array, seen: number, v: number, tick: number): number {
    if (seen < stage.length) stage[seen] = v;
    else {
      const j = ((Math.imul(seen + 1, 2654435761) ^ Math.imul(tick + 1, 2246822519)) >>> 0) % (seen + 1);
      if (j < stage.length) stage[j] = v;
    }
    return seen + 1;
  }

  /** Moves the staged sample into the ring (a reader calls this before reading). */
  public flush(): void {
    const nf = Math.min(this.seenFights, CONTEST_FIGHTS_PER_TICK);
    const ng = Math.min(this.seenGives, CONTEST_GIVES_PER_TICK);
    for (let i = 0; i < nf + ng; i++) {
      const o = (this.count % CONTEST_LOG_SIZE) * 2;
      this.entries[o] = i < nf ? this.stageFights[i] : this.stageGives[i - nf];
      this.entries[o + 1] = this.stageTick;
      this.count++;
    }
    this.seenFights = 0;
    this.seenGives = 0;
  }

  /** Entries recorded after `from` (a count), oldest first, as x, y, kind, tick; at most the ring's size. */
  public since(from: number): number[] {
    this.flush();
    const out: number[] = [];
    for (let n = Math.max(from, this.count - CONTEST_LOG_SIZE); n < this.count; n++) {
      const o = (n % CONTEST_LOG_SIZE) * 2;
      const v = this.entries[o];
      out.push(v & 0xff, (v >> 8) & 0xff, v >> 16, this.entries[o + 1]);
    }
    return out;
  }

  /** Forgets everything, staged or not (a world reset or load). */
  public clear(): void {
    this.count = 0;
    this.seenFights = 0;
    this.seenGives = 0;
    this.stageTick = -1;
  }
}
