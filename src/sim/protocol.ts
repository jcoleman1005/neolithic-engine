import type { ElevationField, ElevationState } from './elevation';
import type { HistorySample } from './history';
import type { TerrainField, TerrainState } from './terrain';
import type { WorldEvent } from './events';
import type { FoodRegion, SimulationConfig, WorldMetrics } from './types';
import type { WorldState } from './world';

export const PERSON_FRAME_BYTES = 5;

// Look byte bit layout:
// Bit 0: sex (0 = female, 1 = male)
// Bit 1: pregnant (0 = no, 1 = yes)
// Bits 2..3: life stage (0 = child, 1 = adult, 2 = elder)
// Bits 4..7: energy level (0..15 quantized)
export const LOOK_SEX_MASK = 0x01;
export const LOOK_PREGNANT_MASK = 0x02;
export const LOOK_STAGE_MASK = 0x0c;
export const LOOK_STAGE_CHILD = 0;
export const LOOK_STAGE_ADULT = 1;
export const LOOK_STAGE_ELDER = 2;
export const LOOK_ENERGY_MASK = 0xf0;

export function encodeLookByte(
  sex: number,
  pregnant: boolean,
  stage: number,
  energy: number,
  maxEnergy = 100
): number {
  const s = sex & 1;
  const p = pregnant ? LOOK_PREGNANT_MASK : 0;
  const st = (stage & 3) << 2;
  const clampedEnergy = Math.max(0, Math.min(maxEnergy, energy));
  const e = (Math.min(15, Math.floor((clampedEnergy / maxEnergy) * 15)) << 4) & LOOK_ENERGY_MASK;
  return (s | p | st | e) & 0xff;
}

export interface DecodedLook {
  readonly sex: 'female' | 'male';
  readonly pregnant: boolean;
  readonly stage: 'child' | 'adult' | 'elder';
  readonly energyLevel: number; // 0..15
}

export function decodeLookByte(look: number): DecodedLook {
  const sex = (look & LOOK_SEX_MASK) === 1 ? 'male' : 'female';
  const pregnant = (look & LOOK_PREGNANT_MASK) !== 0;
  const stageRaw = (look & LOOK_STAGE_MASK) >> 2;
  const stage = stageRaw === LOOK_STAGE_CHILD ? 'child' : stageRaw === LOOK_STAGE_ELDER ? 'elder' : 'adult';
  const energyLevel = (look & LOOK_ENERGY_MASK) >> 4;
  return { sex, pregnant, stage, energyLevel };
}

export interface PersonDetail {
  readonly id: number;
  readonly slot: number;
  readonly generation: number;
  readonly x: number;
  readonly y: number;
  readonly energy: number;
  readonly sex: 'female' | 'male';
  readonly ageTicks: number;
  readonly ageYears: number;
  readonly pregnant: boolean;
  readonly pregnancyTicks: number;
  readonly mateSlot: number;
  readonly motherId: number;
  readonly fatherId: number;
}

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
  readonly peopleCount: number;
  readonly terrain?: TerrainField | null;
  readonly elevation?: ElevationField | null;
  readonly selectedPerson?: PersonDetail | null;
  readonly organisms?: ReadonlyMap<string, OrganismView>;
  readonly foodPatches?: ReadonlyMap<string, any>;
  readonly carrion?: ReadonlyMap<string, any>;
  readonly eggs?: ReadonlyMap<string, any>;
  readonly foodRegions?: readonly FoodRegion[];
  readonly obstacles?: ReadonlySet<string>;
  getSelectedOrganism?(): OrganismView | undefined;
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
  readonly selected?: OrganismView | null;
  readonly selectedPerson?: PersonDetail | null;
  readonly selectedId?: number | string | null;
  readonly history?: readonly HistorySample[];
}

export type FromWorker =
  | ({ readonly kind: 'static' } & WorldStatic)
  | {
      readonly kind: 'frame';
      readonly tick: number;
      readonly packedPeople: string;
      readonly peopleCount: number;
      readonly terrain?: TerrainState;
      readonly ticksPerSecond: number;
      readonly running: boolean;
      readonly targetTicksPerSecond: number;
      readonly fromStep: boolean;
      readonly events: readonly WorldEvent[];
      readonly panels?: PanelData;
      // Stubs for backwards compatibility
      readonly organisms?: readonly OrganismView[];
      readonly foodPatches?: readonly never[];
      readonly carrion?: readonly never[];
      readonly eggs?: readonly never[];
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
  | { readonly kind: 'select'; readonly id: number | string | null }
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
