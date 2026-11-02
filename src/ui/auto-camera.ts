/**
 * Auto-camera: follows a focus band between events and cuts to the most
 * interesting event. A pure state machine over real time in milliseconds, so it
 * can be tested without a browser. It decides where to look; the renderer
 * decides how to get there.
 *
 * Rules (docs/decisions.md, Phase 4: Camera):
 * - Follow the oldest large band; stay with it until it dies.
 * - A shot lasts at least `holdMs`. After that, a queued event of higher
 *   priority than the current shot takes over; otherwise an event shot ends and
 *   the camera goes back to the focus band.
 * - A focus band that dies ends its shot at once.
 * - Priority: battle 4 > split or new band 3 > leader death 2 > migration 1.
 *   Priority 0 (famine, boom) never moves the camera.
 * - Drift slowly when there is nothing to look at.
 * - After manual input, stay off for `resumeMs`.
 */

export interface CameraBand {
  readonly id: number;
  readonly size: number;
  readonly cx: number;
  readonly cy: number;
  readonly foundedTick: number;
}

export interface CameraEvent {
  readonly seq: number;
  readonly priority: number;
  readonly x: number;
  readonly y: number;
  readonly band: number;
}

export interface CameraSettings {
  readonly holdMs: number;
  readonly resumeMs: number;
  readonly driftCellsPerSecond: number;
  readonly minBandSize: number;
  /** Events older than this are dropped from the queue. */
  readonly staleMs: number;
}

export const DEFAULT_CAMERA_SETTINGS: CameraSettings = {
  holdMs: 30_000,
  resumeMs: 20_000,
  driftCellsPerSecond: 0.6,
  minBandSize: 20,
  staleMs: 90_000,
};

export type ShotKind = 'event' | 'band' | 'drift';

export interface Shot {
  readonly kind: ShotKind;
  readonly priority: number;
  /** Band being watched, or 0. */
  readonly band: number;
  readonly startedMs: number;
}

export interface CameraTarget {
  readonly x: number;
  readonly y: number;
  readonly kind: ShotKind;
}

interface Queued {
  readonly event: CameraEvent;
  readonly atMs: number;
}

export class AutoCamera {
  public enabled = true;
  private shot: Shot | null = null;
  private focusBand = 0;
  private queue: Queued[] = [];
  private lastInputMs = -Infinity;
  private lastUpdateMs = 0;
  private x = 128;
  private y = 128;
  private driftAngle = 0;
  private eventAt: { x: number; y: number } = { x: 128, y: 128 };

  constructor(private settings: CameraSettings = DEFAULT_CAMERA_SETTINGS) {}

  public configure(settings: Partial<CameraSettings>): void {
    this.settings = { ...this.settings, ...settings };
  }

  public currentShot(): Shot | null {
    return this.shot;
  }

  /** Chronicle entries as they arrive. Priority 0 entries never move the camera. */
  public notifyEvents(events: readonly CameraEvent[], nowMs: number): void {
    for (const event of events) {
      if (event.priority > 0 && event.x >= 0 && event.y >= 0) this.queue.push({ event, atMs: nowMs });
    }
  }

  /** The viewer panned, zoomed or picked someone: back off for a while. */
  public notifyUserInput(nowMs: number): void {
    this.lastInputMs = nowMs;
  }

  public isPaused(nowMs: number): boolean {
    return !this.enabled || nowMs - this.lastInputMs < this.settings.resumeMs;
  }

  /** Where to look now, or null when the camera is off or backing off. */
  public update(nowMs: number, bands: readonly CameraBand[]): CameraTarget | null {
    const dt = Math.max(0, Math.min(1000, nowMs - this.lastUpdateMs));
    this.lastUpdateMs = nowMs;
    if (this.isPaused(nowMs)) {
      // A shot does not run its clock while the viewer is in charge.
      if (this.shot) this.shot = { ...this.shot, startedMs: this.shot.startedMs + dt };
      return null;
    }

    this.queue = this.queue.filter((q) => nowMs - q.atMs <= this.settings.staleMs);
    const large = bands.filter((b) => b.size >= this.settings.minBandSize);
    const byId = new Map(large.map((b) => [b.id, b]));

    // A band that died ends its shot at once; the hold does not apply.
    if (this.shot && this.shot.band !== 0 && this.shot.kind === 'band' && !byId.has(this.shot.band)) {
      this.shot = null;
      this.focusBand = 0;
    }

    // Drifting has nothing to hold: look at a band the moment one is large enough.
    if (this.shot && this.shot.kind === 'drift' && large.length > 0) this.shot = null;

    const held = this.shot ? nowMs - this.shot.startedMs : Infinity;
    const best = this.bestQueued();

    if (this.shot === null) {
      if (best) this.cutToEvent(best, nowMs);
    } else if (held >= this.settings.holdMs) {
      if (best && best.event.priority > this.shot.priority) {
        this.cutToEvent(best, nowMs);
      } else if (this.shot.kind === 'event') {
        this.shot = null; // the moment has passed; back to the focus band
      }
    }

    if (this.shot === null) this.startBackgroundShot(large, nowMs);

    const shot = this.shot as Shot | null;
    if (shot === null) return this.drift(dt);
    if (shot.kind === 'drift') return this.drift(dt);
    const watched = byId.get(shot.band);
    if (watched) {
      this.x = watched.cx;
      this.y = watched.cy;
      this.eventAt = { x: watched.cx, y: watched.cy };
    } else if (shot.kind === 'event') {
      this.x = this.eventAt.x;
      this.y = this.eventAt.y;
    }
    return { x: this.x, y: this.y, kind: shot.kind };
  }

  private bestQueued(): Queued | null {
    let best: Queued | null = null;
    for (const q of this.queue) {
      if (!best || q.event.priority > best.event.priority || (q.event.priority === best.event.priority && q.event.seq > best.event.seq)) {
        best = q;
      }
    }
    return best;
  }

  private cutToEvent(q: Queued, nowMs: number): void {
    this.queue = this.queue.filter((o) => o !== q && o.event.priority > q.event.priority);
    this.shot = { kind: 'event', priority: q.event.priority, band: q.event.band, startedMs: nowMs };
    this.eventAt = { x: q.event.x, y: q.event.y };
  }

  private startBackgroundShot(large: readonly CameraBand[], nowMs: number): void {
    let focus = large.find((b) => b.id === this.focusBand);
    if (!focus && large.length > 0) {
      focus = large.reduce((a, b) => (b.foundedTick < a.foundedTick || (b.foundedTick === a.foundedTick && b.size > a.size) ? b : a));
      this.focusBand = focus.id;
    }
    this.shot = focus
      ? { kind: 'band', priority: 0, band: focus.id, startedMs: nowMs }
      : { kind: 'drift', priority: 0, band: 0, startedMs: nowMs };
  }

  private drift(dt: number): CameraTarget {
    this.driftAngle += dt / 20_000;
    const step = (this.settings.driftCellsPerSecond * dt) / 1000;
    this.x += Math.cos(this.driftAngle) * step;
    this.y += Math.sin(this.driftAngle) * step;
    return { x: this.x, y: this.y, kind: 'drift' };
  }
}
