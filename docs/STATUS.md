# Neolithic Engine — Status

## Batch of 2026-11-09 (steps 0 to 5)
- **Merged to `main`:** the mid-tick births fix (a782483); S3 viewer art (PR #3); place cost (PR #4, **off by default**, too weak while fights are rare); Phase 5f exposure port (PR #5); wall crossing and burning-tile skip (unit D, built here because Katie's laptop went offline; off by default with S3a).
- **S3a re-run (step 4):** with S3a on, walls form as lines and partial rooms, settlements last longer and villages appear on all 3 seeds; crossing keeps the lines while wearing through huts. Numbers in `docs/findings.md`.
- **S4 draft (step 5):** in `docs/SETTLEMENTS.md`, waiting for your S3 watch. Farming pieces already exist, so S4 starts with a measurement.
- **Needs you:** rule-13 watch of S3 (art + S3a on); whether to turn S3a and crossing on by default; approve the S4 draft; the laptop session (offline, nothing left unpushed that is needed).

- **Visual baselines 07 and 08 regenerated (2026-11-09)** after merging PR #3 on top of the births fix (a782483): the fix moves seed 4's first lone split from tick 8100 to 9060, so both band-following frames changed (92% and 92% of pixels); 01 to 06 pass unchanged. The first visual run failed with `clock.pauseAt: Cannot fast-forward to the past` (the app took over 2 s of page time to boot on first compile); a re-run passed the scenario. Flaky under load; on 2026-11-10 the check gained a warm-up load before the timed page (all 8 shots still pass), which should stop it, though the slow-start case was not reproduced to prove it.

> Historical phase logs are archived in [`docs/archive/status-history.md`](file:///home/jcoleman/Projects/neolithic-engine/docs/archive/status-history.md).

## Viewer: feature switches in the settings (branch `viewer-feature-switches`, 2026-11-10)
- **What:** Settings has a collapsible "Features" section with every `*Enabled` key in the config (79), in 9 groups, each with a plain label, one line of help and its key. There is a search box, a "changed" tag per switch, a per-group count, and "Reset all to defaults". The table is `src/ui/feature-switches.ts`; `tests/feature-switches.test.ts` fails if a `*Enabled` key is added to `DEFAULT_CONFIG` without an entry.
- **Live or new world:** live switches are sent with `setConfig` at once (shared with all viewers). Switches read only when a world is built (`terrainEnabled`, `elevationEnabled`, `cavesEnabled`) are staged and tagged "applies to new worlds"; "Apply and start a new world with this seed" sends `reset` with them, and so do Reset and Random Seed. Herds, wolves and bare rock are read every tick, so they are live, but their help says that animals are placed, and rock's zero food set, only when a world is made. The checkboxes follow the config the host sends back.
- **Dependencies:** a switch whose parent is off is greyed with "needs X" (for example wind shadow needs wind exposure, campfires need cold and nests). Five switches no code reads (`terrainWearEnabled`, `jitterEnabled`, `autoCameraEnabled`, `farmingEnabled`, `ritualEnabled`) are tagged "no effect yet".
- **Checks:** fingerprint `72742a7c2443591a` before and after (no sim change).

## Viewer: 6b-1 weather on the ground (branch `viewer-6b-weather`, PR into `phase-6b-weather`, 2026-11-10)
- **Channel:** new `landWeather` byte per tile from `Land.packWeather` (read only). Bits 0 and 1 are dryness: 3 below `moistureWitherBelow`, 2 below `moistureDryPoint`, 1 below the middle of the dry and wet points, else 0, and water is always 0. Bits 2 to 7 are reserved. It is sent only while `weatherEnabled`: in full with the 2 s overlay, and as 250 ms diffs between. The ground and weather channels now share one `ByteChannelSender` in `host.ts`, and the server merges both kinds of diff for slow viewers. Storm centres (tile x, y pairs) and `yearKind` ride the overlay.
- **Drawing:** open grass and shrub ground (not forest floor, sand, rock, snow or water) gets a tint in the overlay at every zoom: sun-faded (1), khaki straw (2) and dusty brown (3). Up close, about half the dry cells also get straw stubble (2) or cracks (3) from a new atlas row. Storms at cell size 5 or less show as a faint dashed ring, one weather block (16 tiles) in radius, with a 10% wash, drawn under people. The peek bar reads "· drought" or "· wet year". Two new legend lines.
- **Checks:** fingerprint `72742a7c2443591a` before and after, and `ea5b59bb6c4fa2e9` with `--weatherEnabled true` before and after. Phone page at 4x CPU throttle, cell size 10: 110 to 112 ms of main-thread time per rAF with the weather view off and 113 to 117 ms with it on (the same saved state; already saturated before this change). At cell size 3: 7.7 ms either way.
- **Needs you (rule 13):** on a weather-on world in a drought year, check that dry ground reads as straw and then as dead brown grass, that it is not mistaken for golden crops, and that the storm rings are visible but faint when zoomed out.

## S4a surplus probe (branch `s4a-surplus-probe`, 2026-11-10)
- **Built:** `scripts/surplus-probe.ts`, a read-only probe. It wraps Land food methods and leaves the sim untouched: fingerprint `72742a7c2443591a` before and after, and a 12-year run has the same state hash as a plain run. 9 runs: default, `pileSpoil 0.002` and `tendingRegrowBoost 0.8`, each for seeds 1 to 3 over 50 years. Table in `docs/findings.md`.
- **Result:** spoilage is not the weak part (11.5% of heap food rots and 77% is eaten). Hunger inside camps is a little below hunger outside. Stores are small: heaps supply about 5% of meals and hold about three days' food per person. Golden fields ring 54 to 72 camps per seed at year 30, but they appear wherever people graze. Of the three arms, only tending regrowth raises population (+11.7% at year 50).
- **Spoilage puzzle:** halving spoilage gives the same or better food, births and hunger per head. The gap changes sign by seed and shrinks from −8.5% at year 40 to −3.8% at year 50, so it reads as early run divergence, not a mechanism. More seeds would settle it.
- **Needs you:** S4b direction. The numbers point at store volume and yield, not spoilage.

## Viewer: smooth marks and builds, pinch anchored (branch `viewer-smooth-pinch`, from the 2026-11-09 watch)
- **Contest marks:** they already ran on wall-clock time in the rAF loop; what read as slow and choppy was a 1 px growth step every ~0.5 s and each mark starting a third of its life in (dated one tick late at 1x). Now they fade in over 200 ms, burst out over 700 ms with an ease-out, hold, and fade from 2 s to 4 s, all in real seconds. Pausing does not freeze them: a mark finishes while the sim is paused.
- **Build progress:** the host now sends the ground cells that changed (3 bytes each) every panel frame at most every 250 ms, with the full 64 KB ground channel still every 2 s. At 1x on seed 42 the diffs average 200 to 230 B (max 520 B) against 87 KB for a full send, so the ground costs the stream about +0.5 KB/s. The server merges diffs (and now contests) for slow viewers instead of dropping them. In the viewer a build ring glides between stages (350 ms), and the overlay repaints only the changed cells.
- **Pinch:** pointer events now track every finger, so a drag no longer fights the pinch for the pan. A pinch zooms about the fingers' midpoint and moving the midpoint pans; a pinch or drag lets go of the auto-camera at once. Wheel zoom anchors on the cursor (unchanged) and ignores sideways swipes. Pure maths in `src/render/zoom.ts` (tests in `tests/zoom.test.ts`).
- **Checks:** fingerprint unchanged (`fa5596d7e60c04ca`). E2E on a Pixel 7 page: the world cell under the pinch midpoint moved 0.02 cells after the change, against 73 cells before.
- **Needs you (rule 13):** on the phone at 1x, check that a pinch zooms where you pinch, that give-way chevrons and fight bursts pop and fade smoothly, and that a wall ring rises in steps you can follow.

## S3x place cost (branch `s3x-place-cost`, unit A)

- **Built:** `placeCostEnabled` (on): per-person `placeCost`, `costX`, `costY`. A clash loss adds the energy lost and a wolf bite adds the bite; a win takes the loot off (floor 0). One region per person within `costRadius`; it fades over `costMemoryTicks`. Inside the region the stay check counts `placeCost / costMemoryTicks` as upkeep, and a shelter holds only while the cold it saves beats that. Children learn from a parent within `careRadius` (`costChildLearn`), or, with none in range, more weakly from the nearest adult (`costAdultLearn`, user decision 2026-11-09). `SAVE_SCHEMA` is now 3.
- **Checks:** fingerprint with `--placeCostEnabled false` equals main at 1800 ticks (`cdd6570302cb9c9f`). Perf 3.976 µs per person per tick (main 3.871).
- **Result:** losers do not leave measurably more (missed target); few adults carry a cost (5 to 6%); population and grazing unchanged; settlements lasting 10 years down 4 to 23%; child deaths slightly up on 2 of 3 seeds. See `docs/findings.md`. Fights are too rare since the contest for the cost to matter much.
- **Next:** the user decides whether to keep it as is, tune it, or switch it off. Wall crossing (unit D) waits for this merge.

## S3 Phase 5f exposure port (branch `s3-exposure-port`, unit C)

- **Built:** three switches, all on by default.
  - `exposureRaysEnabled`: a tile with a wall or cave within 4 tiles N, S, W and E drops to indoor exposure 15.
  - `windShadowEnabled`: a wall, cave, wood or rise within 3 tiles upwind drops it to 115.
  - `hearthAnchorEnabled`: the settlement observer counts walls of durability 30 or more as built.
  - The first two act only while `exposureEnabled` (off by default) is on.
- **Checks:**
  - **Fingerprint:** with defaults, unchanged from main (`fa5596d7e60c04ca`).
  - **Tests:** exposure and settlements tests added. Full suite 371 of 371; `npm run check` and `npm run build` exit 0 (run directly, because `verify.sh` won't parse with CRLF line endings on Windows).
  - **Perf with exposure on:** 4.05 to 4.34 µs, against 3.96 without the new code.
- **On the map:** nothing changes yet, because no rule reads exposure. Camp counts at year 30 on seed 1 are unchanged (47, 11, 5), and camps lasting 10 years rise from 34 to 36. See `docs/findings.md`.
- **Next:** S3b, which makes exposure matter (shelter and cold). After that, decide whether rays should require a closed room and whether walls need a hearth to anchor a camp.
## S3 art: contests, building, earth walls, carry marks, paths (branch `viewer-s3-art`, unit B)

Viewer work for the 2026-11-09 watch, which found building and fights unreadable. Fingerprint unchanged (`fa5596d7e60c04ca` before and after).

- **Fight and give-way marks.** `ContestLog` (`src/sim/contest-log.ts`, one per Land, observer only: not saved, not hashed, no random draws) keeps an even per-tick sample of contests: up to 4 fights and 3 give-ways a tick, picked by a hash of count and tick. A busy tick holds 60+ contests, so a plain ring only ever showed the last tick. The host sends what is new with every panel frame (`contests`), not only every 2 s with the overlay, so a mark shows while the two people are still there. The viewer draws a red and yellow spark burst for a fight, light-cyan chevrons parting for a give-way and amber chevrons for conceded food. Marks sit on the ground under figures, at full strength for 2 s, then fade out by 4 s. At far zoom they span about 20 px.
- **Building in progress and earth or stone.** The ground channel (`Land.packPaths`) had three free bits. It now carries build progress on a tile that is not yet a hut (bits 3 and 4: thirds of `hutDurability`) and packed earth (bit 5). Close up, an in-progress tile is an open ring of one, two or three courses with loose material on the floor. Far away, it is a clay or stone tint. Finished walls are drawn in a new `earthWall` clay ramp or in stone. Limits: a ruin washing away below `hutKeep` looks the same as a wall going up (the legend says so), and a wall's material arrives with the 2 s ground channel.
- **Carry marks.** Each load has its own outlined shape and colour: a seed pouch, a food bundle, crossed sticks for brush, a grey block with a highlight for stone, a basket of earth, and a blue skin with a glint for water.
- **Dirt paths.** Close up, each worn tile is a trodden strip joined to its worn neighbours, wider and rutted as wear rises. The far-zoom tint is unchanged.
- **Checks:** `VERIFY_VISUAL=1 npm run verify`: ok on check, test, build and visual-check. Baselines 07 and 08 were regenerated on purpose; only the new path strips changed them. `npm run perf`: 7.205 µs per person per tick at about 13,800 people. Browser frame time was not measured.
- **Watch for (rule 13):** red bursts where bands meet, and cyan chevrons near crowded camps. Open grey or clay rings beside finished walls in a settlement. Clay-coloured huts where earth building is going on. Blue water skins on people walking from the shore. Tan trails linking camps.

## Save version check (branch `claude/visual-verification-setup-x8cmbi`)
- **Done**:
  - Saves carry `schema` (`SAVE_SCHEMA`, now 3 after the S3x place cost, in `src/sim/world.ts`). A build refuses a save with a higher schema. Saves with no stamp still load.
  - `People.importState` refuses a save whose people carry a field this build does not know (`PERSON_FIELDS` in `src/sim/people.ts`, exhaustive against `PackedPerson` at compile time, so a new field fails `tsc` until it is registered). `mateSlot` is allowed as a legacy name.
  - At server start a refused save stops the server and leaves the file untouched (autosave begins only in `listen()`).
  - `tsconfig.server.json` no longer type-checks `scripts/capture.ts` and `scripts/visual-check.ts`, so `npm run server` builds without Playwright installed.
  - `main` merged in with no conflicts; the six S3 person fields (`fear`, `fearX`, `fearY`, `restTicks`, `confidence`, `confTick`) are registered and schema went 1 to 2.
- **Measured** (cloud container, not the S21; earlier figures in this file are from other hardware):
  - `VERIFY_VISUAL=1 npm run verify`: `ok check`, `ok test`, `ok build`, `ok visual-check`.
  - Perf: **3.852 µs / person / tick** at 13,811 people (53.202 ms/tick; desktop budget: <= 15.0 µs). One run, no before-merge baseline.
- **Watched (Rule 13), by the user on this branch's build, 2026-11-09**: people spread normally across the map (the earlier edge and axis pile-up was an old server still on port 8080). Seen: food mounds piling up, crops growing, hunting, wolves near people, stone huts, and probably some walls forming. Not seen: campfires, carried water, any wolf attack, any visible sign of turmoil. No roadmap boxes are ticked from this: the campfire, wolf-behaviour and closed-room checks are not established.
- **Headless check** (`scratchpad/watchprobe.ts`, default config, seeds 1 to 5, 15 years, sampled every 30 ticks; read-only, it counts `land.ignite` calls): 112 to 153 fires lit per seed (first at year 0.7, 11 to 20 burning at once); 167 to 343 people carrying water at once, but only 4 to 5 water-store tiles at once (63 to 86 units stored at peak); 19 to 37 huts and 59 to 74 wall-like cells; wolves took 30 to 178 herd animals and killed 0 to 2 people. So fires and carried water do happen in the sim. Wolves bite only a person with nobody else within `wolfLoneRadius` (2) of them, and strike herd prey first, so few attacks on bands is by design.
- **Closed finding (2026-11-09, your decision)**: fires and carried water happen in the sim but were not seen in the viewer. Likely causes are brief fires, few store tiles and small carry marks. Accepted for now; unit B gives carry marks a clearer look.
- **Not done**: a real `data/` save has not been loaded against the new check; the S21 perf check (30 µs budget) is still open; no further Rule-13 watch.
- **Next**: bump `SAVE_SCHEMA` and add to `PERSON_FIELDS` whenever a save gains per-person state; settle the open finding above.

## Persistent-walk jitter (branch `ccr-72645d63-0n3gjg`, shelved)
- **State**: `src/sim/jitter.ts`, its test and six `jitter*` tunables stay in the tree, **unused and off** (`jitterEnabled: false`). `Rules.climb` and `life.ts` are back to the original; the wiring is saved as `scripts/probes/jitter-wiring.patch` (`git apply` it to retry). Default fingerprints are unchanged.
- **Why shelved**: measured as a behavioural no-op (see `docs/findings.md`); roaming pressure from the land is in the Parking lot. Probes and ideas: `scripts/probes/README.md`.

## AI Context & Token Reduction Pass (merged to `main`)
- **Done**:
  - Eliminated root `Roadmap.md` duplicate (canonical roadmap remains `docs/ROADMAP.md`).
  - Pruned dead `src/core/` legacy code (~940 lines: `world.ts`, `config.ts`, `ledger.ts`, `hash.ts`, `brain.ts`, `noise.ts`), eliminating dual-symbol collisions with `src/sim/`.
  - Relocated active naming logic to `src/sim/naming.ts` and updated all import sites (`bands.ts`, `chronicle.ts`, `settlements.ts`, `tests/naming.test.ts`).
  - Archived 250+ lines of historical status logs into `docs/archive/status-history.md`, keeping `docs/STATUS.md` under 40 lines (saving ~9,000+ startup input tokens per AI turn).
  - Added `docs/ARCHITECTURE.md` as a concise (<50 lines) directory and system map for agent orientation.
  - Added `.cursorignore` and `.ignore` and updated `.claude/settings.json` to block search ingestion of `scratch/**` (17MB) and `.worktrees/**`.
  - Added `npm run test:fast` alias for fast dot-reporter test feedback; updated Rules 1 & 3 in `AGENTS.md` to prevent unnecessary token dumps on targeted tasks.
  - Verification: `ok check`, `ok test`, `ok build`. Perf: **8.35 µs / person / tick** at 8,739 people (desktop budget: 15.0 µs).

## Verify Speed-up (`perf/test-suite-optimizations` merged to `main`)
- **Done**:
  - Test files now run in parallel (`vitest.config.ts`: forks pool, cores − 1 workers, `VITEST_MAX_WORKERS` override, timeout 300 s; dropped per-test `120000` overrides that pinned the old value).
  - Build step in `verify.sh` calls `vite build` directly, eliminating duplicate `tsc -b`.
  - Added event-loop yields to long sync test loops (`bands.test.ts`, `chronicle-observer.test.ts`).
  - Pruned gratuitous over-simulation across 17 test suites (e.g. `away-view.test.ts` 2,400 ticks -> early break at tick 419; `farming.test.ts` 6,000-step soil recovery loop -> 100 steps; `chronicle-observer-part2.test.ts` 2,400 ticks × 2 -> 600 ticks; `bands.test.ts` 2,500 ticks -> 600 ticks; save/restore lockstep loops calibrated to 40-50 ticks).
- **Measured**:
  - Full `npm run verify` suite runtime dropped from **~24 minutes** (serial baseline) to **7m 32s** (~68% reduction).
  - Test CPU user-time dropped by ~6 CPU minutes.
  - All 42 test suites / 275 tests passing cleanly.
  - Perf benchmark: **8.29 µs / person / tick** at 8,536 people (desktop budget: 15.0 µs).

## Active Phase: Phase 5e (Golden Crops & Active Farming Tending — merged to `main`)
- **Status**: Completed & verified; merged to `main`.
  - **Ripening & Art**: Cultivated cells (`farmLevel >= 2`, `tilled >= 0.05` or `seeds > 0`) ripen to golden fields (`COLOR_SEEDS_RGB = 0x28c8f0`) at food capacity >= 0.70. Tuned `cropRipenMinFarmLevel` to 2 to eliminate premature wild grass ripening from single bites, and lowered overlay alpha (50% ripe sheen). Added procedural wheat stalk rendering (`D_CROPS = 15`) with slender stems, golden ears, awn whiskers, and wind sway.
  - **Stone & Nutrients Fix**: Enforced that mineral stone cannot provide nutrients: rock/stone cells are barren (`maxFood = 0`, `fertility = 0`, cannot be grazed or seeded, switch: `stoneBarrenEnabled`). Fixed bug in `life.ts` where carrying stone was transmuted into seeds (`CARRY_SEED`) during grazing meals.
  - **Active Tending**: Gentle harvesting raises `tilled` (`+0.03`); tended soil (`> 0.25`) gets +40% regrowth boost; fallow decays via `tillDecay`.
  - **Hillside Cave Generation Fix**: Restricted natural cave generation in `initCaves` to true cliff faces and hill slopes with an uphill retaining wall (`nh >= h + 0.015`) and downhill drop (`nh <= h - 0.015`), eliminating standalone caves in flat plains.
  - **Child Leader Bugfix**: Enforced Primitive 24 maturity gate in `scoreAttraction` (`if (!isAdult) return 0;`) so children cannot be chosen as band leaders or attract followers. Cleared stale child leadership on copy, inherited maternal leadership for newborns born to band leaders, and suppressed `star_leader` rendering on `LOOK_STAGE_CHILD`.
  - **Invariants**: Energy ledger verified with 0 violations over 300+ ticks; off-switch parity verified.
  - **Perf**: **9.71 µs / person / tick** at 8,536 people (82.86 ms/tick; desktop budget: <= 15.0 µs).
  - **Verify**: All test suites passing, production build passing.

## Current Health & Performance (Desktop)
- **Perf**: ~5.0–6.0 µs / person / tick across ~8,500–11,500 people (desktop budget: 15.0 µs).
- **Verify**: `npm run verify` passing (check, tests, production build).
- **Fingerprint**: `b11b505bedb2a659` (off-switch baseline parity preserved).

## Next Steps
1. Visual inspection in browser on desktop & phone (Rule 13) for Golden Crops & wolf chases.
2. Phase 5f (Structures, Stone & Closed Rooms) or Phase 6b (Weather & Disaster).
3. Combined tuning pass: wounds, population, childcare share, nest caps.

## Settlements plan (branch `settlements-s3`, not yet merged)
- **On `main` already:** T0 tools, S0 settlement labels, S1 staying pays, S2 paths.
- **On this branch:** S3-pre packed earth; the S3a layout test (exposure, directional building; off until reviewed); S3w carried water and adjacent stores; the shore tests (hunger search, far sight); S3x turmoil: slow healing, and the contest (fights weighed against a real stake, the odds and the cost; the weaker side yields). The first fear design was built, measured and replaced (off). `main` was merged in on 2026-11-07: with the contest on, it decides whether to fight, and `main`'s resource gate and courage retreat apply only with it off. `main`'s lethality, looting and casualty reports apply either way.
- **Results:** the contest cuts fights about 99% and the wounded share from about 90% to about 5%, and population at year 50 is about 35 to 40% higher (measured before the merge, against the old gate; to be re-measured against `main`'s resource clashes). Perf 7.2 µs per person per tick at 13,924 people, before the merge.
- **Contest refinements built** (residence, concession, match cost, self-assessment), each with a switch. Against `main`'s resource clashes: about 100 times fewer deaths in fights, wounded 3 to 4% against 18 to 24%, and 30 to 80% more people at year 50. Each refinement on its own is small (`docs/findings.md`). Perf 7.4 µs on the merged code.
- **Next:** the place-cost memory, then the S3a re-run. Open: full `npm run verify` on a quiet machine, the rule-13 watch, the inspector showing wounds and place cost, and the end-of-plan tuning, including whether the world is now too peaceful. Details in `docs/SETTLEMENTS.md` and `docs/findings.md`.

## Rule-13 watch on the merged code (2026-11-09, by the user)
- **Build:** `main` at 77dd8cd (settlements S0 to S3 merged) on port 8080, a new seed-1 world aged headless to year 20 (`scratch/watch` in the structures worktree; the user's `data/` world untouched).
- **Passed:** S0 far zoom (named camps, cards, chronicle), S1 staying put, S2 worn trails. Trails read, but not intuitively; a dirt-path sprite would help.
- **Not readable: building.** Cause found: the viewer draws a built tile only once it reaches hut strength (durability 60, `Land.packFeatures` kind 8 + level). Earth or stone being built up (1 to 59) is not sent at all, so mounds are invisible, and a finished hut uses the same cut-away wall art whether it is earth or stone. At year 20 this world had 87 built tiles, 82% standing alone, so they read as scattered single pieces. Queued as art work in `docs/ROADMAP.md`.
- **Carrying:** the user saw people carrying something brown that later turned grey. That is brush (`#8a5a2b`) or earth (`#6b4a2e`, nearly the same brown), then stone (`#9a9a9a`) after setting one load down and picking up another: normal, but brush and earth are hard to tell apart. No blue (water) marks were reported.
- **Fights (S3x): none seen.** The viewer has no fight or give-way display (clash animation is still in the Parking lot), and contests mostly end without a fight, so S3x cannot be judged by eye yet; the only visible trace is a grave mark.
- **Not yet watched:** carried water and stores (S3w). The earlier watch on the pre-merge build did not see carried water or campfires either; see the open finding above.
- **Verify after fast-forwarding to `main` (42fcc73):** `ok check`, then `FAIL test` with 357 of 357 tests passed and one unhandled Vitest error, `Timeout calling "onTaskUpdate"`. `scripts/patch-vitest.js` exists for this (commit dd705f8) but nothing runs it: there is no `postinstall` in `package.json`, and the installed `rpc.-pEldfrD.js` is unpatched.

