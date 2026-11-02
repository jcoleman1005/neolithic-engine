/**
 * Core types and data structures for Neolithic Engine.
 */
import type { ElevationField } from './elevation';
import type { TerrainField } from './terrain';

export interface Point {
  readonly x: number;
  readonly y: number;
}

export type Direction = 'north' | 'south' | 'east' | 'west';

export interface DirectionOffset {
  readonly dir: Direction;
  readonly dx: number;
  readonly dy: number;
}

export const DIRECTION_OFFSETS: readonly DirectionOffset[] = [
  { dir: 'north', dx: 0, dy: -1 },
  { dir: 'south', dx: 0, dy: 1 },
  { dir: 'east', dx: 1, dy: 0 },
  { dir: 'west', dx: -1, dy: 0 },
] as const;

export interface FoodRegion {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

export interface FoodPatch {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  food: number;
  capacity: number;
}

export interface CarrionPatch {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  energy: number;
  rotTicks: number;
}

export interface SimulationConfig {
  worldWidth: number;
  worldHeight: number;
  gridWidth: number;
  gridHeight: number;
  wrapping: boolean;
  seed: number;
  ticksPerYear: number;

  // Geography & Land
  terrainEnabled: boolean;
  elevationEnabled: boolean;
  elevationPlateCount: number;
  elevationContinentalShare: number;
  elevationSeaFraction: number;
  elevationMinContinent: number;
  elevationNoise: number;
  elevationRidge: number;
  elevationDeepThreshold: number;
  elevationRiverFraction: number;
  elevationSlopeUp: number;
  elevationSlopeDown: number;
  elevationLapse: number;
  elevationWadeDrag: number;
  elevationWaterChill: number;
  elevationRiparianReach: number;
  elevationFertilityMean: number;
  elevationFertilityMin: number;
  terrainScale: number;
  terrainThreshold: number;
  terrainWearEnabled: boolean;
  terrainWearRecovery: number;
  terrainTrampleRoughness: number;
  terrainTrampleCover: number;
  terrainGrazeCover: number;
  terrainRecoveryRate: number;
  terrainRoughnessCoeff: number;
  terrainCoverShelter: number;
  swimLandDrag: number;
  swimDeepDrag: number;

  // Feature Switches
  climbEnabled: boolean;
  calmMovementEnabled: boolean;
  stayFoodFraction: number;
  hungerStayPenalty: number;
  reversalOverride: number;
  copyEnabled: boolean;
  touchEnabled: boolean;
  cultureTouchEnabled: boolean;
  bandTrackEnabled: boolean;
  chronicleEnabled: boolean;
  autoCameraEnabled: boolean;
  cameraHoldSeconds: number;
  cameraResumeSeconds: number;
  cameraDriftCellsPerSecond: number;
  cameraMinBandSize: number;
  chronicleBattleClashes: number;
  chronicleBattleWindow: number;
  chronicleBattleCooldown: number;
  chronicleBattleMinSize: number;
  chronicleBattleSize: number;
  chronicleGreatBattleSize: number;
  chronicleSplitMinSize: number;
  chronicleFoundMinSize: number;
  chronicleLeaderMinFollowers: number;
  chronicleMigrationDistance: number;
  chronicleMigrationWindow: number;
  chronicleFamineDrop: number;
  chronicleBoomRise: number;
  chronicleWindowYears: number;
  chronicleCooldownYears: number;
  bandTrackInterval: number;
  bandTrackMinSize: number;
  cultureToleranceThreshold: number;
  cultureClashSlope: number;
  experienceHabitsEnabled: boolean;
  habitInnovationRate: number;
  habitInnovationRange: number;
  habitWinStep: number;
  habitLoseStep: number;
  habitHungerStep: number;
  habitFedStep: number;
  habitHelpStep: number;
  habitHungerEnergy: number;
  habitFedEnergy: number;
  seasonsEnabled: boolean;
  seasonAmplitude: number;
  farmingEnabled: boolean;
  ritualEnabled: boolean;

  // Life & Demographics (Phase 1)
  initialPopulation: number;
  initialEnergy: number;
  maxEnergy: number;
  metabolismCost: number;
  moveCost: number;
  forageBite: number;
  landFoodMax: number;
  landRegrowthRate: number;
  landGrazingFloor: number;
  adultAge: number;
  maxAge: number;
  reproductionThreshold: number;
  childEnergy: number;
  birthTax: number;
  gestationTicks: number;
  matingRadius: number;

  // Phase 3: Scent Fields, Genes, Habits & Rules
  scentDiffusionRate: number;
  scentEvaporationRate: number;
  scentDiffusionInterval: number;
  scentFoodEmitRate: number;
  scentDangerDeath: number;
  scentDangerClash: number;
  geneMutationRate: number;
  geneMutationRange: number;
  habitStickiness: number;
  decisionStaggerInterval: number;
  leaderWeightStrength: number;
  leaderWeightCharisma: number;
  leaderWeightEnergy: number;
  leaderWeightKin: number;
  leaderWeightWisdom: number;
  leaderWeightBravery: number;
  leaderSearchRadius: number;
  clashEnergyCost: number;
  clashLossShare: number;
  clashLootEfficiency: number;
  incumbencyBonus: number;
  rootLeaderSliceCount: number;
  shareEnergyMinSurplus: number;
  shareEnergyAmount: number;
}

export interface WorldMetrics {
  tick: number;
  year: number;
  population: number;
  bandCount?: number;
  largestBand?: number;
}

export interface LandView {
  readonly terrain?: TerrainField | null;
  readonly elevation?: ElevationField | null;
}

export interface WorldSnapshot {
  readonly tick: number;
  readonly gridWidth: number;
  readonly gridHeight: number;
  readonly obstacles: ReadonlySet<string>;
  readonly land?: LandView;
}
