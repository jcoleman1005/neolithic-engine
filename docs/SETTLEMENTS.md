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

**Current stage:** T0 to S3 (S3-pre, the S3a layout test (off), S3w, the shore tests and S3x healing and contest) merged to `main` on 2026-11-08. Watched by the user on 2026-11-09 on the merged code: **S0, S1 and S2 pass** (rule 13); building does not read in the viewer yet (see the art queue in `docs/ROADMAP.md`). Next: the place-cost memory, the Phase 5f port, then the S3a re-run. See `docs/STATUS.md`.

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
- **Directional hypotheses over arbitrary cutoffs.** Frame proof of change around directional effect sizes across multiple seeds (e.g. 'longevity increases by >= 1.5x') rather than brittle target percentages (e.g. exactly 25%). If an effect is macroscopically distinguishable from baseline noise and visible on screen (rule 13), it stands; do not contort tunables to force an arbitrary number.
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
- **Real-renderer capture:** `scripts/capture.ts` (a world saved at year N, several zooms and 360 px) and `scripts/visual-check.ts` (`npm run visual`: fixed seed, scripted camera, pixel diff against `visual/baseline/`; run by `npm run verify` when `VERIFY_VISUAL=1`, opt-in by the user's decision of 2026-11-08). Playwright is now a dev dependency, by the user's decision of 2026-11-08; `PLAYWRIGHT_DIR` is no longer needed. If Chromium is missing, run `npx playwright install chromium` or set `VISUAL_CHROMIUM`.
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

**S3w Carried water (planned and reviewed 2026-11-05; build before S3b).** Why: with thirst on, half of everyone standing still is next to fresh water; with thirst off, 41% stand 7 or more tiles away (seed 3, years 5 to 15). Thirst is not a range limit, since a full drink lasts about 100 ticks; it is a trip. Every 100 ticks or so it drags everyone to the river, and nothing pulls them back inland. Shore land also holds about twice the plant food (capacity 23.5 next to water, 6.7 to 11.5 inland), so the shore is a real draw anyway. The aim is not to move people anywhere: it is to let them drink without the trip and see whether behaviour changes.

*Approach:* water becomes an ordinary hand-carried item (one thing at a time, like food). People drink from what they carry and pour it into small stores at camps away from the river. Not a personal waterskin: that would break the one-carry rule and hand everyone a container at year 0; waterskins and wells are parked.

*Mechanics* (switch `waterCarryEnabled`; every number in config):
- **Fetch:** a fed person with empty hands and nearly full hydration, standing next to fresh river or lake water, fills up to `waterCarryMax`, but only on a small chance per tick (`waterFetchChance`, a hash of tick and slot, no random draw). Without that chance, everyone at the shore would fill up, and hands full of water would stop stone, earth and brush carrying.
- **Spill:** carried water loses `waterSpill` per step.
- **Drink from the carry:** a thirsty carrier drinks what they carry first, so a forager can stay inland instead of walking back. This is the part most likely to change behaviour.
- **Pour:** a resting carrier pours into the tile's store (`Land.waterStore`, capped at `waterStoreCap`) only at least `waterPourMinDist` tiles from natural water, where at least `dropCrowd` people rest or a store already stands. Closer in, a store would save a step or two and nothing more, so carriers keep their water and drink it.
- **Evaporate:** stores lose `waterEvaporation` a tick, more in warm seasons, and `waterCoveredEvapMul` as much on built tiles (nest, hut or any built durability). Exposure can join in later if S3a is accepted.
- **Drink from a store:** a store is drunk from on its tile or any of the 8 around it, just as a river is drunk from beside it (changed 2026-11-05 at your suggestion). One rule covers both: stop and drink when natural water or a store is within reach, otherwise walk downhill on the drinkable-water distance. Up to 9 people can share a store without standing on one tile.
- **Eat from heaps within reach (separate switch `adjacentStoresEnabled`):** hungry people also eat from food heaps on the 8 tiles around them, own tile first and then a fixed order, and S1's stay check counts heaps within reach. It changes far more than water does (each heap feeds about 9 times as many people, and fewer heaps grow into granaries), so it gets its own switch and its own comparison.
- **Expect small inland groups:** a 50-person camp drinks about 20 units a tick, so a store of 100 lasts 5 ticks, and keeping one camp 5 tiles from water would take about 10 people hauling all the time.

*Foundational changes:*
1. **Two water distance fields:** `waterDist` stays natural fresh water (fetching, fish, the shore drink). New `drinkDist` counts rivers plus findable stores. A store becomes findable at `waterStoreFindMin` and drops out only below half of it, so it does not flicker; that state is saved and hashed. `drinkDist` is rebuilt only when a store changes findable state, with a reused typed queue. With the switch off, people use `waterDist` as today.
2. **`CARRY_WATER`** through carry caps (body-scaled), spill, drag and the save.
3. **A carry byte in the person frame:** 10 to 11 bytes per person (carried kind and amount), so the viewer can mark what anyone carries. This is a format change, so open pages reload, and it is about 10% more frame bandwidth.
4. **`Land.waterStore`** (Float32) and the findable state: saved, and hashed only while the switch is on.
5. **The per-tile ground channel to the viewer:** wear (bits 0 to 2), with water store level in bits 6 and 7; bits 3 to 5 are left for S3's built level.
6. **Tools:** `npm run map -- --samples <file>` writes thinned samples of how far people standing still are from natural water, and a new `npm run compare` runs the statistics below.

*On the map:* stores draw as blue on the tile, stronger as they fill (a top-down jar or pool sprite comes from the graphics agent later). At close zoom a carrier shows a small mark for what they carry, blue for water. The settlement card shows stored water, and the legend gets entries.

*How S3w is judged.* No target for where people should be. The test is whether behaviour differs:
- **Runs:** 6 seeds, 30 years each, carried water on and off. Everything else stays at defaults, with S3a off, since it is unreviewed.
- **Measure:** distance from natural fresh water of everyone standing still, sampled every 90 ticks from year 10 to 30.
- **Two comparisons**, each with everything else on: carried water off against on, and adjacent eating off against on.
- **Main test:** the per-seed means are compared in pairs, with the mean difference, a 95% interval, and an exact sign-flip test (with 6 seeds, the smallest possible two-sided p is 0.03).
- **Supporting check:** a rank test within each seed.
- **Passes if:** the difference is significant at p < 0.05 in either direction, with the interval excluding zero.
- **Guardrails, reported and not targets:** no seed dies out; population at year 20 within 10% of off; built tiles not down by more than 25%; perf within budget.

*Tests:* fetching only next to natural water and only on the chance; spill per step; drinking from a carry and from a store; pouring only far enough from natural water; evaporation faster when warm and slower when covered; findable hysteresis; `drinkDist` including stores and matching after a load; the thirst stop rule on a store tile; the carry byte round trip; off parity.

**S3x Turmoil: healing and the cost of a place (planned 2026-11-06, revised 2026-11-07; build before S3b).** Why: the death probe (`scripts/death-probe.ts`, `docs/findings.md`) found no code bug, but wounds never heal at today's balance. From year 20, 95 to 97% of people are wounded, averaging 220 of 255. Wounds heal only above half energy, while clashes come about every 2 months per child. Wounds add upkeep and stop steps, so the wounded get hungrier, stop healing, and fewer women are fed enough to mate (43% falling to 13%). Nothing lets repeated defeat drive people away: the stay check ignores danger, danger scent is a slope that is flat inside a fought-over camp, hunger halves fear, and a defeat is one random step.

On by default. Slow healing and the contest are built and measured; the contest refinements are next, then the place-cost memory, which replaces the first fear design (revised 2026-11-07, see below).
1. **`slowHealEnabled`** (built). Wounds heal at any energy: the full `injuryHeal` above `injuryHealEnergy`, falling to `healFloor` of it at zero energy, and `healShelterMul` faster on a sheltered tile (`Land.sheltered`; it follows exposure once S3b is on). Healing costs no energy. Off keeps the old rule. Result: wounds fall a little on all 3 seeds, but wounds still arrive faster than they heal (`docs/findings.md`).
2. **`placeCostEnabled`: people remember what a place costs them.** New per-person state: `placeCost` (Float32, energy), `costX`, `costY` (Uint8, the centre of the region it belongs to). It is a pressure, not an order: nothing tells anyone where to go. **Built 2026-11-09 (PR #4) and switched off by default:** with fights rare under the contest, the cost was too small to move losers (`docs/findings.md`); revisit in the end-of-plan tuning pass.
   - **Losses add what was actually lost:** the energy a clash loser loses, or a wolf takes. A heavy defeat counts more than a scratch.
   - **Wins subtract what was gained:** a winner's loot comes off their own cost, so the memory tracks net loss. It never goes below 0, so raiding does not make a place more attractive than it is.
   - **One region per person:** an event within `costRadius` of the centre adds to the memory and nudges the centre toward it, weighted by size. An event farther away starts a new memory there, and the old place's cost is dropped, since it belongs to a place the person has left.
   - **It fades:** each tick the memory shrinks by 1 / `costMemoryTicks` (about a year), so a quiet stretch rebuilds trust.
   - **It is counted as upkeep:** the expected cost of living in the region is `placeCost / costMemoryTicks` energy a tick. Inside the region, the stay check (`worthStaying`, and the old calm path when `stayValueEnabled` is off) adds it to the real upkeep of the tile. When the place no longer pays, the person moves the way any dissatisfied person moves (food scent, roaming, worn paths) and stops on the first tile that pays. There is no push and no direction.
   - **Shelter is weighed, not overridden:** the cold rule's "stay sheltered" holds only while the cold upkeep a shelter saves is more than the place's expected cost.
   - **Children learn from their parents:** a child (under `adultAge`) within `careRadius` of a living mother or father drifts toward that parent's view of the place (`costChildLearn` of the gap a tick), taking the parent's centre when the parent's memory is larger. If the family stays, the child stays. A child with no parent in range learns the same way, more weakly (`costAdultLearn`, half of `costChildLearn`), from the nearest other adult within `careRadius`, found through the spatial grid; the two never stack (user decision 2026-11-09). An orphan with nobody near keeps their own memory, which fades as usual.
   - **What should follow, unscripted:** outnumbered people lose more often (allies already raise clash scores) and leave first. Rich land can bear the cost of fighting and is held, while poor land is given up. Winners are paid by loot and stay.

3. **`contestEnabled`: a fight is a contest over something real** (planned 2026-11-07; built before the place cost, which depends on how often people really fight). It replaces the belligerence gate (habit + cruelty > 180, which stops under 3% of touches) and keeps everything before it. Allies still share, and pairs whose cultures are close still tolerate each other. Pairs below the old gate (under 3% of touches) now go through the contest too; for everyone else the contest can only remove fights.
   - **The stake** is the food both could eat here: standing plants above the grazing floor, plus heaps in reach when stockpiles are on. A person values it as `min(their share, maxEnergy − energy)`, so a fed person cannot use food and has no motive. With no fight, the two share the tile and each gets about half. **The gain** from winning is the value of all of it minus the value of half, plus the usual loot. **Yielding** loses the value of half.
   - **The odds:** each side's fight score has a fixed part (strength × life stage × 10, plus allies × 3, as today) and noise uniform on 0 to 2. The chance of winning is therefore exact: the triangular distribution of the difference. No random draw is needed to judge it.
   - **The costs** are the real ones: the energy a loser loses (`clashLossShare`), their share of the stake (the loser is driven off), plus the energy-equivalent of the wound. That is the upkeep a wound of `clashInjury` costs until it heals at the person's current healing rate, computed from config, so there is no new magic number. The winner's smaller wound is costed the same way.
   - **Belligerence becomes risk appetite:** `r = contestRiskWeight × ((habit + cruelty) / 255 − 1)`, from −w to +w. A person attacks when `(1 + r) × pWin × gain > (1 − r) × (1 − pWin) × loss`. Each of the pair is checked as attacker, the more eager first.
   - **The defender chooses:** fight back if `(1 + r) × pWin × (keep + loot) − (1 − r) × (1 − pWin) × loss` beats yielding, which costs half the stake. A defender who yields steps off the tile (the existing retreat step). Nobody is wounded and no habit changes, and the attacker keeps the tile.
   - **What should follow, unscripted:** fed people on rich ground don't fight. The hungry fight over scarce food, so contests gather on worn ground and around heaps. The weak, children included, yield instead of being wounded. Two strangers no longer fight every tick, because once one yields nothing is left to contest. The climb of belligerence should slow, since yields replace most defeats.

**Contest edge cases:**

| Case | Handling |
|---|---|
| Nothing at stake (bare rock, fully fed pair) | No motive, no fight. |
| A starving person against a stronger one | High value with low odds: they may attack anyway. That is desperation, and it is accepted and reported. |
| The yielder cannot step (water all round) | They stay. Next tick the same contest yields again, with no harm done. |
| A crowd of strangers at a heap | Each pairing in the cell is judged on its own, as today. The ally count is the same 9-cell scan the clash already does, and it runs only for pairs that pass the culture gate (about 8% of touches today). |
| Children | No child rule. They are weak (life-stage strength), so they rarely attack and usually yield. |
| Chronicle battles | Battles are built from clashes, so fewer may be reported. That is an outcome of this change, and the chronicle is not tuned for it. |
| Off parity, saves | No new per-person state. With the switch off, no extra random numbers are drawn and today's gate is used. The switch is added (off) to the pinned-hash test. |
| Observers | Contests, yields and clashes are counted in `Rules.clashStats` (observer only) for the probes. |

**Contest tests:** no fight with nothing at stake; a fed pair does not fight over food they cannot eat; pWin matches the triangular formula; risk appetite moves the threshold; a weaker defender yields with no wound and steps off; a stronger defender fights back; a child yields to an adult; the switch off keeps the old gate; off parity.

**Contest is judged by:** 3 seeds, 50 years, contest on against off (slow healing on, place cost not built). Measure: clashes and yields per person-year, share wounded, belligerence drift, births per head, women fed enough to mate, population at year 50, and settlements lasting 10 years or more. Guardrails: no seed dies out; perf within budget. Targets are written in `docs/findings.md` before running.

4. **Contest refinements from the literature** (planned 2026-11-07; the contest is an asymmetric Hawk–Dove game; sources in `docs/findings.md`). Four switches, all on by default, each compared one off at a time:
   - **`residenceEnabled`: who was here first** (Maynard Smith & Parker's Bourgeois strategy). New per-person `restTicks` (Uint8): ticks standing still on the current tile, capped at 255, reset by any step. A person who has rested at least `residentTicks` there is a resident. A resident values the stake at `residentValueMul` times what an intruder does, because they expect to keep using the place: the food now plus what grows back while they stay. That is an information and expectation difference, not a rule that the owner wins. Valuing the food more raises what a resident could win and lose by the same amount, so it does not make residents attack more. It makes them defend: giving way costs a resident more, so they fight back where a newcomer would yield. That is the Bourgeois pattern, owners defend and intruders back off, and it is what makes camps defended places.
   - **`concedeEnabled`: give way only the part you value least** (Blurton Jones's tolerated theft; Winterhalder's marginal-value model). When the contest says the defender gives way, they no longer step off. The attacker takes food away in hand, up to what they can carry and eat, from the tile's plants and then the heaps in reach, like any gathering. Normal eating is about a bite a tick, so eating a meal on the spot would not be physical. If their hands hold something else, the defender steps off instead. The defender stays, unhurt, with what is left. Whether they then move on is decided by the ordinary stay check: if too little is left, they leave like anyone on a poor tile. The hungry take more, and a fed holder gives most of it up.
   - **`matchCostEnabled`: close matches cost more** (Enquist & Leimar's sequential assessment). A fight's wounds and energy loss, `main`'s strike damage included, are scaled by how even the match was: `c = 1 − |2 × pWin − 1|`, from 1 for an even match to 0 for a certain one, applied as `matchCostFloor + (1 − matchCostFloor) × c`. The contest's own cost estimate uses the same factor, so judging and fighting agree. One-sided fights end quickly with little harm, and fights between equals are the bloody ones.
   - **`selfAssessEnabled`: self-confidence, not belligerence** (winner and loser effects, Hsu, Earley & Wolf 2006). New per-person `confidence` (Float32, in fight-score units) and `confTick` (Uint32, when it last changed). A win adds `confStep` and a loss takes it away. It fades back toward 0 with time constant `confFadeTicks`, computed when read from `confTick`, so there is nothing per tick. The contest judges the odds from the person's own fight score plus their confidence against the other's true score. The fight itself uses true strength, so the overconfident lose more often. The belligerence habit nudges on a win or loss (+3 / −3) are off while this is on: belligerence stays an inherited and copied temperament, the risk appetite. A hierarchy can then emerge from repeated wins, with nobody tracking who beat whom.

**Refinement edge cases:**

| Case | Handling |
|---|---|
| Both are residents | Both value it the same way; the contest is symmetric again. |
| A resident child | Resident like anyone. They still usually lose the odds, so they concede. |
| A concession on bare ground | No stake means no contest, so it cannot happen. |
| The attacker is already full | Their headroom is 0, so they had no motive; the contest would not have run. |
| Conceding to a group, one taker after another in one tick | Each pairing is judged on what is left, so later takers find less and stop. |
| Concession and the normal forage loop in the same tick | Eating is capped by headroom in both, so nobody eats past full. |
| `main`'s resource gate and courage retreat | Off while the contest is on, as now. The refinements apply only with the contest on. |
| Confidence running away | It fades with `confFadeTicks`, and fights use true strength, so overconfidence is corrected by losing. |
| Old saves | `restTicks`, `confidence` and `confTick` are optional per-person fields, default 0. |
| Slot reuse, growth, hashing | Reset in `kill` and `spawn`, copied on growth, hashed only when their switch is on, and the switches are added (off) to the pinned-hash test. |
| Perf | `restTicks` is one write per person per tick in the movement loop. The rest runs only in contests (about 0.02 a person a tick) or in fights. Estimated 0.01 to 0.02 µs per person per tick in all. |

**Refinement tests:** a resident defender fights back where a newcomer gives way, and the counter resets on a step; a concession puts food from plants then heaps in the taker's hands, leaves the ledger untouched and the defender in place and unhurt; the ledger balances; wounds scale with closeness and the estimate matches; confidence rises on a win, falls on a loss and fades as computed; the contest uses confidence for the odds but the fight does not; the belligerence nudges are off while self-assessment is on; each switch off restores the contest without it; save round trip; off parity.

**Refinements are judged by:** 3 seeds, 50 years, all on against each one off, and against `main`'s resource clashes (contest off). Measure: fights, yields and concessions per person-year; share wounded; deaths in fights; who holds rich tiles (residents against intruders); spread of confidence; population at year 50; settlements lasting 10 years or more. Reported as directional effects across seeds (rule 10). Guardrails: no seed dies out; perf within budget.

**Replaced: the first fear design.** Built and measured on 2026-11-06, then replaced: `fear` gained a fixed amount per loss, ignored wins, and pushed people away from the centre. Since nearly everyone loses sometimes, 77% of adults carried fear. Frightened people stood still a quarter of the time, so the good land was abandoned rather than held, and population at year 50 was about 38% lower (`docs/findings.md`). The code stays in git history (commit "S3x slow healing and fear from defeat").

**Edge cases and how they are handled:**

| Case | Handling |
|---|---|
| Hemmed in by water, or no tile nearby pays | No push, so nobody is driven into the shore. A person with nowhere better stays and pays, as with a poor tile today. |
| Thirst returns early in `climb` | Thirst stays first, or people would die of thirst. |
| A hut or nest inside a costly region | Weighed against cold upkeep saved, as above. Not skipped by rule. |
| People wander back in (food scent, leader pull) | Expected: the cost then fails the stay check again. Measured as re-entries, not prevented. |
| A leader inside the region | A follower who is not comfortable follows the leader as today; the band leaves when the leader's own cost fails. |
| Refugees lose again elsewhere | A new memory there. Reported as the share of adults with a cost and how far they moved. |
| Children lose most clashes | They learn their parents' view while near them. Child deaths are reported per run, and a jump is a stop-and-report. |
| Wrap at the map edge | The centre is nudged with `wrapDiff`; Uint8 coordinates wrap with `& 255`. |
| Slot reuse, growth, saves | Reset in `People.kill` and `spawn`; in the capacity-growth copy; saved per person as optional fields defaulting to 0. Old saves with `fear` fields load and ignore them. |
| Fingerprint parity | Hashed only when the switch is on; no random numbers; the switch is added (off) to the pinned-hash test. |
| Perf | One wrap-aware distance check per decision, one multiply per tick for the fade, two id lookups per child. Well under 0.1 µs per person. |

*On the map:* nothing new is drawn at first. The inspector gets wounds and the place cost with its region in the viewer pass. Something visible (rule 13) to watch: a contested camp where those who keep losing leave and those who hold their own stay, compared with the switch off.

*How S3x is judged.* No target for where people go. Targets are written in `docs/findings.md` before running:
- **Runs:** 3 seeds, 50 years, place cost on against off (slow healing on in both); wound probe and fear probe (adapted to place cost).
- **Measure:** share of losers more than `costRadius` from the clash 90 days later, against winners; share of adults with a cost; share standing still; tile capacity underfoot; births per head; settlements lasting 10 years or more.
- **Guardrails, reported and not targets:** no seed dies out; population at year 50 within 10% of off; camps lasting 10 years or more not down by more than 25%; child deaths not up; perf within budget.

*Tests:* healing at any energy, faster when fed and sheltered; a loss adds the energy lost and a win subtracts the loot, never below 0; events inside the radius add and move the centre, events outside start a new memory; the memory fades by 1 / `costMemoryTicks`; the stay check counts the expected cost only inside the region; shelter holds only while the cold saving exceeds the cost; a child near a parent moves toward the parent's memory and an orphan's fades; reset on kill and slot reuse; save round trip; off parity.

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

### S4 Surplus: DRAFT, pending your S3 watch (written 2026-11-09)

**Status: draft only. Nothing here is built or claimed until you have watched S3 (rule 13) and approved this section.**

**What already exists (so S4 starts by measuring, not building):** the 5e golden crops (`goldenCropsEnabled`, ripe above `cropRipenThreshold` on worked soil), tending (`tendingEnabled`, primitive 5), mutable fertility with compost from spoiled heaps, spoilage (`pileSpoil`, `granarySpoilFactor`, primitive 9) and a stack limit (`pileCap`, primitive 41) are all on `main` and on by default. The roadmap lists 5e as "built, not watched". So the S4 question is not "add farming" but "does farming near camps make a surplus that feeds more people, and can you see it".

**S4a Measure first (read-only probe, 3 seeds × 50 years, S3a on and off):** share of food eaten that was grown on worked soil; golden cells within 4 tiles of a camp; heap size and spoilage loss per camp; people per camp against the land's wild capacity around it; hunger inside camps against outside. Results in `docs/findings.md`. This shows which part is too weak: yield, spoilage, or people not eating from stores.

**S4b Only what S4a shows is missing,** for example:
- crop yield on well-tended soil (tuning, not a new mechanic), if grown food is a small share;
- spoilage that falls further on a walled, low-exposure tile (a covered store), if heaps rot before they feed anyone. This ties S3's exposure field to food;
- eating from a heap on the tile before grazing, if people starve beside full heaps.

**S4c The end-of-plan tuning pass, folded in here:**
- **Too peaceful?** About one death in a fight a year among 6,000 people since the contest (`docs/findings.md`). Candidates: `contestRiskWeight`, and scarcity from a larger population once surplus raises it. The target would be written before tuning, and needs your view on how violent the world should be.
- **Place cost** (off by default since 2026-11-09): re-measure once fights are more frequent; turn on only if losers then leave measurably.
- **S3a and crossing on by default:** your decision after the watch; S4 measures with them on and off.

**S4 gates (draft values, to agree before running):** golden fields visible ringing at least 3 camps per seed at year 30; camps' population at least 1.25× the off arm's; no seed dies out; perf within budget. **On the map:** golden fields ringing camps, heaps that persist through winter, camps that grow.

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
- **S3x:** `src/sim/life.ts`, `rules.ts`, `wolves.ts`, `people.ts`, `config.ts`, `types.ts`; `src/ui/inspector.ts`; `scripts/death-probe.ts`; new `tests/turmoil.test.ts`
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
