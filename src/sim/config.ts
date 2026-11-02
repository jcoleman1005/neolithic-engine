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
  // Phase 4 fix: calmer movement. Stay and graze on a tile that is rich enough, and do not step
  // straight back unless the pull is strong (see docs/findings.md).
  calmMovementEnabled: true,
  stayFoodFraction: 0.5, // stay while the tile holds this fraction of its capacity
  hungerStayPenalty: 0.5, // a hungry person wants this much more (x1.5) before staying
  reversalOverride: 1.5, // a 180 degree step back needs a pull at least this strong
  copyEnabled: true,
  touchEnabled: true,
  cultureTouchEnabled: true,
  bandTrackEnabled: true,
  chronicleEnabled: true,
  autoCameraEnabled: true,
  seasonsEnabled: true,
  seasonAmplitude: 0.8, // regrowth swings +/- this fraction around 1: summer 1.8x, winter 0.2x
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

  // Phase 3: Scent Fields, Genes, Habits & Rules
  scentDiffusionRate: 0.1,
  scentEvaporationRate: 0.02,
  scentDiffusionInterval: 4,
  scentFoodEmitRate: 0.1,
  scentDangerDeath: 10.0,
  scentDangerClash: 5.0,
  geneMutationRate: 0.05,
  geneMutationRange: 16,
  habitStickiness: 0.9,
  decisionStaggerInterval: 8,
  leaderWeightStrength: 1.0,
  leaderWeightCharisma: 1.0,
  leaderWeightEnergy: 1.0,
  leaderWeightKin: 1.0,
  leaderWeightWisdom: 1.0,
  leaderWeightBravery: 1.0,
  leaderSearchRadius: 6,
  clashEnergyCost: 1.0,
  clashLossShare: 0.25,
  clashLootEfficiency: 0.8,
  incumbencyBonus: 0.35,
  rootLeaderSliceCount: 8,
  shareEnergyMinSurplus: 15.0,
  shareEnergyAmount: 5.0,
  cultureToleranceThreshold: 0.08,
  cultureClashSlope: 4.0,
  // Phase 4 fix: culture keeps its variety. Habits come from one parent each, with rare
  // innovations, and shift with experience in small steps (see docs/findings.md).
  experienceHabitsEnabled: true,
  habitInnovationRate: 0.01, // chance per birth of one habit jumping
  habitInnovationRange: 40, // that jump is +/- this
  habitWinStep: 3, // belligerence gained by the winner of a clash
  habitLoseStep: 3, // belligerence lost by the loser
  habitHungerStep: 1, // forage and roaming gained per decision cycle while hungry
  habitFedStep: 1, // forage and roaming lost per decision cycle while well fed
  habitHelpStep: 3, // generosity and loyalty gained by someone who receives help
  habitHungerEnergy: 0.25, // hungry below this fraction of maxEnergy
  habitFedEnergy: 0.75, // well fed above this fraction

  // Phase 4: Chronicle band tracking (observer)
  bandTrackInterval: 60, // ticks between passes (1/6 year)
  bandTrackMinSize: 10, // a band is tracked from this size, dropped below half of it

  // Phase 4: Chronicle thresholds (tuned in docs/findings.md; ticks are days, 360 to a year)
  chronicleBattleClashes: 150, // clashes in one fight for it to be reported at all (a skirmish)
  chronicleBattleWindow: 5, // quiet ticks between two bands that end a fight (it is reported then)
  chronicleBattleCooldown: 360, // ticks after a report before the same pair can make another entry
  chronicleBattleSize: 300, // clashes in one fight that make it a battle
  chronicleGreatBattleSize: 700, // clashes in one fight that make it a great battle
  chronicleBattleMinSize: 20, // both bands must be this big
  chronicleSplitMinSize: 30, // a band that splits off is announced once it reaches this
  chronicleFoundMinSize: 70, // a band gathered around a loner is announced at this size
  chronicleLeaderMinFollowers: 80, // a leader's death is recorded when the band had this many
  chronicleMigrationDistance: 110, // net cells a band moves inside the window
  chronicleMigrationWindow: 1440, // ticks
  chronicleFamineDrop: 0.15, // fraction of population lost inside the window
  chronicleBoomRise: 0.3, // fraction of population gained inside the window
  // Phase 4c: auto-camera (viewer side, real seconds)
  cameraHoldSeconds: 30, // a shot lasts at least this long
  cameraResumeSeconds: 20, // after a manual pan or zoom, wait this long before resuming
  cameraDriftCellsPerSecond: 0.6, // slow drift when nothing is happening
  cameraMinBandSize: 20, // only bands this big are followed

  chronicleWindowYears: 1,
  chronicleCooldownYears: 5,
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
