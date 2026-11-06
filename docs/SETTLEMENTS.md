# Settlements, villages and cities

## Context

You want settlements to grow into villages and eventually cities, and to read on the map the way they do in RimWorld, Songs of Syx and Dwarf Fortress.

Those games get settlements from a player or a script, which rule 4 bans here. So we copy how they **show** a settlement, and get the settlement itself from land, bodies, costs and local habits.

**Why villages don't form today:**
- Settling already has real benefits, but people's decisions mostly ignore them. `Rules.climb` (`src/sim/rules.ts:147`) decides to stay by looking only at the plants on the tile, not at heaps or shelter.
- Only plants give off food scent (`src/sim/life.ts:57-67`), so stored food can't be found from even a tile away.
- Any pull from a distant leader cancels staying, so bands drag everyone along, even people who are fed and sheltered.
- Carriers set goods down wherever a crowd is standing (`src/sim/life.ts:438-469`), not at a fixed place.
- Huts erode unless topped up (`Land.erode`), so they vanish once the crowd moves on.

**Decisions you made:**
- Physics plus local habits: no planner, no scripted upgrades. Building habits spread by imitation.
- Art follows `docs/art-style-planimetric.md`: flat top-down ground and unroofed floor-plan walls at every zoom, low-profile oblique figures. Lifting roofs are dropped.
- Sim work from `docs/primitives.md` follows this plan rather than running alongside it. Spoilage, tending and 5e move into S4. Primitive 54 (home anchor) is not to be built.
- Keep 256 x 256. A city is about 1,000 to 5,000 people. With tile-thick walls, 5,000 people need about 3,000 to 4,000 tiles (about 5% of the map), so only a few cities fit. A larger map stays in the Parking lot.

**The honest risk:** rule 10 means no test can promise a city will appear. Each stage names something visible and closes when someone has watched it (rule 13). If cities don't appear, we change land, costs or habits, not add a script.

## What we borrow

| From | We take | We don't take |
|---|---|---|
| Dwarf Fortress | Far zoom as a world map: site icons, names, recorded site histories | Abstract history generation, scripted sites |
| Songs of Syx | Middle zoom: roads and dense building footprints read as a texture; crowds stay visible | Player zoning |
| RimWorld, Odd Realm | Walls, floors, hearths and people in open rooms, as in the art spec | Blueprints, assigned jobs, mood system |

## Build stages

**Current stage:** T0 to S2 merged. S3-pre and the S3a layout test built on `settlements-s3`; walls form along shores because people can only drink there, so S3w (carried water) is planned next, then S3a is re-run. See `docs/STATUS.md`.

One branch per stage, starting with `phase-5h-settlements` off the **latest** `main`, not `phase-5f-structures`, which is 7 commits behind. Line numbers below are from before those commits, so find code by name. New mechanics get a switch in `src/sim/config.ts`, are saved and hashed, and are tested for mechanisms only.

| Stage | Adds | You should see on the map |
|---|---|---|
| **T0 Tools** | Headless map images, fingerprint with switches, clearer test failures, browser capture | Nothing in the game; the agent can now see its own work |
| **S0 Detect and label** | Observer only: finds clusters of built cells, names and ranks them | Today's camps get names and icons, showing the baseline |
| **S1 Staying pays** | People's decisions count the real benefits of stores, shelter and safety, using existing systems and no new scent or home value | Camps stay put for years with heaps piling up, while some people still roam |
| **S2 Paths** | Path wear lowers step cost; people prefer worn ground | Trails linking camps, water, fields and quarries |
| **S3 Exposure and walls** | Continuous exposure field; wind; material dropped on the most exposed side; walls cost energy to cross; copied building habits | Windbreaks, cliff lean-tos, rings around fires with gaps where people walk, drawn as floor-plan walls |
| **S4 Surplus** | 5e golden crops; spoilage and tending (primitives 5, 9, 41); farm yield and population tuning | Golden fields ringing camps; camps feed more people |
| **S5 Village economy** | Skill from practice; eating and sharing from stores | Non-farmers living off shared stores; recognisable villages |
| **S6 Towns and cities** | Crowding costs that limit and split settlements; stone stores | Dense towns, daughter villages along roads |

Phase 7 walls and Phase 8 polities then build on this unchanged.

**How far this plan specifies the work:** T0 to S3 are ready to build. S4 to S6 are direction only. Plan each after seeing the previous stage's results, and don't build them from the table above.

## Rules for the implementing agent

- **One stage per session, then stop.** Stop points: after T0, S0, S1, S2, S3a and S3. A person watches or reviews before the next stage starts (rule 13). The agent never closes a stage itself.
- **Tuning has a limit.** Before running, write the targets in `docs/findings.md`. Stop at the first set that passes. After 8 tuning rounds on a stage, stop and report what was tried. Don't move the targets to pass, and don't add new mechanics to pass.
- **A target missed is a valid result.** Report it plainly. The gates below are reported from runs, never written as tests (rule 10).
- **When an old test fails,** decide whether the mechanism intentionally changed. If it did, make the test check the new rule as tightly as before, and say so. Never loosen a test just to pass, and never skip one.
- **Compare all on, all off and one off at a time** for a stage's switches, not every combination.
- **Long runs:** verify takes 8 to 12 minutes and can fail under load, so run it in the background with nothing heavy alongside. While iterating, run only the relevant test files. Use `--xEnabled false`, not `0`, and type flags out, because zsh doesn't split an unquoted variable.
- **Saves:** new mechanics may need a fresh world. Old saves must still load with new arrays zeroed, but no migration of old huts is needed. Never touch the default `data/` folder.

## Traps found in the code

Each of these would break something if built the obvious way:

| Stage | Trap | Do this |
|---|---|---|
| All | New arrays added to `World.stateHash()` change the fingerprint even with the switch off, as `fatigue` and `sick` do, so an off-parity check can never pass | Hash new state only when its switch is on, and draw no random numbers when off |
| All | `scripts/fingerprint.ts` takes no switches and runs only 1,000 ticks, before most building happens | T0 adds overrides and a ticks argument; parity checks use at least 5 years |
| S0, S2 | New frame data must pass through `host.ts`, `protocol.ts` and `simulation-client.ts` | Send it with `landOverlay` under `overlayDue` in `host.ts`, not every frame |
| S0 | Camps flicker, so announcing each one floods a chronicle that targets 10 to 30 entries an hour | Announce only hamlet and above, after they have lasted; keep camps silent |
| S0 | S3 changes what counts as built, and wall cells inflate counts | One `isBuilt(cell)` function; retune tier thresholds after S3 |
| S1 | Upkeep runs before `spatial.build` (`src/sim/life.ts:264`), so a tile headcount there is stale, or empty after a load, which breaks the save round trip | Apply crowding after that build, or build earlier when the switch is on |
| S1 | `sheltered` makes people stay, but `warmDist` only leads to fires and caves, so cold people can never walk to a hut or nest | Add huts and nests as sources (S1g) |
| S1 | `refreshWarmth` searches the whole map and allocates when `warmDirty`; frequent building would run it constantly | Refresh at most every 30 ticks with a reused typed queue |
| S1 | Lowering the stay threshold can hold a starving person on a tile with nothing to eat, because grazing stops at `landGrazingFloor` | A hungry person stays only if food above the floor or a heap is actually on the tile |
| S1 | The stay check requires `capacityAt > 0`, so people always leave rock tiles, including huts built there | Count heaps and shelter even when capacity is 0 |
| S1 | Fed people also climb food scent, and big heaps may swamp the field up to its 255 limit | Scale heap emission separately and check it doesn't erase the pull of plants |
| S3 | Brush as a barrier is also fire fuel: `ignite` will burn a brush wall that holds enough | Accept this for now, as a visible hazard; note it in findings |
| S3 | `exposure` updated in slices depends on history, so recomputing it after a load breaks the round trip | Save and hash it |
| S3 | `src/render/walls.ts` in the art scaffold expects discrete wall cells, and the spec mentions doors and beds, but S3 only has continuous `durability` and gaps | The viewer thresholds `durability` into wall cells, and draws gaps as gaps. No door or bed objects |
| All | `tests/drives-and-stages.test.ts` pins the pre-drives hash, so every new default-on switch breaks it | Add the new switch, off, to that test's config, as S1 and S2 did |
| S3e | `habitDistance` divides by `HABIT_COUNT`, so a new habit changes culture distance and therefore clash rates; 52 references use the constant | Keep building habits out of `habitDistance`, or use a separate array |

### T0 Tools (first build)
The agent can't currently see the map: the repo has no browser tooling, and a plain Firefox screenshot only caught the page before the world loaded.
- **`scripts/map-dump.ts`:** no dependencies. Runs a seed to year N with switch overrides and writes a PNG with Node's `zlib`, showing terrain, built cells, heaps, people density and (later) wear. Also prints the gate numbers. S1 and S3a rely on this.
- **`scripts/fingerprint.ts`:** accepts overrides and a tick count.
- **`scripts/verify.sh`:** keeps full test output in a file and prints failing test names, which are currently lost when output is cut.
- **Real-renderer capture:** a throwaway Playwright install outside the repo, loading a world saved at year N into a scratch `--data` folder, then capturing at several zooms and 360 px. If the browser download is blocked, stop and ask; don't add it to `package.json`.
- Extend `scripts/sweep.ts`, which today only knows `farming` and `stockpiles`, when a stage needs to tune.

### S0 Settlement observer
- New `src/sim/settlements.ts`, modelled on `BandTracker` in `src/sim/bands.ts`. Rule 11: reads only, no random numbers.
- Runs every 30 days or so, not per tick. Groups built cells (huts, nests, granaries, hearths) with a wrap-aware flood fill and a small gap allowance. Keeps IDs stable by overlap with the last scan.
- Names use `placeRoot`, `landformFor` and `placeName` from `src/core/naming.ts`, with the tongue of the band most present at founding. Records are saved so names stay stable after a load.
- Reuse `BandTracker`'s wrap-aware centroid. Caves and natural features don't count as built.
- Founded and abandoned entries go in `src/sim/chronicle.ts`, which the roadmap's frozen-chronicle rule allows for settlements.

Starting tiers, all in config and only ever labels; the sim never reads them:

| Tier | Built cells | Residents | Lasted |
|---|---|---|---|
| Camp | 3+ | 5+ | any |
| Hamlet | 10+ | 20+ | 5 years |
| Village | 30+ | 80+ | 10 years |
| Town | 120+ | 400+ | 20 years |
| City | 300+ | 1,000+ | 30 years |

Residents means people standing in or near the cluster, averaged over recent scans so a passing band doesn't count. No one has a stored home.

### S1 Staying pays
No new scent and no stored home. People stay when the place is physically better for them, judged from what is on and around their tile.

**S1a Measure first.** A read-only headless probe on 3 seeds compares people near stores and shelter with people away from them: energy balance, survival, births, wolf and clash deaths, and wounds. This shows which benefits are too small, and the results go in `docs/findings.md`. Wounds get a specific check: 68% of people were seriously wounded on seed 1 at year 4, and settling means more contact. If wounds outweigh the benefits of staying, tune clashes before S1d.

**S1b Crowding.** Switch `tileCrowdingEnabled`, starting capacity 4 people per hut and 3 per nest. Today nothing limits a tile, and everyone on it gets the full benefit, so one hut can shelter 50 people. Upkeep discounts from huts and nests are shared among those on the tile, using the existing headcount (`spatial.cellStarts`), with the capacity in config. Fires stay exempt. S3's exposure shelter follows the same rule, so more people means more shelter gets built, and settlements spread out instead of stacking.

**S1c Stores can be found.** Food heaps add to the existing food scent in the emit loop at `src/sim/life.ts:57-67`. Switch `storeScentEnabled`. Carriers already climb food scent, and they also unload where a heap already lies (`src/sim/life.ts:465-469`), not only at a crowd of `dropCrowd`.

**S1d The stay decision counts what the place offers.** Switch `stayValueEnabled`. Build on the new hunger drive in `Rules.climb` (`bodyDrivesEnabled`), which already raises food weight and lowers leader pull when hungry. In the calm-movement check:
- Food on the tile includes the heap, not just plants.
- The food a person needs scales with their actual upkeep there, after crowding, so an uncrowded hut at `hutUpkeep` 0.5 halves it. This reuses the real cost with no new weights.
- High `HABIT_ROAMING` and curiosity raise it, so natural wanderers leave sooner. Hunger already raises it through `hungerStayPenalty`.

**S1e Leaders pull less on the comfortable.** Switch `comfortableStayEnabled`. Hunger already scales leader pull through `leaderPullMul`, but any pull still sets `leaderPulling`, which cancels the stay check. Someone whose tile passes that check now resists it. Compare band counts and sizes with it off, because this can weaken band cohesion from Phase 3.

**S1f Real safety.** Raise `wolfLoneRadius` from 0 to 2 so people close by protect each other, and log it per rule 5. Wolves avoid `fireNear` cells, with switch `fireDetersWolvesEnabled`.

**S1g Cold people can find shelter.** Huts and nests become `warmDist` sources in `Land.refreshWarmth`, using the refresh limit from the traps table.

**S1 gates, starting values, 3 seeds at 30 years against all switches off:**
- No seed dies out, and population is at least 85% of off at year 20.
- At least 3 camps on each seed last 10 years or more, and median camp lifetime is at least twice off.
- At least 10% of adults are outside any camp at year 20, so wanderers still exist.
- Perf within budget, also at 2,000 to 3,000 people.

**Replaced gates, agreed 2026-11-05; these win over the first two gates above.** S0's baseline shows two of them are too easy: with everything as it is today, 13, 22 and 14 settlements on seeds 1 to 3 have already reached 10 years, and doubling a 0.3-year median means only 0.6 years. Instead, at year 30 against off: settlements that have lasted 10 years at least double; at least 3 hamlets or larger standing on each seed (off has 0, 1 and 0). The population, wanderers and perf gates stay.

**If camps still don't last:** look next at walking cost, which is cheap today (`moveCost` 0.05 against `metabolismCost` 0.25), and at farming yield, S4's job. Changing `moveCost` affects everything, so it's a last resort and gets its own comparison.

**Risks:** food scent fades within 2 to 3 tiles, so foragers may not find their way back, and new arrivals may keep a camp going rather than the same people. That still reads as a camp on the map, so it's acceptable. Heap scent may also pack people onto too few tiles, which S6's crowding costs answer. Those costs move up if it happens early.

### S2 Path wear (primitive 14)
- `Uint8Array` wear on `Land`, raised per step and decayed with the rotating-slice pattern from `Land.erode`.
- High wear lowers step cost, and `climb` lightly prefers worn neighbours, which reinforces routes.
- Sent as a new versioned channel like `landOverlayVersion`, because the overlay byte is full (`Land.packOverlay`).

### S3 Exposure and walls
This answers the roadmap's closed-rooms question: no room detector and no wall tag. Rooms are simply places where exposure is low. Built in this order, stopping to review after each step:

**S3w Carried water (planned 2026-11-05; build before S3b).** Why: on seed 3 with the layout test on, half of everyone standing still is on a tile next to fresh water and 88% are within 3 tiles, while 65% of the land is 7 or more tiles from water and holds 3% of resting people and 5% of walls. People can only drink beside a river or lake, so settlements can only grow as ribbons along shores.

*Approach:* water becomes an ordinary hand-carried item (one thing at a time, like food), poured into a small store on a tile at camp. Not a personal waterskin: that would break the one-carry rule and hand everyone a container at year 0. A skin made from hunted hides could come later.

*Mechanics* (switch `waterCarryEnabled`; every number in config):
- **Fetch:** a well-fed, well-watered person with empty hands, standing beside fresh river or lake water, fills up to `waterCarryMax`. Food hoarding comes first, so hands full of food stay full.
- **Spill:** carried water loses `waterSpill` per step, so only short hauls pay.
- **Drink on the way:** a thirsty carrier drinks from what they carry before walking to water, so carriers can range inland.
- **Pour:** a resting carrier pours into the tile's store (`Land.waterStore`, capped at `waterStoreCap`) where at least `dropCrowd` people rest or a store already stands, never right beside natural water.
- **Evaporate:** stores lose `waterEvaporation` a tick, more in warm seasons, and much less on built or low-exposure tiles (a covered jar). That gives a physical reason to build at camps.
- **Drink from stores:** someone thirsty on a store tile drinks from it at up to `drinkRate`, and the store goes down.
- **Find water:** thirsty people head for the nearest drinkable water, which now includes stores above `waterStoreFindMin`.

*Foundational changes:*
1. **Two water distance fields:** `riverDist` (natural fresh water, used for fetching, fish and thirst-off parity) and `drinkDist` (rivers plus stores), rebuilt when a store crosses the find threshold. It is a pure function of the current state, rebuilt before any read in a tick, so a loaded save matches. It uses a reused typed queue, since `initWater` allocates a neighbour array per cell today. With the switch off, `drinkDist` is `riverDist`.
2. **`CARRY_WATER`** through carry caps (body-scaled), carry drag, spill, the inspector and the save.
3. **A carry byte in the person frame:** each person goes from 10 to 11 bytes, holding the carried kind (3 bits) and amount (5 bits). This lets the viewer draw every carried item, not only water, at a cost of about 10% more frame bandwidth.
4. **`Land.waterStore`** (Float32): saved; hashed only while the switch is on.
5. **One per-tile ground channel to the viewer:** S2's paths channel, repacked as wear (bits 0 to 2), built level (bits 3 to 5, for S3) and water store level (bits 6 and 7).
6. **Tools:** `npm run map` and `npm run probe` report where people stand still and where walls are, by distance from natural water, as measured above, plus store counts.

*On the map:*
- **Close zoom:** carriers show a small grey-blue gourd on the figure (other items get carry marks from the same byte). Stores draw as a top-down clay jar or pool on the tile, fuller with level.
- **Middle zoom:** stores show as blue dots.
- **Far zoom:** a faint blue pixel inside the settlement footprint.
- **Panels:** the inspector shows "carrying water", the settlement card shows stored water, and the legend gets entries.

*Targets, set before running* (seeds 1 to 3, year 30, carried water on against off, S3a layout test on in both):
- People standing still 4 or more tiles from natural fresh water: at least 25% (baseline 12% on seed 3).
- Built tiles 4 or more tiles from natural water: at least 40% (baseline 30%).
- Population at year 20 at least 90% of off; no seed dies out.
- Stores visible: on every seed, stores stand inside at least 3 settlements.
- Perf within budget, also at 2,000 to 3,000 people.

*Risks:* everyone fetching water leaves no one carrying food, so population could drop (fetching is gated behind food hoarding). Inland stores may evaporate before they matter. Thirsty people walking to a store may find it empty (the find threshold and refresh guard this). Stores may become one more stacking point (S1 crowding applies). Frame size grows about 10%.

*Tests:* fetching only beside natural water; spill per step; drinking from a carry and from a store; pouring only away from natural water; evaporation faster when warm and slower when covered; `drinkDist` including stores and matching after a load; a store emptying out of the find field; the carry byte encoding round trip; off parity.

**S3-pre Packed earth.** Stone exists only on hill tiles and is picked up only by people standing there, so lowland camps could almost never build. Add earth, dug from any land tile: a new `CARRY_EARTH` kind (new carry kind plumbing, inspector), and a per-cell material for built cells, so earth gives less durability and wears faster than stone. Digging costs energy and is booked in the ledger. Stone becomes the upgrade near hills. Switch `earthBuildingEnabled`. No "go fetch stone" drive yet.

**S3a Layout spike (headless, no art).** Prototype exposure and directional unloading, then dump the built cells as images on 3 seeds. Do walls form, or only pillars and noise? If only noise, change the rules before anything else depends on them. Walls stay tile-thick, so this also checks whether room sizes and material use are workable, since a freestanding room takes 9 tiles and shared walls have to bring that down.

**S3b Exposure field.**
- `Uint8Array` `exposure` on `Land`, 0 enclosed to 255 open, updated in a rotating slice of 1/8 of the map per tick, like `Land.erode`.
- Barrier comes from built `durability`, brush on the ground, tree cover and height differences (from `upland`). Caves add overhead cover. Unmined `stone` does not count.
- With `exposureEnabled` on, `coldAt` is scaled by exposure and upkeep discounts follow it. Off keeps today's `Land.sheltered`, `FORM_NEST` and `structure` path, so runs can be compared.
- `form` stays for what it also does: granary spoilage and how heaps and nests are drawn.

**S3c Directional building.**
- Seasonal wind vector from `src/sim/seasons.ts`; cold is worse on the side with no upwind barrier.
- Resting carriers unload stone or brush on the neighbouring cell that most reduces their own exposure. They skip occupied and well-worn cells.
- Replaces `Land.build`'s jump to `structure = 1` while the switch is on. The one-tile hut art gives way to what `durability` shows.

**S3d Crossing and gaps.**
- `Rules.canStep` keeps blocking only water. Stepping into a high-durability cell costs extra energy (booked in the ledger) and wears it down, so a sealed-in person can always break out.
- S2's wear also reduces durability on busy cells, so doorways come from traffic.

**S3e Copied habits.** One or two inherited habits (such as how far from one's bed to build, or which side first) spread through the copy rule, so neighbours build alike and cultures differ. Changing `HABIT_COUNT` needs a save-format step.

**S3f Heat field, only if needed.** Keep `warmDist` for finding shelter in any case, because its reach is 12 tiles. Add a heat channel to `src/sim/fields.ts` only if exposure-scaled cold can't make enclosed fires matter. If added: rate at or below 0.25 for stability, walls reducing flow, exposure setting heat loss, and perf measured separately. `thermalMass` waits for this step too.

**Viewer.** Built walls can run to hundreds or thousands of cells, so they move out of the per-entry feature list into S2's versioned per-cell channel (a few bits each for wear and built level). Walls draw through the art spec's `src/render/walls.ts`.

**Main risk.** People may build honeycombs of tiny cells or block their own routes. S3a exists to catch this, and building spacing is the first thing to adjust.

### S6 What limits a city
No population cap. Size is held back by S1's tile crowding, disease spread when crowded (extend `sickSpread`), walking distance to fields, wood clearing and spoilage. Those same costs should make people found daughter settlements.

## How it looks on the map

| Zoom | Cell size | Shows |
|---|---|---|
| Far | 1 to 5 | Faint footprint tint, path pixels, tier icon, name label. This is what makes a village read as a village, since nothing has a roof |
| Middle | 6 to 10 | Floor-plan walls, roads, fields, crowds; names on towns and larger |
| Close | above 10 | Rooms in full: floors, walls, hearths, heaps and people inside, using the art spec's detail tiers |

Also:
- Tap a name for a settlement card: tier, founded year, people, buildings, stores, history.
- A settlements list, added to the bottom panel.
- The auto-camera may treat a new village or town as interesting.
- `src/ui/legend.ts` is close to empty and gets real entries.

Art comes from the `graphics` agent (`.claude/agents/graphics.md`), following `docs/art-style-planimetric.md` and starting with S0's icons. Its brief still describes oblique objects and needs updating to the spec. The spec's palette, terrace and wall modules exist only on `art-planimetric-scaffold`; S2 and S3 viewer work builds on them once merged. Labels stay readable at 360 px, avoid overlapping and never cover people. Only one agent works in `renderer.ts` at a time, because it's a single 1,700-line file. Procedural wall art is the part least likely to look right first time, so it needs your eye, and simple placeholders come first. Tapping prefers a person over a settlement label when both are hit.

## Files

- **T0:** new `scripts/map-dump.ts`; `scripts/fingerprint.ts`, `verify.sh`
- **S0:** new `src/sim/settlements.ts`; `src/sim/host.ts`, `src/ui/simulation-client.ts`; `src/sim/world.ts`, `chronicle.ts`, `protocol.ts`, `config.ts`; `src/render/renderer.ts`; `src/ui/inspector.ts`, `legend.ts`, panel code; new `tests/settlements.test.ts`
- **S1:** `src/sim/rules.ts`, `life.ts`, `land.ts`, `wolves.ts`, `config.ts`, `types.ts`; new `scripts/settle-probe.ts`; new `tests/staying.test.ts`
- **S2:** `src/sim/land.ts`, `rules.ts`, `life.ts`, `protocol.ts`, `host.ts`; `src/ui/simulation-client.ts`; `src/render/renderer.ts`; new test
- **S3w:** `src/sim/land.ts`, `life.ts`, `rules.ts`, `people.ts`, `world.ts`, `protocol.ts`, `config.ts`, `types.ts`; `src/ui/simulation-client.ts`, `inspector.ts`, `settlements-view.ts`, `legend.ts`; `src/render/renderer.ts`; `scripts/map-dump.ts`, `settle-probe.ts`; new `tests/water-carry.test.ts`
- **S3:** `src/sim/land.ts`, `seasons.ts`, `rules.ts`, `life.ts`, `config.ts`, `world.ts`; `src/render/renderer.ts`; new `tests/exposure.test.ts`
- **Docs for every stage:** `docs/decisions.md` (the three decisions above, recorded at the start), `docs/ROADMAP.md`, `docs/findings.md`, `docs/STATUS.md`

## Deliberately not built yet

Tools, recipes, knowledge bits, work timers and a general materials system (primitives 1, 2 and 33 to 46). The existing separate arrays (`pile`, `brush`, `stone`) are enough until after S5.

## Before starting

- The overdue watch from the last review should happen first, on the latest `main`, since S0 labels sit on top of art nobody has yet seen in a browser. The earlier watch server has stopped, so start a new one with a scratch `--data` folder.
- Record this plan's decisions in `docs/decisions.md`, including the art style, which the spec added but `decisions.md` doesn't yet list. Mark primitive 54 as not to be built in `docs/primitives.md`.
- Population is handled in S4, and wounds in S1a if they block camps.

## Verification

Each stage:
- `npm run verify` on a quiet machine and `npm run perf`, at or under 15 µs per person per tick. Map-wide passes cost the same at any population, so also check µs per person from a normal `npm run sim` run at 2,000 to 3,000 people, not just perf's 12,000.
- `npm run fingerprint` is unchanged with the new switch off. For S0, it is unchanged with the observer running, which proves it reads only.
- Tests for mechanisms and invariants only: wrap-aware clustering, stable IDs, save round trip, tier labels never changing outcomes, heaps adding to food scent, the stay check counting heaps and upkeep, higher roaming raising the need, tile benefits shared among occupants, earth wearing faster than stone, wolves not entering fire cells, wear decay, exposure falling as barriers are added, the most exposed side being chosen, a sealed-in person able to break out, heat staying in bounds if S3f is built. No test asserts that a village forms.
- 3-seed comparison against the switch off using `npm run sim`, with `--xEnabled false` (not `0`), logged in `docs/findings.md`.
- Rendered frames at far, middle and close zoom, checked at 360 px wide, using a scratch `--data` folder so your saved world is safe.
- You watch the stage's visible consequence before it closes (rule 13).

**S0 is done when** you can open a world, see named camps at far zoom, tap one for its card and find matching founded and abandoned chronicle entries.

**S1 is done when** a camp visibly stays in one place for at least 10 years, with heaps building up and some people still roaming, compared with the switch off.

**S3 is done when** you can watch a wall or windbreak grow around a place where people rest, with a gap where they walk, and see it thin out after they leave.
