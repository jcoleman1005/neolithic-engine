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
  elevationSeaFraction: 0.28,
  elevationHillLevel: 0.68, // land above this height is drawn as hills (and is not woodland)
  elevationMountainLevel: 0.8,
  elevationSnowLevel: 0.9,
  elevationLakeDepth: 0.02, // a depression must fill this deep to hold a lake
  elevationMinLakeCells: 80, // land-locked lakes (with their rivers) smaller than this are dropped
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
  // S1 (docs/SETTLEMENTS.md): staying pays. Each piece has its own switch so it can be compared.
  // S2 (docs/SETTLEMENTS.md): paths. Steps wear the ground; worn ground is cheaper to walk and
  // lightly preferred, so routes reinforce themselves. Wear fades a little at a time when unused.
  // S3-pre (docs/SETTLEMENTS.md): packed earth. Well-fed people with empty hands dig earth from
  // trodden ground and set it down where people rest together, like stone. It builds less per load
  // and wears away faster, so stone stays the better material near the hills.
  // S3w (docs/SETTLEMENTS.md): carried water. Water is an ordinary carried item: fetched from
  // rivers and lakes, drunk from the carry, and poured into small stores at camps away from the river.
  // Shore test 1 (docs/findings.md): a hungry person on poor ground with no better smell nearby
  // keeps walking the way they were going, instead of stopping to roam less.
  hungerSearchEnabled: true,
  hungerSearchFood: 6.0, // a hungry person searches when plant food on their tile and the 4 beside it averages below this (was a scent-slope test that never fired)
  hungerSearchPersist: 1.2, // pull to keep going the same way
  hungerSearchExplore: 0.6, // chance of a random step while searching
  // Shore test 2: a searching person can see which neighbouring 16-tile block holds the most standing
  // plant food, and heads that way (sight across open land, not smell).
  farSightEnabled: true,
  farSightInterval: 30, // ticks between refreshes of the block food map
  farSightPull: 1.0, // pull toward the best block
  farSightMargin: 0.2, // a neighbouring block must hold this much more food (share) to draw them
  waterCarryEnabled: true, // a water store can be drunk from on its tile or any of the 8 around it, like a river
  adjacentStoresEnabled: true, // hungry people also eat from food heaps on the 8 tiles around them
  waterCarryMax: 20.0, // hydration a person can carry
  waterFetchChance: 0.05, // per tick, for someone who could fetch (keeps hands free for other work)
  waterFetchHydration: 90.0, // only someone this well watered fills up
  waterSpill: 0.2, // carried water lost per step
  waterPourMinDist: 4, // stores only this far or further from natural fresh water
  waterStoreCap: 100.0, // most water one tile's store holds
  waterEvaporation: 0.05, // store lost per tick in cool weather ...
  waterEvapWarm: 2.0, // ... times (1 + this x warmth) in warm weather
  waterCoveredEvapMul: 0.25, // ... and times this on a built tile (a covered jar)
  waterStoreFindMin: 10.0, // a store this full is found by thirsty people; it drops out below half
  earthBuildingEnabled: true,
  earthWear: 64, // earth comes only from ground worn at least this much (bare, trodden soil)
  earthBite: 1.0, // earth dug per tick
  earthCarryMax: 6.0,
  earthEnergy: 0.6, // digs only above this fraction of maxEnergy
  earthDigCost: 0.05, // energy spent per unit dug
  earthBuildGain: 2.0, // durability per unit of earth (stone gives buildGain)
  earthErodeSlices: 32, // earth-built tiles also lose 1 durability per this many ticks
  // S3a layout test (prototype, off until reviewed): an exposure field and carriers who set
  // material down on the neighbouring tile that best shelters them from the seasonal wind.
  exposureEnabled: false,
  exposureSlices: 8, // exposure is refreshed on 1 / this of the map each tick
  windWeight: 2.0, // how much more the upwind side counts than the others
  brushBarrier: 4.0, // barrier per unit of brush on a tile
  treeBarrier: 120.0, // barrier of a full stand of trees
  cliffBarrier: 600.0, // barrier per unit of height a neighbour stands above this tile
  directionalBuildEnabled: false,
  directionalAvoidWear: 64, // carriers do not build on tiles worn at least this much (they are routes)
  pathsEnabled: true,
  wearStep: 4, // wear added to a tile each time someone steps onto it, 0 to 255 (S2 tuning: was 16)
  wearDecaySlices: 2, // every tile loses 1 wear once per this many ticks (S2 tuning: was 8)
  pathCostCut: 0.5, // a fully worn tile costs this much less to step onto
  pathPull: 0.3, // how strongly people lean toward the more worn neighbour
  stayValueEnabled: true, // the stay check counts the heap underfoot and the real upkeep of the tile
  stayRefFood: 10.0, // food a tile with no plant capacity (rock, a hut on a hill) is measured against
  roamStayWeight: 0.2, // roaming and curious people need this much more (at the top of the range) to stay (S1 tuning: was 0.5)
  comfortableStayEnabled: true, // someone whose tile passes the stay check resists a leader's pull
  tileCrowdingEnabled: true, // a hut or nest's upkeep discount is shared among those on the tile
  hutCapacity: 4, // people a hut shelters in full
  nestCapacity: 3, // people a nest shelters in full
  storeScentEnabled: true, // food heaps add to the food scent, so stores can be found
  storeScentEmitRate: 0.02, // scent per unit of heaped food, each diffusion step
  storeUnloadEnabled: true, // carriers also unload food where a heap already lies
  shelterSeekEnabled: true, // huts and nests lead cold people to them, like caves and fires
  fireDetersWolvesEnabled: true, // wolves do not enter tiles warmed by a fire
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
  // Mutable fertility: soil fertility improves with tending (passive tilled+seeded cover,
  // explicit seed drops, tamping, compost) and degrades with overuse (repeated stripping/overgrazing).
  fertilityChangeEnabled: true,
  fertilityMin: 0.05, // lowest possible fertility (matches world elevation floor)
  fertilityMax: 1.5, // rich horticultural / terra preta ceiling
  fertilityDegradeRate: 0.0005, // fertility lost per bite that strips a cell
  fertilityPassiveGain: 0.00005, // per tick on tilled, seeded, healthy cells
  fertilityActionGain: 0.002, // fertility gain per full seed drop action
  fertilityTampGain: 0.0008, // fertility gain per tamp action
  fertilityCompostGain: 0.0005, // fertility gain when food heaps spoil into soil
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
  // Finite wild resources: woodland holds a limited stock of wood that brush gathering uses up
  // (and that regrows slowly); open fertile ground carries seasonal berries that top up a meal.
  finiteResourcesEnabled: true,
  treeCap: 100.0, // wood stock of a fully wooded tile (scaled by its cover)
  treeRegrowRate: 0.0003, // fraction of a tile's stock regrown per tick (x season factor)
  // Phase 6a: herbivore herds. Dumb animals that graze, drift toward richer ground, flee people,
  // breed when well fed and die of hunger or age. Their energy is plant-side (outside the ledger).
  herdsEnabled: true,
  // Hunting: a hungry person with an animal on or beside their tile may strike; a kill leaves meat
  // (the animal's energy) as a food heap at the hunter's feet.
  // Phase 6a-4: wolves. They wander, chase herd animals they can sense, kill adjacent prey for its
  // energy (leaving a share as meat), breed when fed and starve without prey. Each leaves danger
  // scent; a lone person beside one may be killed. Their energy is plant-side.
  wolvesEnabled: true,
  wolfInitialCount: 20,
  wolfCapacity: 128,
  wolfMaxEnergy: 80.0,
  wolfUpkeep: 0.06, // energy lost per tick
  wolfMoveCost: 0.03,
  wolfKillChance: 0.6, // per tick with prey on or beside the tile
  wolfMeatFactor: 1.2, // energy gained per unit of the prey's energy
  wolfLeaveMeat: 0.3, // share of the prey's energy left as a food heap
  wolfAttackChance: 0.04, // per tick with a lone person beside it
  wolfPersonMeal: 20.0, // energy a wolf gains from a person
  wolfLoneRadius: 2, // a person is only a target with no one else within this many tiles (S1: was 0)
  wolfDanger: 2.0, // danger scent left per tick
  wolfBreedEnergy: 50.0,
  wolfBirthEnergy: 20.0,
  wolfBreedChance: 0.02, // per tick once able, scaled by (1 - wolves / wolfSoftCap)
  wolfSoftCap: 40,
  wolfAdultAge: 360,
  wolfMaxAge: 5400,
  wolfSenseRadius: 8, // tiles within which a wolf turns toward herd animals
  wolfPersist: 0.75, // chance per tick a wandering wolf keeps its heading
  huntingEnabled: true,
  huntBelow: 0.6, // hunts below this fraction of maxEnergy
  huntChance: 0.15, // chance a strike kills, per tick with prey adjacent
  huntCost: 0.3, // labour per strike (booked as movement)
  huntMeatFactor: 1.0, // meat per unit of the animal's energy
  carcassTicks: 120, // how long the dead-animal graphic stays (viewer only), if the meat lasts
  herdInitialCount: 150, // founder animals
  herdCapacity: 1024, // slots (an upper bound; food, not this, should limit the herds)
  herdMaxEnergy: 50.0,
  herdUpkeep: 0.1, // energy lost per tick
  herdMoveCost: 0.02, // extra energy per step
  herdGrazeBite: 1.0, // land food grazed per tick
  herdBreedEnergy: 35.0, // breeds above this energy ...
  herdBirthEnergy: 12.0, // ... passing this much to the newborn
  herdBreedChance: 0.03, // per tick once able, scaled by (1 - herd size / herdSoftCap)
  herdSoftCap: 300, // herd size at which breeding stops
  herdAdultAge: 180, // ticks before an animal can breed
  herdMaxAge: 3600, // ticks (10 years)
  herdFleeRadius: 2, // tiles within which a person scares an animal
  herdFleeChance: 0.6, // per tick, so a few are caught
  herdStayFraction: 0.5, // settles on a tile holding at least this fraction of its capacity
  herdWander: 0.1, // chance per tick that a settled animal drifts anyway
  thirstEnabled: true, // switch for thirst alone (finiteResourcesEnabled switches all of it)
  fishCap: 10.0, // fish in a water tile (fresh water full, sea 0.7 of it)
  fishRegrowRate: 0.01, // fraction of a tile's stock regrown per tick (x season factor)
  fishBite: 0.3, // most fish taken from the shore in one tick
  fishBelow: 0.5, // ... by anyone below this fraction of maxEnergy
  thirstRate: 0.4, // hydration lost per tick
  thirstMax: 100.0,
  drinkRate: 25.0, // hydration gained per tick beside fresh water
  thirstSeek: 60.0, // below this hydration a person heads for the nearest fresh water
  thirstWarn: 30.0, // below this, upkeep rises ...
  thirstUpkeep: 0.5, // ... by this fraction of the metabolism
  dehydrationDamage: 0.5, // energy lost per tick at zero hydration (booked as upkeep)
  stumpBelow: 0.02, // a stand stripped below this fraction of its stock is left as stumps
  stumpRotTicks: 1080, // stumps block regrowth this long (3 years), then rot to open field
  treeBrushCost: 1.0, // wood used up per unit of brush gathered
  berryCap: 15.0, // berries on a fertile open tile (scaled by fertility)
  berryRegrowRate: 0.01, // fraction of a tile's stock regrown per tick (x season factor)
  berryBite: 0.08, // most berries eaten in one tick on top of grazing
  berryBelow: 0.4, // ... by anyone below this fraction of maxEnergy
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
  // Phase 5d: cold, caves and campfires. Winter and height lower the temperature; below
  // coldComfort an unsheltered person pays extra upkeep, up to coldUpkeep x metabolism at full cold.
  // Shelter is a cave, a nest, or the warm radius of a fire. A cold, resting person on a big enough
  // brush heap lights it; it burns the brush down and warms a radius while it lasts.
  // Phase 5f: stone and dry-stone huts. Well-fed people on rock (hill) tiles pick up stone, carry it
  // to where people gather and set it down; each stone adds durability to that tile. At hutDurability
  // the tile is a hut (shelter from the cold, cheaper upkeep). Durability erodes in a rotating slice
  // of cells, so a hut nobody tops up falls back to rubble.
  // Combat injury: a clash or a wolf bite wounds. While wounded a person pays extra upkeep
  // (injuryUpkeep x metabolism at full injury) and sometimes cannot step (up to injurySlow of
  // steps lost at full injury). Wounds heal only when fed (injuryHeal per tick above injuryHealEnergy
  // of maxEnergy), so a hungry wounded person bleeds out. Violent and wound deaths leave a grave mark.
  injuryEnabled: true,
  clashInjury: 60, // injury the loser of a clash takes ...
  clashInjuryWinner: 0.25, // ... and the winner takes this fraction of it
  injuryUpkeep: 0.3, // extra upkeep at full injury, as a multiple of metabolism
  injurySlow: 0.6, // fraction of steps lost at full injury
  injuryHealEnergy: 0.5, // heals only above this fraction of maxEnergy
  injuryHeal: 0.3, // injury healed per tick
  // S3x slow healing: wounds also heal below injuryHealEnergy, more slowly the hungrier the person
  // (healFloor of injuryHeal at zero energy, rising to the full rate at injuryHealEnergy), and
  // healShelterMul faster on a sheltered tile (cave, fire, hut, nest). Healing costs no energy.
  slowHealEnabled: true,
  healFloor: 0.2, // fraction of injuryHeal at zero energy
  healShelterMul: 1.5, // healing multiplier on a sheltered tile
  // S3x fear: the loser of a clash, or someone bitten by a wolf, gains fearPerLoss, felt only within
  // fearRadius of where they were beaten. Losses there stack; a loss elsewhere starts a new place
  // keeping half. Inside the region fear raises the food staying needs (x 1 + fearStayMul at full fear)
  // and pushes away from the centre (fearPush at full fear). It fades by fearDecayInside a tick inside
  // the region and fearDecayOutside once out. A child near a parent (careRadius) loses
  // fearChildParentDecay more a tick; near an allied adult (on or beside their tile), fearChildAdultDecay.
  fearEnabled: true,
  fearPerLoss: 60,
  fearRadius: 8,
  fearStayMul: 2.0,
  fearPush: 2.0, // above the strongest leader pull (1.6), so a badly frightened follower breaks away
  fearDecayInside: 0.02,
  fearDecayOutside: 0.3,
  fearChildParentDecay: 0.3,
  fearChildAdultDecay: 0.1,
  // S3x: wounds make fear push harder (x 1 + fearWoundMul at full injury), and hunger no longer
  // halves the danger aversion of someone who is afraid.
  fearWoundsEnabled: true,
  fearWoundMul: 1.0,
  wolfBiteEnergy: 25, // energy a wolf takes in a bite on a lone person
  wolfInjury: 150, // injury from a wolf bite
  graveTicks: 150, // how long a fresh grave mark stays visible
  // Bodies (5g). Life stages: children and elders give less work (forage bite, carry, clash
  // strength). Strength gene scales carrying. Childcare: a child under adultAge costs its
  // mother (split with a mate beside them) childCare energy a tick while within careRadius.
  // Fatigue: steps add, standing still clears; at full fatigue upkeep rises by fatigueUpkeep x
  // metabolism and fatigueSlow of steps are lost. Disease: a sick person spreads it by touch
  // (sickSpread), pays sickUpkeep x metabolism, and recovers after sickTicks (faster when fed).
  stagesEnabled: true,
  childWork: 0.6,
  elderWork: 0.8,
  childUpkeepMul: 0.7, // children have lower body mass, lower baseline upkeep
  elderUpkeepMul: 1.0, // elders baseline upkeep
  strengthScalingEnabled: true, // switch for strength gene scaling work/carrying
  strengthCarry: 0.6, // carry/work multiplier is 1 + this x (strength/255 - 0.5)
  stageHarvestScale: true, // whether wild foraging (berries, fish, brush) scales with bodyMul
  workStrengthScale: true, // whether tamping compaction scales with bodyMul (stageWork * strength)
  bodyDrivesEnabled: true,
  hungerDriveThreshold: 0.35, // fraction of maxEnergy below which hunger drive dominates
  criticalHungerThreshold: 0.20, // fraction of maxEnergy below which curiosity/danger aversion drops
  hungerFoodWeightMul: 2.5, // multiplier on food scent gradient when hungry
  hungerLeaderPullMul: 0.25, // dampening on leader pull when hungry
  childcareEnabled: true,
  childCare: 0.05,
  careRadius: 4,
  fatigueEnabled: true,
  fatigueMove: 2,
  fatigueRest: 6,
  fatigueUpkeep: 0.3,
  fatigueSlow: 0.3,
  diseaseEnabled: true,
  sickSpread: 0.03, // chance a touch passes it on
  sickBase: 0.00002, // per-tick chance of falling ill with no contact, x (1 + cold)
  sickTicks: 120,
  sickUpkeep: 0.8,
  sickFedHeal: 1, // extra ticks of recovery per tick while fed
  buildingEnabled: true,
  stoneCap: 30.0, // stone on a rock tile (finite, does not regrow)
  stoneBite: 1.0, // stone picked up per tick on rock
  stoneCarryMax: 8.0,
  stoneEnergy: 0.6, // picks up stone above this fraction of maxEnergy
  buildGain: 4.0, // durability added per unit of stone set down
  durabilityCap: 255, // most durability a tile holds
  hutDurability: 60, // a tile at or above this is a hut ...
  hutKeep: 20, // ... until erosion takes it below this
  erosionSlices: 64, // each tile loses 1 durability once per this many ticks
  hutUpkeep: 0.5, // upkeep multiplier for anyone standing in a hut
  coldEnabled: true,
  cavesEnabled: true,
  firesEnabled: true,
  coldSeasonAmp: 1.0, // seasonal temperature swing: +/- this around 0 (winter -1, summer +1)
  coldComfort: -0.4, // temperature below this is cold ...
  coldSpan: 0.6, // ... and it is bitter (1.0) this much lower
  coldUpkeep: 0.6, // extra upkeep at full cold, as a fraction of metabolism
  coldSeekEnergy: 0.5, // cold people head for shelter (and stay) only above this fraction of maxEnergy
  caveCount: 40, // natural caves on hill edges
  caveSpacing: 6, // caves are at least this many tiles apart
  fireIgniteBrush: 6.0, // brush on a tile needed to light a fire
  fireIgniteChance: 0.2, // chance a cold resting person lights it each tick
  fireBurnRate: 0.15, // brush burned per tick
  fireWarmRadius: 2, // tiles (square) around a fire that count as sheltered
  fireSeekRadius: 12, // cold people sense a fire or cave within this many steps
  farmingEnabled: true,
  ritualEnabled: true,

  // Life & Demographics (Phase 1)
  initialPopulation: 700,
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

  // Childbirth hazards: physical trauma and metabolic demands of reproduction.
  // Delivery inflicts physical injury (mitigated by shelters, exacerbated by cold).
  // Gestation adds a metabolic surcharge; severe starvation triggers miscarriage.
  birthHazardsEnabled: true,
  pregnancyUpkeepMul: 1.25, // extra upkeep multiplier while pregnant (1.25 = +25% upkeep)
  pregnancyMiscarriageEnergy: 15.0, // pregnancy terminates early if mother drops to or below this
  birthInjury: 40.0, // baseline physical injury inflicted on mother at delivery
  birthShelterInjuryMul: 0.35, // multiplier on birth injury in a shelter (cave, nest, hut, fire)
  birthColdInjuryMul: 1.5, // multiplier on birth injury if unsheltered in freezing cold
  birthExhaustionInjury: 20.0, // injury sustained if delivery fails due to severe exhaustion

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
  settlementTrackEnabled: true, // observer only: names and ranks clusters of built cells
  settlementScanInterval: 30, // ticks between scans
  settlementGap: 2, // built cells this close are one settlement
  settlementResidentRadius: 3, // people this close to a built cell count as residents
  settlementResidentSmoothing: 0.2, // share of each scan's count blended in, so passers-by barely count
  settlementGraceTicks: 360, // a settlement below the camp minimum lasts this long before it is abandoned
  settlementAnnounceTier: 1, // chronicle entries from this tier up (camps flicker, so they stay silent)
  settlementCampBuilt: 3, settlementCampResidents: 5,
  settlementHamletBuilt: 10, settlementHamletResidents: 20, settlementHamletYears: 5,
  settlementVillageBuilt: 30, settlementVillageResidents: 80, settlementVillageYears: 10,
  settlementTownBuilt: 120, settlementTownResidents: 400, settlementTownYears: 20,
  settlementCityBuilt: 300, settlementCityResidents: 1000, settlementCityYears: 30,
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
