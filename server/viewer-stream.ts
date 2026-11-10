import type { FromWorker } from '../src/sim/protocol';

type Frame = Extract<FromWorker, { kind: 'frame' }>;

/**
 * One viewer's outgoing messages, with frames limited to one per interval.
 *
 * The world can tick 60 times a second; a phone over Wi-Fi or Tailscale only
 * needs ~10 pictures a second. Frames in between are merged into the next one
 * sent: the newest positions win, world events add up, and the newest panels
 * are kept, so nothing the page shows is lost. Frames from a single Step go
 * out at once. Other messages go out at once, in order (a pending frame is
 * sent first, or dropped when the terrain is replaced).
 *
 * `canSend` lets the server hold frames back while a slow connection still
 * has data queued; they keep merging until it drains.
 */
export class ViewerStream {
  private pending: Frame | null = null;
  private lastSent = -Infinity;
  private timer: unknown = null;

  constructor(
    private readonly write: (message: FromWorker) => void,
    private readonly intervalMs: number,
    private readonly clock: {
      now(): number;
      schedule(fn: () => void, ms: number): unknown;
      cancel(handle: unknown): void;
    },
    private readonly canSend: () => boolean = () => true
  ) {}

  public post(message: FromWorker): void {
    if (message.kind !== 'frame') {
      if (message.kind === 'static') this.pending = null; // its frame belongs to the old world
      else this.flush();
      this.write(message);
      return;
    }
    this.pending = this.pending ? merge(this.pending, message) : message;
    if (message.fromStep) this.flush();
    else this.schedule();
  }

  /** Sends the pending frame now, if any. */
  public flush(): void {
    if (this.timer !== null) {
      this.clock.cancel(this.timer);
      this.timer = null;
    }
    if (!this.pending) return;
    const frame = this.pending;
    this.pending = null;
    this.lastSent = this.clock.now();
    this.write(frame);
  }

  public close(): void {
    if (this.timer !== null) this.clock.cancel(this.timer);
    this.timer = null;
    this.pending = null;
  }

  private schedule(): void {
    if (this.timer !== null) return;
    const wait = Math.max(0, this.lastSent + this.intervalMs - this.clock.now());
    this.timer = this.clock.schedule(() => {
      this.timer = null;
      if (this.canSend()) this.flush();
      else this.schedule(); // try again after another interval
    }, wait || (this.canSend() ? 0 : this.intervalMs));
  }
}

/** Contest numbers kept across merged frames (four per contest): the viewer shows at most 128 marks at once. */
const MERGED_CONTESTS_MAX = 4 * 128;

/** A newer frame on top of an unsent older one. */
function merge(older: Frame, newer: Frame): Frame {
  return {
    ...newer,
    fromStep: older.fromStep || newer.fromStep,
    events: older.events.length > 0 ? [...older.events, ...newer.events] : newer.events,
    ...(newer.panels ? {} : older.panels ? { panels: older.panels } : {}),
    ...(newer.landOverlay ? {} : older.landOverlay ? { landOverlay: older.landOverlay } : {}),
    ...(newer.landStructures ? {} : older.landStructures ? { landStructures: older.landStructures } : {}),
    ...(newer.settlements ? {} : older.settlements ? { settlements: older.settlements } : {}),
    ...(newer.landPaths ? {} : older.landPaths ? { landPaths: older.landPaths } : {}),
    ...mergeGroundDiff(older, newer),
    // Contests are a stream too: a merged frame carries both batches, or the older fights never show.
    ...(older.contests?.length ? { contests: [...older.contests, ...(newer.contests ?? [])].slice(-MERGED_CONTESTS_MAX) } : {}),
  };
}

/**
 * Ground diffs pile up like events: a full ground in the newer frame makes the older diffs moot. Each entry is
 * three bytes, so a diff's base64 never has padding and two of them join as one by plain concatenation
 * (the older first, so the newer value of a cell wins).
 */
function mergeGroundDiff(older: Frame, newer: Frame): { landPathsDiff?: string } {
  // Bounded: the host sends the full ground every 2 s, and a full one drops the diffs before it.
  if (newer.landPaths) return {};
  const parts = (older.landPathsDiff ?? '') + (newer.landPathsDiff ?? '');
  return parts ? { landPathsDiff: parts } : {};
}

/** JSON for the wire: typed arrays (heatmaps, genomes) become plain arrays; heatmaps are rounded to keep them small. */
export function encodeMessage(message: FromWorker): string {
  const hasTypedArrays =
    message.kind === 'saved' ||
    (message.kind === 'frame' && Boolean((message.panels as any)?.heatmap || message.panels?.selected));
  if (!hasTypedArrays) return JSON.stringify(message);
  return JSON.stringify(message, (_key, value: unknown) =>
    value instanceof Float32Array
      ? Array.from(value, (v) => Math.round(v * 1000) / 1000)
      : value instanceof Uint32Array
        ? Array.from(value)
        : value
  );
}
