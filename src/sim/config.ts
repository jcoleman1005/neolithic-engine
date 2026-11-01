import type { SimulationConfig } from './types';

/**
 * Default configuration for the Neolithic Engine.
 * 256x256 wrapped world, 360 ticks per year.
 */
export const DEFAULT_CONFIG: Readonly<SimulationConfig> = {
  worldWidth: 256,
  worldHeight: 256,
  gridWidth: 256,
  gridHeight: 256,
  wrapping: true,
  seed: 42,
  ticksPerYear: 360,

  // Geography & Land
  terrainEnabled: true,
  elevationEnabled: true,
  elevationPlateCount: 8,
  elevationContinentalShare: 0.5,
  elevationSeaFraction: 0.38,
  elevationMinContinent: 250,
  elevationNoise: 0.12,
  elevationRidge: 0.25,
  elevationDeepThreshold: 0.2,
  elevationRiverFraction: 0.03,
  elevationSlopeUp: 5,
  elevationSlopeDown: 2,
  elevationLapse: 0.4,
  elevationWadeDrag: 1,
  elevationWaterChill: 0.25,
  elevationRiparianReach: 5,
  elevationFertilityMean: 0.6,
  elevationFertilityMin: 0.04,
  terrainScale: 20,
  terrainThreshold: 0.35,
  terrainWearEnabled: false,
  terrainWearRecovery: 0.01,
  terrainTrampleRoughness: 0.02,
  terrainTrampleCover: 0.04,
  terrainGrazeCover: 0.06,
  terrainRecoveryRate: 0.005,
  terrainRoughnessCoeff: 0.5,
  terrainCoverShelter: 0.3,
  swimLandDrag: 1.5,
  swimDeepDrag: 2.0,

  // Feature Switches
  climbEnabled: true,
  copyEnabled: true,
  touchEnabled: true,
  farmingEnabled: true,
  ritualEnabled: true,

  // Life & Demographics (Phase 1)
  initialPopulation: 1000,
  initialEnergy: 50.0,
  maxEnergy: 100.0,
  metabolismCost: 0.25,
  moveCost: 0.05,
  forageBite: 1.0,
  landFoodMax: 25.0,
  landRegrowthRate: 0.05,
  landGrazingFloor: 1.0,
  adultAge: 5760, // 16 years * 360 ticks
  maxAge: 21600, // 60 years * 360 ticks
  reproductionThreshold: 65.0,
  childEnergy: 30.0,
  birthTax: 5.0,
  gestationTicks: 270, // 9 months
  matingRadius: 2,
};

export const WORLD_SIZES = [
  { label: '256 × 256 (Default)', width: 256, height: 256 },
  { label: '128 × 128 (Compact)', width: 128, height: 128 },
  { label: '64 × 64 (Tiny)', width: 64, height: 64 },
] as const;

export function normalizeConfig(partial: Partial<SimulationConfig> = {}): SimulationConfig {
  const merged = { ...DEFAULT_CONFIG, ...partial };
  // Ensure worldWidth / gridWidth consistency
  if (partial.worldWidth && !partial.gridWidth) merged.gridWidth = partial.worldWidth;
  if (partial.gridWidth && !partial.worldWidth) merged.worldWidth = partial.gridWidth;
  if (partial.worldHeight && !partial.gridHeight) merged.gridHeight = partial.worldHeight;
  if (partial.gridHeight && !partial.worldHeight) merged.worldHeight = partial.gridHeight;
  return merged;
}
