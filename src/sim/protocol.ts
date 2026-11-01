import type { ElevationField, ElevationState } from './elevation';
import type { HistorySample } from './history';
import type { TerrainField, TerrainState } from './terrain';
import type { WorldEvent } from './events';
import type { CarrionPatch, FoodPatch, FoodRegion, SimulationConfig, WorldMetrics } from './types';
import type { WorldState } from './world';

export interface OrganismView {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly energy: number;
  readonly tag: number;
}

export interface EggView {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly laidTick: number;
  readonly energy: number;
  readonly tag: number;
}

export interface WorldView {
  readonly config: Readonly<SimulationConfig>;
  readonly tick: number;
  readonly organisms: ReadonlyMap<string, OrganismView>;
  readonly foodPatches: ReadonlyMap<string, FoodPatch>;
  readonly carrion: ReadonlyMap<string, CarrionPatch>;
  readonly eggs: ReadonlyMap<string, EggView>;
  readonly foodRegions: readonly FoodRegion[];
  readonly obstacles: ReadonlySet<string>;
  readonly terrain?: TerrainField | null;
  readonly elevation?: ElevationField | null;
  getSelectedOrganism(): OrganismView | undefined;
}

export interface WorldStatic {
  readonly config: SimulationConfig;
  readonly obstacles: readonly string[];
  readonly terrain?: TerrainState;
  readonly elevation?: ElevationState;
  readonly foodRegions: readonly FoodRegion[];
  readonly events: readonly WorldEvent[];
}

export type HeatmapKind = 'crowding' | 'deaths' | 'feeding';

export interface PanelData {
  readonly metrics: WorldMetrics;
  readonly selected: OrganismView | null;
  readonly history?: readonly HistorySample[];
}

export type FromWorker =
  | ({ readonly kind: 'static' } & WorldStatic)
  | {
      readonly kind: 'frame';
      readonly tick: number;
      readonly organisms: readonly OrganismView[];
      readonly foodPatches: readonly FoodPatch[];
      readonly carrion: readonly CarrionPatch[];
      readonly eggs?: readonly EggView[];
      readonly terrain?: TerrainState;
      readonly ticksPerSecond: number;
      readonly running: boolean;
      readonly targetTicksPerSecond: number;
      readonly fromStep: boolean;
      readonly events: readonly WorldEvent[];
      readonly panels?: PanelData;
    }
  | { readonly kind: 'config'; readonly config: SimulationConfig }
  | { readonly kind: 'csv'; readonly requestId: number; readonly csv: string }
  | { readonly kind: 'saved'; readonly requestId: number; readonly saved: SavedWorld }
  | { readonly kind: 'error'; readonly message: string };

export type ToWorker =
  | { readonly kind: 'play' }
  | { readonly kind: 'pause' }
  | { readonly kind: 'step' }
  | { readonly kind: 'speed'; readonly ticksPerSecond: number }
  | { readonly kind: 'reset'; readonly seed: string | number; readonly config?: Partial<SimulationConfig> }
  | { readonly kind: 'config'; readonly config: Partial<SimulationConfig> }
  | { readonly kind: 'select'; readonly id: string | null }
  | { readonly kind: 'panels'; readonly history: boolean; readonly heatmap: HeatmapKind | null }
  | { readonly kind: 'csv'; readonly requestId: number }
  | { readonly kind: 'save'; readonly requestId: number }
  | { readonly kind: 'load'; readonly saved: SavedWorld };

export interface SavedWorld {
  readonly format: 'neolithic-world';
  readonly version: 1;
  readonly savedAt: string;
  readonly world: WorldState;
  readonly events: readonly WorldEvent[];
}

export function isSavedWorld(value: unknown): value is SavedWorld {
  const v = value as Partial<SavedWorld> | null;
  return (
    !!v &&
    (v.format === 'neolithic-world' || (v as any).format === 'alife-world') &&
    v.version === 1 &&
    !!v.world &&
    Array.isArray(v.events)
  );
}
