import type { SimulationConfig } from '../sim/types';

/** Every config key that switches a feature on or off. */
export type FeatureKey = Extract<keyof SimulationConfig, `${string}Enabled`>;

export const FEATURE_GROUPS = [
  'Land and terrain',
  'Movement',
  'Food, farming and stores',
  'Building and settlements',
  'Conflict and turmoil',
  'Animals and hunting',
  'Body and health',
  'Weather and seasons',
  'Observers and camera',
] as const;
export type FeatureGroup = (typeof FEATURE_GROUPS)[number];

export interface FeatureSwitch {
  readonly key: FeatureKey;
  readonly group: FeatureGroup;
  readonly label: string;
  readonly help: string;
  /**
   * 'live': the sim reads it every tick, so a change applies at once.
   * 'newWorld': it is read only while a world is built or seeded, so it applies to the next world.
   */
  readonly when: 'live' | 'newWorld';
  /** Switches that must be on for this one to do anything. */
  readonly requires?: readonly FeatureKey[];
  /** Switches that must be off for this one to do anything (it is a fallback for them). */
  readonly requiresOff?: readonly FeatureKey[];
  /** No code reads this switch at the moment, so changing it does nothing. */
  readonly inert?: boolean;
}

const L = 'live' as const;
const N = 'newWorld' as const;

const TABLE = [
  // Land and terrain
  { key: 'terrainEnabled', group: 'Land and terrain', label: 'Terrain types', help: 'Lays out woodland, grass, rock and water across the map when a world is made.', when: N },
  { key: 'elevationEnabled', group: 'Land and terrain', label: 'Hills and height', help: 'Gives the map hills and valleys; height makes climbing cost more and makes it colder.', when: N },
  { key: 'cavesEnabled', group: 'Land and terrain', label: 'Caves', help: 'Places natural caves on hill edges, which shelter people from the cold.', when: N, requires: ['elevationEnabled'] },
  { key: 'stoneBarrenEnabled', group: 'Land and terrain', label: 'Bare rock', help: 'Rock tiles cannot be grazed, seeded or farmed; their zero plant food is set when a world is made, so turning this off later does not grow food there.', when: L },
  { key: 'pathsEnabled', group: 'Land and terrain', label: 'Worn paths', help: 'Feet wear tiles into paths that are cheaper to walk and that people lean toward.', when: L },
  { key: 'terrainWearEnabled', group: 'Land and terrain', label: 'Terrain wear', help: 'Trampling and grazing roughen ground and strip its cover.', when: L, inert: true },

  // Movement
  { key: 'climbEnabled', group: 'Movement', label: 'Follow the food smell', help: 'People step toward richer food scent instead of only wandering at random.', when: L },
  { key: 'calmMovementEnabled', group: 'Movement', label: 'Calm movement', help: 'People stay and graze on a rich enough tile and do not step straight back without a strong pull.', when: L },
  { key: 'hungerSearchEnabled', group: 'Movement', label: 'Hungry search', help: 'A hungry person on poor ground with no better smell nearby keeps walking the way they were going.', when: L },
  { key: 'farSightEnabled', group: 'Movement', label: 'Far sight', help: 'A searching person can see which nearby block of land holds the most plant food and heads that way.', when: L, requires: ['hungerSearchEnabled'] },
  { key: 'stayValueEnabled', group: 'Movement', label: 'Honest stay check', help: 'Deciding whether to stay counts the food heap underfoot and the real upkeep of the tile.', when: L },
  { key: 'comfortableStayEnabled', group: 'Movement', label: 'Content people stay put', help: 'Someone whose tile passes the stay check resists a leader pulling them away.', when: L },
  { key: 'copyEnabled', group: 'Movement', label: 'Follow a leader', help: 'Every few ticks people look at their neighbours and choose someone to follow.', when: L },
  { key: 'wallCrossingEnabled', group: 'Movement', label: 'Climbing over walls', help: 'Stepping onto a wall costs extra energy and wears it down, so nobody is sealed in and busy crossings open into gaps.', when: L },
  { key: 'jitterEnabled', group: 'Movement', label: 'Persistent wandering', help: 'Wandering keeps its heading with occasional straight dashes; the wiring was taken out because it measured as a no-op.', when: L, inert: true },

  // Food, farming and stores
  { key: 'finiteResourcesEnabled', group: 'Food, farming and stores', label: 'Finite wild resources', help: 'Woodland holds a limited, slowly regrowing stock of wood, open ground carries seasonal berries, and water matters.', when: L },
  { key: 'thirstEnabled', group: 'Food, farming and stores', label: 'Thirst', help: 'People need to drink as well as eat.', when: L, requires: ['finiteResourcesEnabled'] },
  { key: 'stockpilesEnabled', group: 'Food, farming and stores', label: 'Food heaps and granaries', help: 'Well-fed people gather surplus food and drop it where people gather; a big, packed heap becomes a granary floor.', when: L },
  { key: 'storeScentEnabled', group: 'Food, farming and stores', label: 'Heaps smell of food', help: 'Food heaps add to the food scent, so hungry people can find stores.', when: L, requires: ['stockpilesEnabled'] },
  { key: 'storeUnloadEnabled', group: 'Food, farming and stores', label: 'Unload onto heaps', help: 'Carriers also unload food where a heap already lies.', when: L, requires: ['stockpilesEnabled'] },
  { key: 'adjacentStoresEnabled', group: 'Food, farming and stores', label: 'Eat from nearby heaps', help: 'Hungry people also eat from food heaps on the 8 tiles around them.', when: L },
  { key: 'waterCarryEnabled', group: 'Food, farming and stores', label: 'Carried water', help: 'Water is carried from rivers and poured into small stores at camps; a store can be drunk from on its tile or beside it.', when: L, requires: ['finiteResourcesEnabled', 'thirstEnabled', 'stockpilesEnabled'] },
  { key: 'farmingPhysicsEnabled', group: 'Food, farming and stores', label: 'Farming as physics', help: 'Worked soil regrows faster, tired people drop carried seeds, and overgrazed soil wears out.', when: L },
  { key: 'tendingEnabled', group: 'Food, farming and stores', label: 'Tending', help: 'Repeated gentle harvesting improves the soil and speeds regrowth.', when: L, requires: ['farmingPhysicsEnabled'] },
  { key: 'fertilityChangeEnabled', group: 'Food, farming and stores', label: 'Changing fertility', help: 'Soil gets richer with tending, seeds and tamping, and poorer with overuse.', when: L },
  { key: 'goldenCropsEnabled', group: 'Food, farming and stores', label: 'Golden fields', help: 'Well-worked land shows as golden crops as its food nears full; this only changes how it looks.', when: L },
  { key: 'farmingEnabled', group: 'Food, farming and stores', label: 'Farming (old switch)', help: 'An old switch from before farming became physics.', when: L, inert: true },

  // Building and settlements
  { key: 'buildingEnabled', group: 'Building and settlements', label: 'Stone huts', help: 'Well-fed people carry stone from rock to where people gather; enough stone on a tile makes a hut, which erodes unless topped up.', when: L, requires: ['stockpilesEnabled'] },
  { key: 'earthBuildingEnabled', group: 'Building and settlements', label: 'Earth building', help: 'People also dig earth from bare, trodden ground and build with it; earth walls wear faster than stone.', when: L, requires: ['buildingEnabled'] },
  { key: 'nestsEnabled', group: 'Building and settlements', label: 'Brush nests', help: 'People gather brush in woodland and pack it into nests that cut the upkeep of anyone inside.', when: L },
  { key: 'shelterSeekEnabled', group: 'Building and settlements', label: 'Seek huts and nests', help: 'Huts and nests lead cold people to them, like caves and fires do.', when: L },
  { key: 'tileCrowdingEnabled', group: 'Building and settlements', label: 'Shelters get crowded', help: 'A hut or nest shelters only a few people in full; the discount is shared among those on the tile.', when: L },
  { key: 'exposureEnabled', group: 'Building and settlements', label: 'Wind exposure', help: 'Each tile has an exposure to the seasonal wind, and carriers set material down where it best shelters them.', when: L },
  { key: 'exposureRaysEnabled', group: 'Building and settlements', label: 'Indoors', help: 'A tile with walls or a cave close by to the north, south, east and west counts as indoors and is barely exposed.', when: L, requires: ['exposureEnabled'] },
  { key: 'windShadowEnabled', group: 'Building and settlements', label: 'Wind shadow', help: 'A tile with a wall, cave, wood or higher ground just upwind sits in its shadow and is less exposed.', when: L, requires: ['exposureEnabled'] },
  { key: 'directionalBuildEnabled', group: 'Building and settlements', label: 'Build against the wind', help: 'Builders place material on the side that blocks the seasonal wind, and avoid building on worn routes.', when: L, requires: ['buildingEnabled'] },
  { key: 'ritualEnabled', group: 'Building and settlements', label: 'Ritual', help: 'An old placeholder for ritual behaviour.', when: L, inert: true },

  // Conflict and turmoil
  { key: 'touchEnabled', group: 'Conflict and turmoil', label: 'Meetings on a tile', help: 'People who share a tile meet: they may share, clash, mate or pass on illness.', when: L },
  { key: 'cultureTouchEnabled', group: 'Conflict and turmoil', label: 'Culture eases clashes', help: 'People with similar habits tolerate each other; very different habits make a clash more likely.', when: L, requires: ['touchEnabled'] },
  { key: 'resourceClashEnabled', group: 'Conflict and turmoil', label: 'Fights over resources', help: 'Hunger, carried goods and scarce tiles start clashes, and the stakes can be deadly.', when: L },
  { key: 'contestEnabled', group: 'Conflict and turmoil', label: 'Weighed fights', help: 'Each side weighs the food at stake against its odds and the cost of losing; the weaker side may yield unhurt.', when: L },
  { key: 'residenceEnabled', group: 'Conflict and turmoil', label: 'Home advantage', help: 'Someone who has stayed on a tile for a while values it more and defends it harder.', when: L, requires: ['contestEnabled'] },
  { key: 'concedeEnabled', group: 'Conflict and turmoil', label: 'Yielding', help: 'The weaker side of a fight may step away unhurt instead of fighting.', when: L, requires: ['contestEnabled'] },
  { key: 'matchCostEnabled', group: 'Conflict and turmoil', label: 'Even fights hurt more', help: 'A fight with a clear winner does less harm than an even match.', when: L, requires: ['contestEnabled'] },
  { key: 'selfAssessEnabled', group: 'Conflict and turmoil', label: 'Confidence from fights', help: 'Wins raise and losses lower a person\'s belief in their own strength, fading with time.', when: L, requires: ['contestEnabled'] },
  { key: 'clashCourageEnabled', group: 'Conflict and turmoil', label: 'Retreat when outmatched', help: 'A timid fighter facing bad odds runs away, dropping goods and taking a glancing blow; only used when weighed fights are off.', when: L, requiresOff: ['contestEnabled'] },
  { key: 'clashLootEnabled', group: 'Conflict and turmoil', label: 'Looting', help: 'The winner of a clash takes what the loser was carrying.', when: L },
  { key: 'fearEnabled', group: 'Conflict and turmoil', label: 'Fear of places', help: 'Losing a fight or being bitten makes a person afraid of that place, pushing them away; replaced by the place cost.', when: L },
  { key: 'fearWoundsEnabled', group: 'Conflict and turmoil', label: 'Wounds deepen fear', help: 'Wounds make fear push harder, and hunger no longer halves the caution of someone afraid.', when: L, requires: ['fearEnabled'] },
  { key: 'placeCostEnabled', group: 'Conflict and turmoil', label: 'Place cost', help: 'People remember the harm they took in a place and count it as upkeep when deciding to stay there.', when: L },
  { key: 'experienceHabitsEnabled', group: 'Conflict and turmoil', label: 'Habits from experience', help: 'Habits come from one parent each, with rare new ones, and shift a little with hunger and plenty.', when: L },

  // Animals and hunting
  { key: 'herdsEnabled', group: 'Animals and hunting', label: 'Herds', help: 'Grazing animals that drift to richer ground, flee people, breed when fed and die of hunger or age; off stops them at once, but they are only placed when a world is made.', when: L },
  { key: 'herdScentEnabled', group: 'Animals and hunting', label: 'Herds leave a scent', help: 'Herds give off a food scent, so hungry people can track them.', when: L, requires: ['herdsEnabled'] },
  { key: 'huntingEnabled', group: 'Animals and hunting', label: 'Hunting', help: 'People strike at herd animals beside them; a kill leaves meat.', when: L, requires: ['herdsEnabled', 'stockpilesEnabled'] },
  { key: 'huntScalingEnabled', group: 'Animals and hunting', label: 'Strength and weapons in hunts', help: 'Strong hunters and those carrying stone strike more often.', when: L, requires: ['huntingEnabled'] },
  { key: 'huntCarryMeatEnabled', group: 'Animals and hunting', label: 'Carry meat home', help: 'The hunter butchers the kill and carries fresh meat.', when: L, requires: ['huntingEnabled'] },
  { key: 'wolvesEnabled', group: 'Animals and hunting', label: 'Wolves', help: 'Wolves chase and kill herd animals, breed when fed, and may kill a lone person; off stops them at once, but they are only placed when a world is made.', when: L },
  { key: 'wolfDefenseEnabled', group: 'Animals and hunting', label: 'Fight back against wolves', help: 'Brave or strong people strike back at an attacking wolf.', when: L, requires: ['wolvesEnabled'] },
  { key: 'wolfScavengeEnabled', group: 'Animals and hunting', label: 'Wolves scavenge', help: 'Hungry wolves feed on carcass meat lying on the ground.', when: L, requires: ['wolvesEnabled'] },
  { key: 'wolfScentTrackEnabled', group: 'Animals and hunting', label: 'Wolves track by scent', help: 'Wolves follow prey scent trails when no herd is in sight.', when: L, requires: ['wolvesEnabled'] },
  { key: 'fireDetersWolvesEnabled', group: 'Animals and hunting', label: 'Fire keeps wolves off', help: 'Wolves do not enter tiles warmed by a fire.', when: L, requires: ['wolvesEnabled', 'firesEnabled'] },

  // Body and health
  { key: 'bodyDrivesEnabled', group: 'Body and health', label: 'Hunger drives', help: 'A starving person follows food harder, cares less about danger and curiosity, and ignores leaders more.', when: L },
  { key: 'stagesEnabled', group: 'Body and health', label: 'Life stages', help: 'Children and elders do less work, carry less and fight weaker than adults.', when: L },
  { key: 'strengthScalingEnabled', group: 'Body and health', label: 'Strength matters', help: 'A person\'s strength gene changes how much they carry and how hard they work.', when: L },
  { key: 'childcareEnabled', group: 'Body and health', label: 'Childcare', help: 'A young child costs its mother energy while she is near, shared with a mate beside them.', when: L },
  { key: 'fatigueEnabled', group: 'Body and health', label: 'Fatigue', help: 'Walking tires people and standing still rests them; tired people pay more upkeep and lose steps.', when: L },
  { key: 'diseaseEnabled', group: 'Body and health', label: 'Disease', help: 'Illness spreads by touch, costs extra upkeep, and passes after a while, sooner when fed.', when: L },
  { key: 'injuryEnabled', group: 'Body and health', label: 'Wounds', help: 'Fights and wolf bites wound; the wounded pay more upkeep, move slower, and heal only when fed.', when: L },
  { key: 'slowHealEnabled', group: 'Body and health', label: 'Slow healing', help: 'Wounds also heal when hungry, just more slowly, and faster in shelter.', when: L, requires: ['injuryEnabled'] },
  { key: 'birthHazardsEnabled', group: 'Body and health', label: 'Childbirth hazards', help: 'Pregnancy costs extra energy, starvation can end it, and giving birth wounds the mother, less so in shelter.', when: L },

  // Weather and seasons
  { key: 'seasonsEnabled', group: 'Weather and seasons', label: 'Seasons', help: 'Plants regrow fast in summer and slowly in winter.', when: L },
  { key: 'coldEnabled', group: 'Weather and seasons', label: 'Cold', help: 'Winter and height make it cold, and a person without shelter pays extra upkeep.', when: L },
  { key: 'firesEnabled', group: 'Weather and seasons', label: 'Campfires', help: 'A cold person resting on a brush heap lights it; the fire warms the tiles around it while it burns.', when: L, requires: ['coldEnabled', 'nestsEnabled'] },
  { key: 'weatherEnabled', group: 'Weather and seasons', label: 'Weather and soil moisture', help: 'Climate from the map, rain and drying winds set how wet each tile\'s soil is, which changes how well plants grow.', when: L },

  // Observers and camera
  { key: 'chronicleEnabled', group: 'Observers and camera', label: 'Chronicle', help: 'Writes notable events into the chronicle; it only watches and does not change the world.', when: L },
  { key: 'bandTrackEnabled', group: 'Observers and camera', label: 'Track bands', help: 'Finds and names groups of people who move together; it only watches.', when: L },
  { key: 'settlementTrackEnabled', group: 'Observers and camera', label: 'Track settlements', help: 'Names and ranks clusters of built tiles; it only watches.', when: L },
  { key: 'hearthAnchorEnabled', group: 'Observers and camera', label: 'Walls count as settled', help: 'The settlement tracker counts strong walls as built, beside fires, nests, granaries and huts.', when: L, requires: ['settlementTrackEnabled'] },
  { key: 'autoCameraEnabled', group: 'Observers and camera', label: 'Auto camera', help: 'Meant to steer the camera to busy bands; the viewer does not read it at the moment.', when: L, inert: true },
] as const satisfies readonly FeatureSwitch[];

/** Compile-time check: every `*Enabled` key of SimulationConfig, optional ones too, has an entry. */
type MissingSwitch = Exclude<FeatureKey, (typeof TABLE)[number]['key']>;
const everySwitchListed: [MissingSwitch] extends [never] ? true : MissingSwitch = true;
void everySwitchListed;

export const FEATURE_SWITCHES: readonly FeatureSwitch[] = TABLE;

export const FEATURE_BY_KEY: ReadonlyMap<FeatureKey, FeatureSwitch> = new Map(FEATURE_SWITCHES.map((f) => [f.key, f]));

/** Keys of `config` that end in `Enabled`, found at runtime. */
export function enabledKeysOf(config: object): string[] {
  return Object.keys(config).filter((k) => k.endsWith('Enabled'));
}

/**
 * Why a switch does nothing right now, given the values it would run with, or null if nothing blocks it.
 * Walks the requirements recursively, so a switch whose parent is itself blocked is blocked too.
 */
export function blockedBy(key: FeatureKey, valueOf: (k: FeatureKey) => boolean, seen = new Set<FeatureKey>()): string | null {
  const f = FEATURE_BY_KEY.get(key);
  if (!f || seen.has(key)) return null;
  seen.add(key);
  for (const r of f.requires ?? []) {
    if (!valueOf(r) || blockedBy(r, valueOf, seen) !== null) return `needs ${FEATURE_BY_KEY.get(r)?.label ?? r}`;
  }
  for (const r of f.requiresOff ?? []) {
    if (valueOf(r)) return `only when ${FEATURE_BY_KEY.get(r)?.label ?? r} is off`;
  }
  return null;
}
