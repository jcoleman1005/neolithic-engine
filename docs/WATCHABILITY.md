# Watchability plan: ideas 1, 2, 4 and 5

Written 2026-11-13 at the user's request, after watchability #3 (activity poses and pops) and the GBA palette were merged to `main` (c725b1d). This is a plan, not a decision. Nothing here is built. Each W stage below needs the user's go-ahead, a row on the work board, and an entry in `docs/decisions.md` (rule 12) before code.

The ideas were first recorded in `docs/decisions.md` (2026-11-12) and the Parking lot of `docs/ROADMAP.md`.

## Why the world is dull to watch

- **Everything good is at the water.** Riparian ground is more fertile, fish are caught from the shore, and thirst pulls everyone back about every 100 ticks (hydration falls 0.4 a tick and people seek water below 60).
- **There's no reason to travel.** Open land stays nearly full (`landRegrowthRate` 0.05, logistic), so the S1 stay check passes almost everywhere and a forager steps one tile and stops.
- **Grazing is the whole diet.** Grass grazing supplies over 90% of meals. Berries are 0.6% and fish 1.1% (`exp-patchy-food`, 2026-11-10), so making berries patchy changed nothing. Anything meant to move people must act on grazing.
- **A global hard winter halves the population** and nobody stores more (`exp-winter`, 2026-11-10). Scarcity has to be uneven in space, not just in time, or it only kills.
- **Herds are loners.** Each animal grabs the best neighbouring tile and flees people (`herds.ts`). Nothing holds a herd together or moves it far.
- **Hunting is a dice roll** against an animal already on or beside the hunter's tile (`life.ts`, the forage loop). Nobody chases.
- **Building materials are local.** Stone lies on every rock tile above the rock level (30 each), earth is dug from any trodden tile, and brush comes from any wooded tile.

## Shared step W0: a watch probe (do this first)

`scripts/watch-probe.ts`, read only, like `surplus-probe.ts`. It gives each idea a baseline and its targets:

- **Movement:** mean steps per adult per year, and mean net displacement per adult per year.
- **Distance from water:** the share of adults within 2 tiles of fresh water (`waterDist`), sampled every 30 ticks.
- **Activity mix:** the share of person-ticks per activity, read from the 3a activity byte.
- **Events per year:** kills, births, fires lit, huts finished.
- **Bands:** chronicle migrations per 10 years, and mean band displacement per year.
- **The usual health lines:** population, hunger and die-outs.

Seeds 1 to 3 (5 where the effect is small), 30 years, default config. Write the baseline into `docs/findings.md` before any W stage runs (rule 10: directional hypotheses with effect sizes across seeds, not cutoffs).

## W1: land that ripens by place and season (idea 1)

**Goal:** an annual round. Different ground is at its best at different times of year, so bands have a reason to move, and grazed ground stays bare for a while.

**Visible consequence:**
- A wave of lush colour moves across the map through the year: lowlands and the south first, uplands later.
- Bands walk towards it.
- Bare, grazed halos form around where they have just been.

**Mechanism** (land only, no people rules; rule 4):
- **Ripening phase:** each land tile gets a fixed phase in the year, worked out once when the world is built from elevation (higher ripens later) and latitude (the y band ripens later going north). It's computed from terrain with no random draw, so a loaded save rebuilds it and nothing new is saved.
- **Seasonal capacity:** a tile's food capacity follows its own season. Near its peak (a window of about 60 to 90 ticks) it can hold up to `ripenPeak` times today's cap. Away from it, standing food withers towards an off-season floor. This is the `exp-winter` die-off, but staggered by place, so the land's mean yearly capacity stays about where it is today (target: within ±10%). The hard winter halved the population because it hit everywhere at once; spreading it out keeps total food steady.
- **Slower regrowth:** a lower `landRegrowthRate` while ripening is on, so a grazed tile stays visibly bare for weeks.
- **With weather on (6b-1):** soil moisture brings a tile's peak forward and makes it stronger. It's optional, so W1 doesn't depend on weather, which is off by default.
- **Fields:** golden fields ripen with the same calendar. That answers the `exp-winter` finding that ripeness needs a season.

**How people respond:** through the rules they already have.
- The stay check fails on withered ground.
- `farSightEnabled` looks at the neighbouring 16 × 16-tile blocks for richer land.
- Hunger-search keeps them heading the same way.
- One possible addition, only if runs show bands can't find the wave: let far sight look two blocks out when the contrast is large. That's still a per-person rule, not a group rule.

**New state and files:**
- `land.ts`: a `ripenPhase` Uint8Array, derived and not saved; capacity and wither inside the existing `step` loop, with a 360-entry curve table so there's no per-tile trigonometry.
- `seasons.ts`: the curve.
- `config.ts`: `ripeningEnabled`, `ripenWindow`, `ripenPeak`, `ripenFloor`, `ripenElevationLag`, `ripenLatitudeLag`.
- Tests: mean capacity over a year, determinism and the save round trip.

**Viewer:** ripeness needs no new channel. The viewer can compute it from the terrain it already has plus the season, so it costs nothing on the wire.
- A "lush" tint on ripe grass, kept clearly apart from the crop gold.
- Withered grass uses the 6b-1 straw tint.
- Two legend lines.

**Measure (W0 probe):**
- Steps per adult per year: expect clearly up.
- Share of adults within 2 tiles of water: expect down.
- Chronicle migrations: expect up.
- Population within about 15% of base at years 30 and 50, with no die-outs across seeds.

**Risks:**
- **Population crash** if bands can't reach the ripe ground. Watch hunger outside camps, and start mild (`ripenPeak` 1.4, wide window).
- **Thirst still anchors camps** to the bank, so ripe ground far from water is only visited, not lived on. That's acceptable for W1; W3's wells address it.
- **Speed:** one table lookup per tile per tick inside a loop that already runs. Expect well under 0.5 µs per person per tick; measure it.

**Open questions:**
- How strong should the seasons be?
- Should berries keep their own season or follow the ripening phase?
- Should fields ripen too, or stay as they are?

**Size:** medium.

## W2: migrating herds and pursuit hunts (idea 2)

**Goal:** animals moving as herds across the map, and hunts you can follow from the chase to the carry home.

**Visible consequence:**
- Columns of deer drifting with the lush season.
- Hunters strung out behind them.
- A kill far from water (the 3b meat pop), then someone walking home with a food load.

**Mechanism** (each animal and each person follows its own rule):
- **Herd cohesion:** each animal leans towards the mean position of herd mates within `herdFlockRadius`, a boids-style individual rule, so loose groups form.
- **Herd travel:**
  - Each animal keeps a heading (persistence) and every so often picks the richest neighbouring 16 × 16 block, using the existing `blockFood` map.
  - With W1 on, herds follow the ripening wave. Without it, they mostly circle.
  - Wolves follow herds already (`wolfScentTrackEnabled`).
- **Pursuit hunt:**
  - **Committing:** a hungry person (below `huntBelow`) who senses prey scent or an animal within `huntSenseRadius` (about 5) commits to that animal, saving its slot and generation.
  - **The chase:** while committed, they step towards it, like the thirst rule's priority step in `Rules.climb`. Each step costs extra energy (`huntSprintCost`) and raises fatigue, and the animal flees as it does today.
  - **The end:** next to the animal they get the strike roll. They give up after `huntGiveUpTicks`, when tired, or when the target dies.
  - **Afterwards:** a kill drops meat, and `huntCarryMeatEnabled` already carries some home.
  - **Group hunts:** several hunters chasing the same animal is just several individual choices, so it's allowed under rule 4.
- **Today's adjacent roll stays** as the fallback when pursuit is off.

**New state and files:**
- `herds.ts`: a per-animal `heading` (saved).
- `people.ts`: `huntTarget` (Uint32) and `huntTicks` (Uint8), added to `PERSON_FIELDS` with a `SAVE_SCHEMA` bump.
- `rules.ts`: the chase step. `life.ts`: the strike, now able to hit a committed target that has moved next to the hunter.
- `config.ts`: `herdFlockEnabled`, `herdMigrationEnabled`, `pursuitHuntEnabled` and their numbers.
- The activity byte gets a chase code, so a running hunter shows the spear pose while moving.

**Viewer:**
- A running-with-spear frame (walk legs plus the raised arm).
- Herds are already interpolated, so columns read naturally.

**Measure:**
- Mean kill distance from water: up.
- Meat share of meals: up from today, which W0 measures.
- Herd displacement per year: up.
- Herd and wolf populations survive 50 years on every seed. That's the hard condition, because pursuit is far more effective than today's roll.

**Risks:**
- **Overhunting:** start with a low strike chance during pursuit and a real sprint cost.
- **Speed:** the prey search runs only for hungry, uncommitted people, staggered like `copy`, over the herd cell index within radius 5.
- **Save schema bump:** old saves are refused by design (`SAVE_SCHEMA`).

**Open questions:**
- Should wolves and people compete for the same kill (meat left on a carcass)?
- Should a stone in hand still give the strike bonus?

**Size:** medium to large. Best after W1.

## W3: materials away from water, and wells (idea 4)

**Goal:**
- Trips out of camp for good materials, wearing paths that radiate from settlements.
- Camps that can sit away from the river.

**Visible consequence:**
- Tan trails running from camps out to the hills.
- Grey and black flint loads being carried home.
- A well (a new sprite) with a camp around it, far from any river.

**Mechanism:**
- **Flint outcrops:** a small share of rock tiles (about 5 to 10%, from a terrain hash on ridgelines) hold flint instead of plain stone.
  - Flint builds stronger (`flintBuildGain`), and only flint in hand gives the hunting bonus.
  - Plain rock still gives rubble, at a lower gain.
  - People already pick up stone when fed and standing on rock (`quarry`). The new part is that flint is worth more, and the stay and climb rules already reward heading for it when the hand is empty and energy is high.
  - If they don't seek it, the fix is a scent: outcrops emit a weak "material" scent the way food does, read only by fed people with empty hands.
- **Wells:**
  - **Where:** on low ground where water is near the surface (a few tiles of elevation above the nearest fresh water and within `wellMaxDist`).
  - **Digging:** a well-fed person resting in a crowd far from water (`waterDist` ≥ `wellMinWaterDist`) digs. Each dig adds `wellWork` and costs energy, the same pattern as earth building.
  - **Finished:** at `wellWork` ≥ `wellDone` the tile becomes a fresh-water source with a limited flow that refills slowly, joining `drinkDist` like a water store.
  - This is the Parking-lot "wells" idea, and it's the most direct answer to camps hugging the water.

**New state and files:**
- `land.ts`: a `flint` amount per tile, `wellWork` and `well` (saved in the land state, with a `SAVE_SCHEMA` bump), and wells added to the drink sources so `refreshDrink` marks the distance map dirty.
- `life.ts`: digging, and the flint pick-up and set-down.
- `config.ts`: `flintEnabled`, `wellsEnabled` and their numbers.
- `protocol.ts` and the ground channel: a well bit and a flint carry kind. `CARRY_*` has a free value up to 7.

**Viewer:**
- A well sprite: a stone ring with dark water.
- A flint load colour.
- Flint outcrops drawn as dark glints on rock.

**Measure:**
- Share of settlements (observer) centred 5 or more tiles from water: up.
- Mean distance stone is carried: up.
- Path wear outside settlements: up.
- Thirst deaths: no worse.

**Risks:**
- **Wells everywhere** would make thirst trivial. Limit the flow, require low ground, and require labour.
- **Paths:** S2 paths reinforce themselves, which is what we want here. Check they don't lock everyone onto one road.
- **Speed:** the distance map refresh already runs on a dirty flag, and well completions are rare.

**Open questions:**
- Clay beside water as a third material, or keep it to two?
- Should a well run dry in a drought year when weather is on?

**Size:** medium. Wells are independent of W1 and W2 and could go first if leaving the bank matters most.

## W4: floods and fire that move camps (idea 5)

**Goal:** dramatic events that change where people live for a season.
- Floods push riverside camps uphill and back.
- Fire burns dry grass, and the regrowth draws herds and hunters.

**Visible consequence:**
- Water spreading over the low bank in a wet season, and camps moving up the slope and returning when it drains.
- Black scorch scars that turn bright green, with herds on them.

**Mechanism:** this is roadmap stages 6b-3 and 6b-2. Weather patterns may be scripted, but their consequences on people must be physical (decision of 2026-11-10).
- **Floods (6b-3, `floodsEnabled`):**
  - **Rising:** each spring, and harder in wet years, high-`riparian` land beside fresh water floods for a stretch of ticks (a `flood` timer; `isWater` stays as it is).
  - **Effects:** flooded tiles cost movement, drown standing food, wash away heaps and wear built tiles.
  - **Aftermath:** silt raises fertility after the water goes.
  - **How people respond:** the stay check and movement costs push them off flooded ground.
  - **Without weather:** a mild yearly pulse still happens with `weatherEnabled` off, so floods don't need weather on.
- **Fire (6b-2, `wildfireEnabled`):** revive the parked branch `phase-6b-wildfire`.
  - **What exists there:** about 220 lines in the sim, off by default. It has lightning from storms, spread through dry fuel downwind, burn costs, a scorch timer, an ash fertility gain, and rain putting fires out.
  - **What's missing:** the viewer layer and measurement.
  - **Ash and herds:** ash regrowth gives W2's herds a reason to gather.
  - **Needs weather:** lightning comes from storms, so fire needs `weatherEnabled`. The open question is whether to switch weather on by default.
- **Chronicle (6b-4):** flood, fire and drought detectors, observer only.

**New state and files:**
- `land.ts`: `flood` and `scorch` (saved).
- `weather.ts`: the flood pulse.
- `life.ts`: costs.
- `ledger.ts`: a `burn` line, already on the wildfire branch.
- `config.ts`: the two switches.
- Viewer: the reserved bits 2 to 7 of the `landWeather` channel carry flooded and scorched. No new channel.

**Viewer:**
- Flooded ground as shallow-water tiles over grass, with a ripple.
- Scorch in black and grey that greens over time.
- Smoke from live fires.
- Legend lines.

**Measure:**
- Each event happens in a typical run and leaves marks (the 6b check).
- Camps beside water move uphill during floods and come back afterwards: settlement centre elevation, before against during against after.
- Herds on burned ground within a season.
- No die-outs.

**Risks:**
- **Fire burning everything:** fuel and wind limits exist on the branch but haven't been measured.
- **Floods drowning food:** that's a famine lever, so keep pulses short.
- **Weather is off by default:** turning it on changes the default world, so the fingerprint and baselines change. That's a user decision.

**Open questions:**
- Turn weather on by default?
- Should people die in floods, or only pay costs? The draft says costs only.

**Size:** large. Best last, since it builds on W1 (ripening against flood timing) and W2 (herds on ash).

## Suggested order

1. **W0 probe:** small. It gives baselines for everything else.
2. **W1 ripening:** the root cause, a reason to move.
3. **W3 wells and flint:** lets camps follow ripe land away from the bank. It can swap with W2 if leaving the water matters more than herds.
4. **W2 herds and hunts:** herds follow the W1 wave.
5. **W4 floods and fire:** needs the weather decision.

**Every W stage follows the usual rules:**
- Its own switch (rule 9) and its own branch.
- Targets written in `docs/findings.md` before runs.
- `npm run perf` at 10,000 people (budget 15 µs; today about 4.2 on this machine).
- Unchanged default fingerprints while its switch is off.
- Closing only after the user watches it on the phone (rule 13).
