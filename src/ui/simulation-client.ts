import { DEFAULT_CONFIG } from '../sim/config';
import type { HistorySample } from '../sim/history';
import { TerrainField } from '../sim/terrain';
import { ElevationField } from '../sim/elevation';
import { EVENT_LOG_SIZE, type WorldEvent } from '../sim/events';
import type {
  EggView,
  FromWorker,
  OrganismView,
  PanelData,
  SavedWorld,
  ToWorker,
  WorldView,
} from '../sim/protocol';
import type { CarrionPatch, FoodPatch, FoodRegion, SimulationConfig, WorldMetrics } from '../sim/types';

export interface ClientEvents {
  beforeFrame(): void;
  frame(fromStep: boolean): void;
  reset(): void;
  events(events: readonly WorldEvent[]): void;
  error(message: string): void;
  config(): void;
  connection(connected: boolean): void;
}

export interface ServerInfo {
  readonly app: 'neolithic-server' | 'alife-server';
  readonly buildId?: string;
  readonly frameIntervalMs: number;
  readonly maxTicksPerSecond: number;
  readonly watchOnly: boolean;
}

const CONTROL_TOKEN_KEY = 'neolithic:control-token';

function getControlToken(): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('control') ?? params.get('admin');
    if (fromUrl !== null) {
      if (fromUrl) sessionStorage.setItem(CONTROL_TOKEN_KEY, fromUrl);
      else sessionStorage.removeItem(CONTROL_TOKEN_KEY);
      return fromUrl || null;
    }
    return sessionStorage.getItem(CONTROL_TOKEN_KEY);
  } catch {
    return null;
  }
}

async function probeServer(): Promise<ServerInfo | null> {
  try {
    const res = await fetch('api/info');
    if (!res.ok) return null;
    return (await res.json()) as ServerInfo;
  } catch {
    return null;
  }
}

export class SimulationClient implements WorldView {
  public config: SimulationConfig = { ...DEFAULT_CONFIG };
  public tick = 0;
  public organisms = new Map<string, OrganismView>();
  public foodPatches = new Map<string, FoodPatch>();
  public carrion = new Map<string, CarrionPatch>();
  public eggs = new Map<string, EggView>();
  public foodRegions: readonly FoodRegion[] = [];
  public obstacles: ReadonlySet<string> = new Set();
  public terrain: TerrainField | null = null;
  public elevation: ElevationField | null = null;

  public ticksPerSecond = 0;
  public running = false;
  public targetTicksPerSecond = 0;
  public mode: 'worker' | 'server' | null = null;
  public serverInfo: ServerInfo | null = null;
  public connected = true;
  public readonly ready: Promise<void>;

  private selectedId: string | null = null;
  private metrics: WorldMetrics | null = null;
  private history: readonly HistorySample[] = [];
  private wantsHistory = false;
  public worldEvents: WorldEvent[] = [];
  private nextRequestId = 1;
  private readonly pendingCsv = new Map<number, (csv: string) => void>();
  private readonly pendingSaves = new Map<number, (saved: SavedWorld) => void>();
  private transport: ((message: ToWorker) => void) | null = null;
  private readonly queue: ToWorker[] = [];
  private readonly events: ClientEvents;

  constructor(events: ClientEvents) {
    this.events = events;
    this.ready = probeServer().then((info) => (info ? this.connectServer(info) : this.startWorker()));
  }

  private startWorker(): void {
    const worker = new Worker(new URL('../sim/worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<FromWorker>) => this.receive(event.data);
    this.mode = 'worker';
    this.transport = (message) => worker.postMessage(message);
    for (const message of this.queue.splice(0)) this.transport(message);
  }

  private connectServer(info: ServerInfo): void {
    this.mode = 'server';
    this.serverInfo = info;
    let viewer: number | null = null;
    let currentBuildId = info.buildId;
    const post = (message: ToWorker) => {
      if (viewer === null) {
        this.queue.push(message);
        return;
      }
      const token = getControlToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Viewer': String(viewer),
        ...(token ? { 'X-Control-Token': token } : {}),
      };
      fetch('api/command', {
        method: 'POST',
        headers,
        body: JSON.stringify(message),
      })
        .then(async (response) => {
          if (response.ok) return;
          const body = (await response.json().catch(() => ({}))) as { error?: string };
          this.events.error(body.error ?? `The server refused that (${response.status})`);
        })
        .catch(() => this.events.error('Could not reach the server'));
    };
    this.transport = post;
    const source = new EventSource('api/events');
    source.addEventListener('hello', (event) => {
      const hello = JSON.parse((event as MessageEvent<string>).data) as { viewer: number; buildId?: string };
      if (currentBuildId && hello.buildId && hello.buildId !== currentBuildId) {
        window.location.reload();
        return;
      }
      if (hello.buildId) currentBuildId = hello.buildId;
      viewer = hello.viewer;
      const restore: ToWorker[] = [];
      if (this.selectedId) restore.push({ kind: 'select', id: this.selectedId });
      if (this.wantsHistory) restore.push({ kind: 'panels', history: this.wantsHistory, heatmap: null });
      for (const message of [...restore, ...this.queue.splice(0)]) post(message);
      if (!this.connected) {
        this.connected = true;
        this.events.connection(true);
      }
    });
    source.onmessage = (event: MessageEvent<string>) => this.receive(JSON.parse(event.data) as FromWorker);
    source.onerror = () => {
      viewer = null;
      if (this.connected) {
        this.connected = false;
        this.events.connection(false);
      }
    };
  }

  private send(message: ToWorker): void {
    if (this.transport) this.transport(message);
    else this.queue.push(message);
  }

  private receive(message: FromWorker): void {
    switch (message.kind) {
      case 'static':
        this.config = message.config;
        this.obstacles = new Set(message.obstacles);
        this.terrain = message.terrain ? TerrainField.forView(message.terrain) : null;
        this.elevation = message.elevation ? ElevationField.forView(message.elevation) : null;
        this.foodRegions = message.foodRegions;
        this.worldEvents = [...message.events];
        this.events.reset();
        break;
      case 'frame': {
        this.events.beforeFrame();
        this.tick = message.tick;
        if (message.terrain) this.terrain = TerrainField.forView(message.terrain, this.terrain?.originalFields());
        this.organisms = new Map(message.organisms.map((o) => [o.id, o]));
        this.foodPatches = new Map(message.foodPatches.map((p) => [`${p.x},${p.y}`, p]));
        this.carrion = new Map((message.carrion ?? []).map((c) => [`${c.x},${c.y}`, c]));
        this.eggs = new Map((message.eggs ?? []).map((e) => [e.id, e]));
        this.ticksPerSecond = message.ticksPerSecond;
        this.running = message.running;
        this.targetTicksPerSecond = message.targetTicksPerSecond;
        if (message.panels) this.applyPanels(message.panels);
        if (message.events.length > 0) {
          this.worldEvents.push(...message.events);
          if (this.worldEvents.length > EVENT_LOG_SIZE) this.worldEvents.splice(0, this.worldEvents.length - EVENT_LOG_SIZE);
          this.events.events(message.events);
        }
        this.events.frame(message.fromStep);
        break;
      }
      case 'config':
        this.config = message.config;
        this.events.config();
        break;
      case 'csv':
        this.pendingCsv.get(message.requestId)?.(message.csv);
        this.pendingCsv.delete(message.requestId);
        break;
      case 'saved':
        this.pendingSaves.get(message.requestId)?.(message.saved);
        this.pendingSaves.delete(message.requestId);
        break;
      case 'error':
        this.events.error(message.message);
        break;
    }
  }

  private applyPanels(panels: PanelData): void {
    this.metrics = panels.metrics;
    if (panels.history) this.history = panels.history;
  }

  public play(): void {
    this.send({ kind: 'play' });
  }
  public pause(): void {
    this.send({ kind: 'pause' });
  }
  public step(): void {
    this.send({ kind: 'step' });
  }
  public setSpeed(ticksPerSecond: number): void {
    this.send({ kind: 'speed', ticksPerSecond });
  }
  public reset(seed: string | number, config?: Partial<SimulationConfig>): void {
    this.selectedId = null;
    this.send({ kind: 'reset', seed, config });
  }
  public setConfig(config: Partial<SimulationConfig>): void {
    Object.assign(this.config, config);
    this.send({ kind: 'config', config });
  }
  public select(id: string | null): void {
    this.selectedId = id;
    this.send({ kind: 'select', id });
  }
  public setWantsHistory(wants: boolean): void {
    this.wantsHistory = wants;
    this.send({ kind: 'panels', history: wants, heatmap: null });
  }
  public requestCSV(): Promise<string> {
    const requestId = this.nextRequestId++;
    return new Promise((resolve) => {
      this.pendingCsv.set(requestId, resolve);
      this.send({ kind: 'csv', requestId });
    });
  }
  public save(): Promise<SavedWorld> {
    const requestId = this.nextRequestId++;
    return new Promise((resolve) => {
      this.pendingSaves.set(requestId, resolve);
      this.send({ kind: 'save', requestId });
    });
  }
  public load(saved: SavedWorld): void {
    this.selectedId = null;
    this.send({ kind: 'load', saved });
  }

  public getSelectedOrganism(): OrganismView | undefined {
    return this.selectedId ? this.organisms.get(this.selectedId) : undefined;
  }
  public getMetrics(): WorldMetrics | null {
    return this.metrics;
  }
  public getHistorySamples(): readonly HistorySample[] {
    return this.history;
  }
}
