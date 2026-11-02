import { World } from './world';
import type { FromWorker, PanelData, SavedWorld, ToWorker } from './protocol';
import { EVENT_LOG_SIZE, WorldEventDetector, type WorldEvent } from './events';
import { Chronicle } from './chronicle';
import type { SimulationConfig, WorldMetrics } from './types';

/** How often panel data (metrics, history) is sent while running. */
export const PANEL_INTERVAL_MS = 200;
/** Ticks never pile up beyond this much lag (e.g. after the tab was hidden). */
const MAX_LAG_MS = 250;

export interface HostEnvironment {
  /** The page, when there is exactly one (the Web Worker). The server connects viewers instead. */
  post?(message: FromWorker): void;
  now(): number;
  /** Runs `fn` after `ms`; returns a handle for cancel. */
  schedule(fn: () => void, ms: number): unknown;
  cancel(handle: unknown): void;
}

interface Viewer {
  readonly post: (message: FromWorker) => void;
  selectedId: number | string | null;
  wantsHistory: boolean;
}

export interface PlaybackState {
  readonly running: boolean;
  readonly ticksPerSecond: number;
}

export class SimulationHost {
  public world: World;
  private readonly env: HostEnvironment;
  private running = false;
  private ticksPerSecond = 3;
  private accumulator = 0;
  private lastPump = 0;
  private timer: unknown = null;
  private lastPanels = -Infinity;
  private readonly viewers = new Map<number, Viewer>();
  private nextViewerId = 1;

  private events = new WorldEventDetector();
  private chronicle = new Chronicle();
  private pendingEvents: WorldEvent[] = [];
  /** Recent events kept for new viewers and for saves. */
  private eventLog: WorldEvent[] = [];
  private readonly tickTimes: number[] = [];

  constructor(env: HostEnvironment, config?: Partial<SimulationConfig>) {
    this.env = env;
    this.world = new World(config);
    this.resetObservers();
    if (env.post) this.connect(env.post);
  }

  public connect(post: (message: FromWorker) => void, beforeWelcome?: (id: number) => void): number {
    const id = this.nextViewerId++;
    const viewer: Viewer = { post, selectedId: null, wantsHistory: false };
    this.viewers.set(id, viewer);
    beforeWelcome?.(id);
    this.postStatic(viewer);
    viewer.post(this.frameFor(viewer, this.baseFrame(false), this.metricsIfAny()));
    return id;
  }

  public disconnect(id: number): void {
    this.viewers.delete(id);
  }

  public get viewerCount(): number {
    return this.viewers.size;
  }

  public playback(): PlaybackState {
    return { running: this.running, ticksPerSecond: this.ticksPerSecond };
  }

  public handle(message: ToWorker, viewerId?: number): void {
    const viewer = viewerId === undefined ? this.viewers.values().next().value : this.viewers.get(viewerId);
    switch (message.kind) {
      case 'play':
        if (this.running) return;
        this.running = true;
        this.accumulator = 0;
        this.lastPump = this.env.now();
        this.tickTimes.length = 0;
        this.scheduleNext();
        break;
      case 'pause':
        this.running = false;
        this.stopTimer();
        this.tickTimes.length = 0;
        this.postFrame(false, true);
        break;
      case 'step':
        if (this.running) return;
        this.stepWorld();
        this.postFrame(true, true);
        break;
      case 'speed':
        this.ticksPerSecond = Math.max(0.1, message.ticksPerSecond);
        this.tickTimes.length = 0;
        if (this.running) {
          this.stopTimer();
          this.scheduleNext();
        }
        break;
      case 'reset':
        this.running = false;
        this.stopTimer();
        if (message.config) Object.assign(this.world.config, message.config);
        this.world.reset(message.seed);
        this.resetObservers();
        for (const v of this.viewers.values()) v.selectedId = null;
        this.tickTimes.length = 0;
        this.postStatic();
        this.postFrame(false, true);
        break;
      case 'config':
        Object.assign(this.world.config, message.config);
        for (const v of this.viewers.values()) v.post({ kind: 'config', config: { ...this.world.config } });
        this.postFrame(false, true);
        break;
      case 'select':
        if (!viewer) return;
        viewer.selectedId = message.id;
        this.postFrame(false, true);
        break;
      case 'panels':
        if (!viewer) return;
        viewer.wantsHistory = message.history;
        this.postFrame(false, true);
        break;
      case 'csv':
        viewer?.post({ kind: 'csv', requestId: message.requestId, csv: this.world.history.toCSV() });
        break;
      case 'save':
        viewer?.post({ kind: 'saved', requestId: message.requestId, saved: this.save() });
        break;
      case 'load':
        this.load(message.saved, viewer);
        break;
    }
  }

  private pump(): void {
    this.timer = null;
    if (!this.running) return;
    const now = this.env.now();
    const interval = 1000 / this.ticksPerSecond;
    this.accumulator += Math.min(now - this.lastPump, Math.max(MAX_LAG_MS, interval));
    this.lastPump = now;
    let stepped = 0;
    while (this.accumulator >= interval) {
      this.stepWorld();
      this.tickTimes.push(now);
      this.accumulator -= interval;
      stepped++;
    }
    if (stepped > 0) this.postFrame(false, now - this.lastPanels >= PANEL_INTERVAL_MS);
    this.scheduleNext();
  }

  public save(): SavedWorld {
    return {
      format: 'neolithic-world',
      version: 1,
      savedAt: new Date().toISOString(),
      world: this.world.exportState(),
      events: this.eventLog.slice(),
      chronicle: this.chronicle.exportState(),
    };
  }

  private load(saved: SavedWorld, from?: Viewer): void {
    let world: World;
    try {
      world = World.fromState(saved.world);
    } catch (error) {
      from?.post({ kind: 'error', message: `Could not load that world: ${(error as Error).message}` });
      if (!from) throw error;
      return;
    }
    this.running = false;
    this.stopTimer();
    this.world = world;
    this.resetObservers();
    if (saved.chronicle) this.chronicle.importState(saved.chronicle);
    this.eventLog = saved.events.slice(-EVENT_LOG_SIZE);
    this.events = new WorldEventDetector(this.eventLog);
    this.tickTimes.length = 0;
    for (const v of this.viewers.values()) v.selectedId = null;
    this.postStatic();
    this.postFrame(false, true);
  }

  private stepWorld(): void {
    this.world.step();
    const fresh = this.events.record(this.world);
    for (const body of this.chronicle.record(this.world)) fresh.push(this.events.stamp(this.world, body));
    if (fresh.length > 0) {
      this.pendingEvents.push(...fresh);
      this.eventLog.push(...fresh);
      if (this.eventLog.length > EVENT_LOG_SIZE) this.eventLog.splice(0, this.eventLog.length - EVENT_LOG_SIZE);
    }
  }

  private resetObservers(): void {
    this.events = new WorldEventDetector();
    this.chronicle = new Chronicle();
    this.pendingEvents = [];
    this.eventLog = [];
  }

  private scheduleNext(): void {
    const interval = 1000 / this.ticksPerSecond;
    const elapsed = this.env.now() - this.lastPump;
    this.timer = this.env.schedule(() => this.pump(), Math.max(1, interval - this.accumulator - elapsed));
  }

  private stopTimer(): void {
    if (this.timer !== null) this.env.cancel(this.timer);
    this.timer = null;
  }

  private terrainSentFor: ReturnType<World['getTerrain']> = null;
  private terrainSentVersion = -1;
  private terrainSentAt = 0;

  private postStatic(only?: Viewer): void {
    const { world } = this;
    if (!only) {
      this.terrainSentFor = world.getTerrain();
      this.terrainSentVersion = this.terrainSentFor?.version ?? -1;
      this.terrainSentAt = this.env.now();
    }
    const message: FromWorker = {
      kind: 'static',
      config: { ...world.config },
      obstacles: world.rocks(),
      ...(world.getElevation() ? { elevation: world.getElevation()!.exportView() } : {}),
      ...(world.getTerrain() ? { terrain: world.getTerrain()!.exportState(true) } : {}),
      foodRegions: world.foodRegions.map((r) => ({ ...r })),
      events: this.eventLog.slice(),
    };
    for (const v of only ? [only] : this.viewers.values()) v.post(message);
  }

  private baseFrame(fromStep: boolean): Omit<Extract<FromWorker, { kind: 'frame' }>, 'panels'> {
    const { world } = this;
    const now = this.env.now();
    while (this.tickTimes.length > 0 && now - this.tickTimes[0] > 1000) this.tickTimes.shift();
    const packed = world.packPeopleFrame();
    return {
      kind: 'frame',
      tick: world.tick,
      packedPeople: packed.base64,
      peopleCount: packed.count,
      organisms: [],
      foodPatches: [],
      carrion: [],
      eggs: [],
      ticksPerSecond: this.tickTimes.length,
      running: this.running,
      targetTicksPerSecond: this.ticksPerSecond,
      fromStep,
      events: this.pendingEvents,
    };
  }

  private metricsIfAny(): WorldMetrics | null {
    return this.viewers.size > 0 ? this.world.getMetrics() : null;
  }

  private frameFor(
    viewer: Viewer,
    base: Omit<Extract<FromWorker, { kind: 'frame' }>, 'panels'>,
    metrics: WorldMetrics | null
  ): FromWorker {
    if (!metrics) return base;
    const selectedPerson = viewer.selectedId !== null ? this.world.getPersonRecord(viewer.selectedId) : null;
    const panels: PanelData = {
      metrics,
      selected: null,
      selectedPerson,
      selectedId: viewer.selectedId,
      bands: this.chronicle.bandViews(this.world.config.cameraMinBandSize ?? 20),
      selectedStory: selectedPerson ? this.chronicle.describePerson(this.world, selectedPerson) : null,
      ...(viewer.wantsHistory ? { history: this.world.history.getSamples() } : {}),
    };
    return { ...base, panels };
  }

  private postFrame(fromStep: boolean, withPanels: boolean): void {
    if (this.viewers.size === 0) {
      this.pendingEvents = [];
      return;
    }
    const terrain = this.world.getTerrain();
    const terrainDue =
      terrain !== null &&
      withPanels &&
      (this.terrainSentFor !== terrain || this.terrainSentVersion !== terrain.version) &&
      this.env.now() - this.terrainSentAt >= 1000;
    const base = { ...this.baseFrame(fromStep), ...(terrainDue ? { terrain: terrain.exportState() } : {}) };
    if (terrainDue) {
      this.terrainSentFor = terrain;
      this.terrainSentVersion = terrain.version;
      this.terrainSentAt = this.env.now();
    }
    let metrics: WorldMetrics | null = null;
    if (withPanels) {
      this.lastPanels = this.env.now();
      metrics = this.world.getMetrics();
    }
    for (const v of this.viewers.values()) v.post(this.frameFor(v, base, metrics));
    this.pendingEvents = [];
  }
}
