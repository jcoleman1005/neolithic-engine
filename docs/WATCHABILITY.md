# Watchability plan (W0 to W4): to be run by another session

Written 2026-11-13. It is meant to be run by a fresh session. The design came out of the conversation that built watchability #3 (activity poses and pops) and the GBA palette, both merged to `main` in c725b1d.

## 0. How to use this plan

**If you are the session running it**, read these first:
- `AGENTS.md` (the 15 rules) and `CLAUDE.md` (status reporting, git, long runs).
- The handoff at the top of `docs/STATUS.md`, and `docs/WORKBOARD.md`.
- This whole file.

Then work **one stage at a time, in this order: W0, W1a, W1b, W3, W2, W4**. Each stage runs the procedure in section 2.

**Stop and ask the user** at the points marked **STOP**. Never merge to `main` without the user's agreement.

**Decisions the user has made (2026-11-13)**, also in `docs/decisions.md`:
1. Start with W0, the probe.
2. Grazing is to become scarcer and food abundance more realistic, calibrated from what W0 measures. That's W1a, before the ripening seasons (W1b).
3. W4 (floods and fire) comes last. Its two open questions (weather on by default; whether floods can kill) are decided then, not now.
4. Order of the rest: W1b, then W3, then W2.
5. Watchability #3c (feeding small moments to the camera) is not built. The auto camera stays off by default.

## 1. Why the world is dull to watch (the evidence)

- **Everything good is at the water.**
  - Riparian ground is more fertile, and fish are caught from the shore.
  - Thirst pulls everyone back about every 100 ticks: hydration falls 0.4 a tick, and people seek water below 60.
- **There's no reason to travel.** Open land stays nearly full.
  - Regrowth is logistic, at `landRegrowthRate` 0.05 towards a cap of `landFoodMax` 25. At half capacity one tile regrows about 0.31 food a tick, which is more than one person's upkeep (`metabolismCost` 0.25).
  - So every tile can feed a person forever, the S1 stay check passes almost everywhere, and a forager steps one tile and stops.
  - Population takes about 40 years to fill the land (`exp-winter` findings).
- **Grazing is the whole diet.** It's over 90% of meals; berries are 0.6% and fish 1.1% (`exp-patchy-food`, 2026-11-10). Anything meant to move people must act on grazing.
- **A global hard winter halves the population**, and nobody stores more (`exp-winter`). Scarcity has to be uneven in space, not only in time.
- **Herds are loners.** Each animal steps to the best neighbouring tile and flees people (`src/sim/herds.ts`).
- **Hunting is a strike chance** against an animal already on or beside the hunter's tile (`src/sim/life.ts`, the forage loop). Nobody chases.
- **Materials are local.** Stone lies on every rock tile above the rock level (`stoneCap` 30), earth is dug from trodden tiles, and brush comes from any wooded tile.

## 2. Procedure for every stage

**1. Set up:**
- `git fetch --all` and `git branch -a`, and check nobody else touches the same system (CLAUDE.md).
- Branch off the latest `main`, named `watch-w0-probe`, `watch-w1a-abundance`, and so on.
- Add a row to `docs/WORKBOARD.md` (rule 14) with the branch, files and status.
- Run `npm install` if `node_modules/.bin/vite-node` is missing.

**2. Baseline:** on the branch before any change, record `npm run fingerprint -- --ticks 1800`, the same with `--weatherEnabled true`, and `npm run perf`.
- At handoff `main` gave `dbeaac54ed27afd8` and `453f741794e836ee`, with perf about 4.2 µs per person per tick at about 13,850 people.

**3. Plan reply (rule 3):**
- Before coding a stage, give the user a short plan: files, new state, risks, and the targets you'll write down.
- W0 is read only and can go straight ahead.

**4. Build:**
- **Switches:** every new mechanic gets a `*Enabled` switch in `src/sim/config.ts`, in its own commented block (rule 9). Add it to `src/ui/feature-switches.ts`, or `tests/feature-switches.test.ts` fails.
- **Tuned numbers:** go in `config.ts`, and each one is logged old and new, with why, in `docs/findings.md` (rule 5).
- **Code rules:** seeded random numbers only, no allocation per person per tick, and observers draw nothing (rules 6, 7, 11).
- **New saved state:** add it to the save, bump `SAVE_SCHEMA` in `src/sim/world.ts`, and add per-person fields to `PERSON_FIELDS`.

**5. Check the switch:**
- With the new switch off, the default fingerprints must equal the baseline.
- With it on, record the new fingerprints.

**6. Targets first:**
- Write the stage's hypotheses and targets into `docs/findings.md` before running anything.
- They're directional effects with sizes, across seeds (rule 10).
- Write tests for mechanisms and invariants, never "this behaviour emerges".

**7. Runs:**
- Use seeds 1 to 3 (5 when an effect is small or the seeds disagree), 30 and 50 years, with the W0 probe.
- Anything longer than about 5 minutes runs with `nohup ... > logs/run-<name>.log 2>&1 &`. Save the PID, and kill only that PID.
- Long sweeps can go to Katie's laptop (a Remote Control session; find it with ListAgents). Otherwise use about 1 hour for 12 sixty-year runs on 4 cores.
- At most 8 tuning rounds per stage. Report missed targets as findings rather than forcing them.

**8. Viewer:**
- Viewer art follows the GBA palette: `src/render/limited-palette.ts`. New colours go through `paletteHex`/`hexToABGR`, or come from the palette.
- Add legend lines in `src/ui/legend.ts`.
- If the drawing changes, regenerate the visual baselines on purpose (`npm run visual:update`). Check that `VISUAL_QUERY='&palette=original' npm run visual` still shows only the expected differences.

**9. Verify:**
- `VERIFY_VISUAL=1 npm run verify` passes.
- `npm run perf` at 10,000 people stays at or under 15 µs; report the number.

**10. Report:**
- Update `docs/STATUS.md` and your work-board row, then commit and push the branch.
- Report with the checklist (rule 15): DONE with proof, NOT DONE with why, or NEEDS ME.

**11. STOP: the user watches on the phone (rule 13)** and agrees to merge.
- Merge to `main` with a merge commit, run verify on `main` right after (CLAUDE.md), then push.
- The user runs the watch server from their main checkout with `npm run server:new`.

## 3. W0: the watch probe (read only)

**Goal:** numbers for how watchable a run is, the baseline for every later stage, and the calibration data for W1a.

**Build:** `scripts/watch-probe.ts`. Copy the shape of `scripts/surplus-probe.ts`: same argument parsing (`scripts/args.ts`), same `RESULT` line at the end, read only.
- **Checks:** a run with the probe must give the same `stateHash()` as a plain run of the same seed and length. Run the fingerprint before and after.
- **Usage:** `npm run probe`-style usage via vite-node, `--seed`, `--years`, `--every` (sample interval, default 30 ticks), and any `--someSwitch value` overrides.

**What to measure** (adults unless noted; from year 5 on so the founders' scatter has settled):

| Metric | How |
|---|---|
| `stepsPerAdultYear` | Count position changes per adult per tick, averaged and scaled to a year. |
| `netDisplacePerAdultYear` | Wrapped distance between where each adult was 360 ticks ago and now, sampled every 30 ticks. Use a ring of 12 snapshots of x and y per slot as typed arrays; track slot generation so a reused slot is skipped. |
| `nearWaterPct` | Share of adults with `land.waterDist ≤ 2` at each sample. |
| `campStayMedian` / `campStayP90` (ticks) | For each person, how long they stay within 3 tiles of where a stay began. Start a stay when the person is first seen there; end it when they move more than 3 tiles away. Take the median and 90th percentile of completed stays. Calibration target for W1a. |
| `landFullPct` | Mean of `food / capacityAt` over land tiles with capacity > 0, at each sample. Also give the share of such tiles above 0.9 (`landNearFullPct`). |
| `harvestShare` | Plant food eaten by people and herds per tick, divided by the plant food regrown per tick (land-wide). Wrap the `Land` graze and regrow paths the way `surplus-probe.ts` wraps food methods, without changing them. Tells how much of production is used. |
| `tilesPerPerson` | Land tiles with capacity > 0 divided by population. |
| `activityPct[...]` | Share of person-ticks per activity, read from `people.activity & 15` (the 3a byte, `src/sim/activity.ts`). |
| `eventsPerYear` | Kills, births, fires lit and huts finished, from the activity event bits. The probe must clear them after reading, as `packPeopleFrame` would (`activity[i] &= ACT_MASK`). |
| `migrationsPer10y`, `bandDisplacePerYear` | From the chronicle (migration entries) and the band tracker (centre movement). |
| Health | Population at years 10, 30 and 50; mean population; `diedOut`; hungry share (energy below `hungerDriveThreshold`); herd and wolf counts at year 30 and 50. |

**Runs:**
- Default config, seeds 1 to 3, 30 and 50 years.
- One reference run with `--weatherEnabled true` (seed 1, 30 years) so W1b and W4 have it too.

**Deliverables:**
- The probe.
- A test that the probe's wrapping changes no outcome (same hash with and without it over 300 ticks).
- A table in `docs/findings.md` titled "W0 baseline", and STATUS lines.

**STOP:** show the user the baseline table before W1a. Point out `campStayMedian`, `landFullPct`, `harvestShare` and `tilesPerPerson`, since those drive W1a.

## 4. W1a: realistic food abundance (scarcer grazing)

**Goal (user decision):** decrease how much grazing the land gives, so food is scarce enough that people must keep moving.

**The target is in-model, since there's no real-world scale:** foragers in the ethnographic record move camp every few weeks.

**Targets** (write these into `docs/findings.md` before tuning; a tick is a day):
- `campStayTimeMedian` falls from today's (about 160 ticks at W0) to about **14 to 40 ticks**. (Changed 2026-11-13 after W0: `campStayMedian` is already 16 to 22 ticks, because it counts every short stop.)
- `landFullPct` falls clearly below today's (expected about 0.95 or more), towards **0.5 to 0.7**. Grazed ground should be visibly patchy.
- `harvestOfMaxYield` rises well above today's (about 0.17 at W0, 30 years). (Changed 2026-11-13: `harvestShare` is 1.00 by construction.)
- `stepsPerAdultYear` and `netDisplacePerAdultYear` rise; `nearWaterPct` falls.
- **Guard rails:**
  - No die-out on any seed in 50 years.
  - Population at year 30 at least **1,500** on every seed, so the map stays lively and bands exist. Population is expected to fall; that's fine as long as it stays above this floor.
  - Hungry share no more than about double W0's.
  - Herds survive 50 years on every seed (they eat the same grass). Wolves do no worse than the W0 baseline on each seed: they already die out on seed 1 by year 20 (changed 2026-11-13).

**Levers** (all in `config.ts`; change as few as possible, log each in findings):
- **`landRegrowthRate`** (0.05). The main lever, because regrowth, not standing stock, is what feeds a camp. Try 0.02, 0.015 and 0.01.
- **`landFoodMax`** (25). Lowers standing stock, so a tile empties sooner. Try 18 and 12.
- **`landGrazingFloor`** (1.0). How bare grazed ground gets.
- **`forageBite` and `metabolismCost`**: leave these. They set the energy budget everything else is tuned around.
- **Herds:** `herdGrazeBite` and `herdSoftCap` only if herds die out.

**Method:**
- A small grid first (regrowth × cap, seeds 1 to 3, 30 years) with the W0 probe.
- Pick the mildest setting that meets the targets, then confirm with 50 years and 5 seeds.
- This is a re-tune of defaults, not a new mechanic. Add a switch `realisticAbundanceEnabled` (on) that selects the new values, so an off run reproduces today's world and its fingerprint (rule 9).

**What you'd see (rule 13):** patchy grass with bare grazed halos around camps, and bands moving every few weeks instead of sitting by the water.

**Viewer:** probably nothing new; grazed tiles already show lower food. Check at cell size 16 that bare ground reads as bare.

**Risks:**
- **Too scarce:** population crashes, or a band starves before it finds food. Watch hunger outside camps and per seed.
- **Herds:** they compete for the same grass and may collapse first.
- **Settlements:** S1 to S3 settlement behaviour was tuned on abundant land. Expect fewer, shorter camps. Report it; don't re-tune S-stages here.

**STOP:** show the user the chosen setting and a before/after watch before W1b.

## 5. W1b: land that ripens by place and season

**Goal:** an annual round. Different ground is at its best at different times, so bands follow a moving wave of good grazing.

**What you'd see:**
- A wave of lush colour moving across the map through the year: lowlands and the south first, uplands later.
- Bands walking towards it, with bare halos behind them.

**Mechanism** (land only; people respond through their existing rules, rule 4):
- **Ripening phase:** each land tile gets a fixed phase in the year.
  - It's computed once at world build from elevation (higher is later, `ripenElevationLag`) and latitude (the y band is later going north, `ripenLatitudeLag`).
  - It uses no random draw and is derived from terrain, so it isn't saved. A loaded world rebuilds it (test the save round trip).
- **Seasonal capacity:**
  - Near its peak (`ripenWindow`, start at 80 ticks), a tile's capacity is multiplied by up to `ripenPeak` (start at 1.4, mild).
  - Away from it, standing food withers towards `ripenFloor`, the way `exp-winter`'s die-off did, but staggered by place.
  - **Hard target:** the land-wide mean capacity over a year stays within ±10% of W1a's. That's what stops it becoming the winter crash.
- **Implementation:**
  - One precomputed 360-entry curve table in `src/sim/seasons.ts`, applied inside the existing `Land.step` loop in `src/sim/land.ts` via a `ripenPhase` Uint8Array. No per-tile trigonometry, no allocation.
  - With `weatherEnabled`, soil moisture may bring the peak forward and strengthen it. Optional, because weather is off by default.
- **Fields:** golden fields (seeds) ripen on the same calendar, answering the `exp-winter` note that ripeness needs a season.
- **If bands can't find the wave** (check `migrationsPer10y` and hunger): let far sight (`farSightEnabled`, `blockFood`) look two blocks out when the contrast between blocks is large. That's still a per-person rule.

**Switch:** `ripeningEnabled`.

**Targets:**
- Against W1a: `netDisplacePerAdultYear` and `bandDisplacePerYear` clearly up, `migrationsPer10y` up, `nearWaterPct` down.
- Population within about 15% of W1a at years 30 and 50.
- No die-outs.

**Viewer:**
- Ripeness needs no new channel: the viewer computes it from terrain it already has plus the season.
- A lush tint on ripe grass, clearly apart from crop gold, using GBA palette greens.
- Withered grass uses the existing dry tint (`DRY_GROUND_ABGR` in `src/render/renderer.ts`).
- Two legend lines.

**Open questions for the user** (ask in the plan reply):
- Do berries keep their own season or follow the ripening phase?
- How strong should the seasons be after the first runs? Start mild.

**STOP:** watch.

## 6. W3: flint away from water, and wells

**Goal:** trips out of camp for good material, wearing paths that radiate from settlements, and camps that can live away from the river.

**What you'd see:**
- Tan trails running from camps out to the hills.
- Flint loads being carried home.
- A well with a camp around it, far from any river.

**Flint:**
- About 5 to 10% of rock tiles become flint outcrops instead of plain stone, chosen by a terrain hash on ridgelines (no random draw).
- Flint builds stronger (`flintBuildGain`), and only flint in hand gives the hunting bonus (today `huntStoneBonus` applies to any stone).
- People already pick up stone when fed and empty-handed on rock (`Land.quarry`, the forage loop in `life.ts`).
- If runs show they don't go for flint, add a weak "material" scent from outcrops, read only by fed, empty-handed people.

**Wells:**
- **Where:** low ground where water is near the surface (elevation within a few steps above the nearest fresh water, within `wellMaxDist` of it).
- **Digging:** a well-fed person resting in a crowd far from water (`waterDist` ≥ `wellMinWaterDist`) digs. Each dig adds to `wellWork` and costs energy, the same individual pattern as earth building (`Land.dig`, `Land.build`).
- **Finished:** at `wellDone` the tile becomes a fresh-water source with a limited flow that refills slowly.
- **Drinking:** it joins the drink sources (`drinkDist`, `refreshDrink`), so thirsty people walk to it like a water store.

**Switches:** `flintEnabled`, `wellsEnabled`.

**New state:**
- `flint`, `wellWork`, `well` in the land state (saved; bump `SAVE_SCHEMA`).
- A flint carry kind (`CARRY_*` has 7 free) and a well bit in the ground channel (`Land.packPaths`).

**Viewer:** a well sprite (stone ring, dark water), a flint load colour, and dark glints on outcrops. All in the GBA palette, with legend lines.

**Targets:**
- Share of settlements (observer) centred 5 or more tiles from water: up.
- Mean distance stone is carried: up.
- Path wear outside settlements: up.
- Thirst deaths: no worse.
- Wells stay rare enough that the river still matters. Report how many and where.

**STOP:** watch.

## 7. W2: migrating herds and pursuit hunts

**Goal:** herds moving across the map, and hunts you can follow from the chase to the carry home.

**What you'd see:** columns of deer drifting with the ripening wave, hunters strung out behind them, a kill far from water (the meat pop), and a food load walked home.

**Herds:**
- **Cohesion:** each animal leans towards the mean of herd mates within `herdFlockRadius`, a boids-style individual rule.
- **Heading:** a per-animal `heading` (saved) for persistence. Every `herdMigrateInterval` ticks the animal steers to the richest neighbouring block (`blockFood`).
- **With W1b on,** herds follow the wave.

**Pursuit:**
- **Committing:** a hungry person (below `huntBelow`, uncommitted) checks the herd cell index within `huntSenseRadius` (about 5), staggered like `Rules.copy`, and commits to one animal (`huntTarget` slot and generation, `huntTicks`).
- **The chase:** while committed, a priority step towards the target in `Rules.climb` (like the thirst step). Each step costs extra energy (`huntSprintCost`) and fatigue.
- **The end:**
  - When adjacent, the strike roll (`life.ts`).
  - They give up after `huntGiveUpTicks`, when tired, or when the target dies.
  - A kill drops meat; `huntCarryMeatEnabled` carries some home.
- **Group hunts:** several hunters on one animal are several individual choices, which rule 4 allows.
- **Fallback:** today's adjacent roll stays when pursuit is off.

**Switches:** `herdFlockEnabled`, `herdMigrationEnabled`, `pursuitHuntEnabled`.

**New state:**
- `huntTarget` (Uint32) and `huntTicks` (Uint8) per person: add to `PERSON_FIELDS`, bump `SAVE_SCHEMA`.
- `heading` per animal.
- A chase activity code (`src/sim/activity.ts`) so a running hunter shows the spear pose while moving. The viewer needs a running-with-spear frame in `src/render/sprites.ts`.

**Targets:**
- Kill distance from water up, meat share of meals up, herd displacement per year up.
- **Hard condition:** herds and wolves survive 50 years on every seed. Pursuit is far more effective than today's roll, so start with a low strike chance and a real sprint cost.

**Speed:** the prey search runs only for hungry, uncommitted people, staggered. Measure perf.

**Open questions for the user:**
- Should wolves and people compete for carcasses?
- Should any stone in hand still help strikes, or only flint (after W3)?

**STOP:** watch.

## 8. W4: floods and fire (held for the end)

These are roadmap stages 6b-3 (floods) and 6b-2 (wildfire, parked on branch `phase-6b-wildfire`, about 220 lines in the sim, no viewer). Weather patterns may be scripted, but their consequences on people stay physical (decision of 2026-11-10).

**Floods (`floodsEnabled`):**
- **Rising:** each spring, and harder in wet years, high-`riparian` land beside fresh water floods for a stretch of ticks (a `flood` timer; `isWater` unchanged).
- **Effects:** flooded tiles cost movement, drown standing food, wash away heaps and wear built tiles.
- **Aftermath:** silt raises fertility afterwards.
- **Without weather:** a mild yearly pulse happens even with weather off.

**Fire (`wildfireEnabled`):**
- Revive the branch: lightning from storms (so it needs `weatherEnabled`), spread through dry fuel downwind, burn costs, a scorch timer, and ash fertility, so burned ground regrows lush and draws W2's herds.

**Viewer:** use the reserved bits 2 to 7 of the `landWeather` channel for flooded and scorched. Draw floods as shallow water over grass, scorch as black and grey that greens over time, and smoke from live fires.

**Chronicle (6b-4):** flood, fire and drought detectors, observer only.

**Targets:**
- Each event happens in a typical run and leaves marks.
- Camps beside water move uphill during floods and come back afterwards (settlement centre elevation, before, during and after).
- Herds gather on burned ground within a season.
- No die-outs.

**STOP before starting W4. Ask the user:**
1. Should weather be on by default? It changes the default world, the fingerprint and every visual baseline.
2. Can floods kill, or only cost? The draft says costs only.

## 9. Handoff prompt for the other chat

Paste this to start:

> Run the watchability plan in `docs/WATCHABILITY.md` (it is on `main`, or on branch `claude/busy-mccarthy-vw1tsc` if not merged yet). Read `AGENTS.md`, `CLAUDE.md`, the STATUS handoff and the work board first. Start with W0 (the read-only watch probe), follow section 2 for every stage, and stop at each STOP to show me results. Don't merge anything to `main` without asking me.
