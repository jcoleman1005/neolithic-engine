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
  // Phase 5b: farming as physics (no unlock flags). Worked soil regrows faster, seeds are carried
  // and dropped by tired people, overgrazed soil degrades (see docs/findings.md).
  farmingPhysicsEnabled: true,
  tillGain: 0.015, // per bite: tilled += gain * (1 - tilled)
  tillDecay: 0.002, // per tick, fraction of tilling lost
  tillRegrowBoost: 1.0, // regrowth x (1 + boost * tilled)
  seedPickupPerBite: 0.05, // seeds picked up per bite of plant food
  seedCarryMax: 3.0, // most one person carries
  seedDropEnergy: 0.4, // tired: below this fraction of maxEnergy
  seedCap: 10.0, // most seeds a cell holds
  seedDecay: 0.004, // per tick, fraction of the seed bank lost
  seedRegrowBoost: 0.8, // regrowth x (1 + boost * seed fraction)
  seedCapacityBoost: 0.3, // food capacity x (1 + boost * seed fraction)
  soilWearRate: 0.0012, // soil health lost per bite that strips a cell
  soilRecoveryRate: 0.0015, // per tick, fraction of the missing health regained when not stripped
  soilMin: 0.2, // soil health never drops below this
  // Phase 5c: stigmergic stockpiles and building. Well-fed people gather surplus food, drop it
  // where people congregate, eat from it when hungry, and idle fed people tamp it down; a heap
  // that is big and compacted enough becomes a granary floor (see docs/findings.md).
  stockpilesEnabled: true,
  hoardEnergy: 0.9, // gathers surplus only above this fraction of maxEnergy
  hoardLandFraction: 0.7, // ... from a tile holding at least this fraction of its capacity
  foodBite: 1.0, // food gathered per tick
  foodCarryMax: 20.0, // most food one person carries
  carryDrag: 0.5, // moving costs x (1 + drag * carried / max)
  dropCrowd: 4, // a resting carrier drops where at least this many people stand
  dropWhenFull: false, // also unload anywhere once the sack is full (made heaps sprawl)
  pileEatBelow: 0.5, // hungry below this fraction of maxEnergy: eat from the pile underfoot
  pileEatBite: 5.0, // food eaten from a pile per tick
  pileSpoil: 0.004, // fraction of a heap lost per tick
  granarySpoilFactor: 0.2, // a granary floor loses this fraction of that
  pileCap: 200.0, // most food one tile holds
  pileScale: 60.0, // food at which a heap looks full-sized in the viewer
  workEnergy: 0.7, // idle people above this fraction of maxEnergy tamp a heap
  workMinPile: 4.0, // ... if the tile holds at least this much
  workGain: 0.02, // compaction per tamp
  workCost: 0.05, // energy per tamp
  compactionCap: 2.0,
  compactionDecay: 0.0003, // per tick (x10 when the heap is gone)
  heapMin: 2.0, // food that counts as a heap
  granaryMass: 30.0, // heap size to become a granary floor ...
  granaryCompaction: 1.5, // ... once compacted this much
  granaryKeepMass: 2.0, // a granary floor reverts below this mass ...
  granaryKeepCompaction: 0.3, // ... or this compaction
  // Phase 5c: nests. Brush is gathered in woodland by well-fed people with free hands, unloaded
  // where people congregate and tamped by idle fed people; a big compacted brush heap becomes a
  // nest, which cuts the upkeep of anyone standing in it (see docs/findings.md).
  nestsEnabled: true,
  brushEnergy: 0.6, // gathers brush above this fraction of maxEnergy
  brushBite: 1.0, // brush gathered per tick in woodland
  brushCarryMax: 10.0,
  brushCap: 100.0, // most brush one tile holds
  brushScale: 30.0, // brush at which a brush heap looks full-sized in the viewer
  brushDecay: 0.002, // fraction of a brush heap lost per tick (a nest keeps it, x granarySpoilFactor)
  brushWorkMin: 3.0, // idle people tamp a brush heap of at least this much
  nestMass: 12.0, // brush needed to become a nest ...
  nestCompaction: 1.0, // ... once compacted this much
  nestKeepMass: 3.0, // a nest reverts below this mass ...
  nestKeepCompaction: 0.5, // ... or this compaction
  nestUpkeep: 0.7, // upkeep multiplier for anyone standing in a nest
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
