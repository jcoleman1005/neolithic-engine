# Neolithic Engine — Status

## Handoff (2026-11-12): read this first
- **2026-11-13, the bank fixes are built and on by default (branch `watch-w1a-abundance`, on top of `watch-w0-probe`; NOT merged; waits for the user's watch, rule 13).** User decisions in `docs/decisions.md`; tables in `docs/findings.md` ("The walk back after drinking").
  - **What changed in the sim:** `shoreScentEnabled`, `shoreSlideEnabled` (food scent no longer points people into the water), `founderWaterReachEnabled` (founders only where fresh water can be walked to), `thirstReturnEnabled` (after drinking, walk back to where thirst found them; per-person `homeX`, `homeY`, `homeState`, `homeTicks`; `SAVE_SCHEMA` 5). All four on. With all four off the old fingerprints come back (`dbeaac54ed27afd8`, `453f741794e836ee` with weather). New defaults: `bc2e5165908de31a`, `b50f6c93e5e62260` with weather.
  - **Effect (seeds 1 to 3):** adults within 5 tiles of water 87 / 84 / 88% → 69 / 59 / 71% at 30 years; three to four times as many beyond 10 tiles; population at year 30 9,040 / 10,330 / 8,627 (W0: 5,494 / 5,119 / 6,034); at 50 years the land is 88% full and `harvestOfMaxYield` is 0.35 to 0.39. Hunger 15 to 16% at 50 years (W0 11 to 12%). No die-outs.
  - **Not migration:** camps don't move more and there are still no migration entries. That needs W1b (ripening wave) and W2 (herds).
  - **Checks:** `VERIFY_VISUAL=1 npm run verify` exit 0 on fd68bb1; perf 3.522 µs per person per tick at 14,358 people. Visual baselines 02 to 08 regenerated on purpose (the user should look at them). Two band-setup tests now run 1,200 ticks; two parity tests list the new switches as off.
  - **What you'd see (rule 13):** people spread inland instead of lining the water, trails worn between camps and the nearest water, and people walking out and back along them.
  - **Open:** why half of adults are still within 2 tiles of water; thirst that food can outlast (not fixed, user decision); W1a's grass re-tune is not shipped; next stage is the user's choice (per-head stay check, then W1b).
- **2026-11-13, what holds people at the bank (branch `watch-w1a-abundance`, not merged): diagnosed; one glitch fixed behind switches that are off; waiting for the user.** Tables in `docs/findings.md` ("What keeps people at the bank").
  - **Main cause, a design flaw:** the thirst walk is a ratchet. A thirsty person walks straight to water; a step taken when not thirsty has no direction; thirst returns every 100 ticks. Founders placed evenly are 56 to 67% within 2 tiles of water after one year. The bank is not preferred: births are lower and starvation higher there.
  - **Glitch, fixed but off:** food scent spreads over water, so at a bare bank it points into the river and hungry people stand facing it (starving adults: 23 to 43% of decisions). `shoreScentEnabled` and `shoreSlideEnabled` (both off by default; `src/sim/rules.ts`, `tests/shore-scent.test.ts`). With both on, population at year 30 is 18 to 30% higher (35 to 38% on scarce land); where people live does not change.
  - **Not fixed:** 1 to 8% of land has no walkable route to fresh water and founders are placed on it; and a person on good grass can outlast zero hydration.
  - **Checks:** `VERIFY_VISUAL=1 npm run verify` exit 0 on ed97c0d; fingerprints with the switches off unchanged (`dbeaac54ed27afd8`, `453f741794e836ee` with weather); both on gives `b5e3ddb6a7686d39`; perf 4.201 µs per person per tick at 13,854 people.
  - **Proposed next:** a walk back after drinking (the central-place return trip), then the per-head stay check; and turning the shore fix on by default. All need the user's say.
- **2026-11-13, watchability W1a: 7 read-only rounds done, stopped for a decision (branch `watch-w1a-abundance`, off `watch-w0-probe`; neither merged).** 89 runs on command-line overrides. No default changed, no switch added, no simulation file touched. Full tables in `docs/findings.md` ("W1a round 1" to "W1a summary").
  - **Scarcer grass gives fewer people, not travel.** Land stays 90 to 93% full; population at year 30 falls from 5,100 to 6,000 to 470 to 2,900.
  - **People live in dense camps on bare ground by the water** (6 to 9 to a tile; 86% of adults within 5 tiles of fresh water), fed from heaps. `scripts/move-probe.ts` shows what the step rule decides and why.
  - **No existing setting produces travel:** 25 levers and combinations, best net movement 13 to 14 tiles a year against 8, zero migration entries anywhere. Movement is a random walk; thirst resets it to the bank.
  - **Water reach is the big lever:** scarce land with thirst off puts 55 to 64% of adults beyond 5 tiles and raises population 70 to 85%.
  - **Checks:** `VERIFY_VISUAL=1 npm run verify` exit 0 on 2896e19; fingerprints unchanged (`dbeaac54ed27afd8`, `453f741794e836ee` with weather). Perf not re-run (no simulation file changed since W0's 4.057 µs).
  - **Recommendation waiting on the user:** don't ship W1a's re-tune alone; do water reach (W3 wells or further-carried water) before or with W1b's ripening wave.
- **2026-11-13, watchability W0 done (branch `watch-w0-probe`, not merged): waiting at the STOP before W1a.** The read-only watch probe is `scripts/watch-probe.ts` (`npm run watch-probe -- --seed 1 --years 50 --report 30`); the measuring is in `scripts/watch-probe-lib.ts`, and `tests/watch-probe.test.ts` checks it changes no outcome. No simulation file changed. The baseline table is "W0 baseline" in `docs/findings.md`.
  - **Baseline (seeds 1 to 3, 30 years):** land 94 to 96% full; adults move 8 tiles net a year; 62 to 67% of adults within 2 tiles of water; people and herds eat 15 to 20% of the land's best possible yield; 9 to 12 productive tiles per person; no migration entries.
  - **Checks:** `VERIFY_VISUAL=1 npm run verify` exit 0; fingerprints unchanged at 1800 ticks (`dbeaac54ed27afd8`, `453f741794e836ee` with weather); perf 4.057 µs per person per tick at 13,854 people (3.993 before).
  - **Three things the user must decide before W1a:** `campStayMedian` is already 17 to 21 ticks (inside W1a's 14 to 40 target); `harvestShare` as planned is 1.00 by construction; wolves already die out on seed 1 by year 20. Proposed replacements: `campStayTimeMedian` (about 160 ticks today) and `harvestOfMaxYield` (about 0.17 today).
- **Next (2026-11-13):** run the watchability plan in `docs/WATCHABILITY.md`, stage by stage from W0 (the watch probe). Section 9 there is the handoff prompt. W4 is held for the end.
- **2026-11-13:** merged to `main` (c725b1d): watchability #3 (an observer-only activity byte per person, with poses and event pops) and the GBA-inspired palette (on by default; Original in the pill menu). The user watched both on the phone. Verify green with the visual check, and fingerprints are unchanged (`dbeaac54ed27afd8`, and `453f741794e836ee` with weather on, at 1800 ticks). Next options from the user's list: watchability ideas 1, 2, 4 and 5 (Parking lot), and the interface panels in the palette.
- **Where the code is:** `main` (5b12054) holds S0 to S3 settlements, S3a building and wall crossing on by default, place cost (off), the S3 viewer art, smooth marks and pinch zoom, the Features panel (every `*Enabled` switch in Settings; `src/ui/feature-switches.ts`, and a test fails if a switch has no entry), and Phase 6b-1 climate and moisture (`weatherEnabled`, off by default, closed after the user's watch).
- **Paused or parked:** S4 and social emergence (environment first, `docs/decisions.md` 2026-11-10); the fight action-potential idea (Parking lot, Phase 7); 6b-2 wildfire (branch `phase-6b-wildfire`, unfinished, not merged). Experiments not merged: `exp-patchy-food`, `exp-winter` (results in `docs/findings.md`).
- **Decision waiting on the user:** what comes next. Options given: biomes from the 6b-1 climate (recommended), 6b-3 floods, 6b-4 chronicle and legend, seasonal crop ripening.
- **How to work here:**
  - Run the watch server from the main checkout (`/home/jcoleman/Projects/neolithic-engine`) with `npm run server:new`, which starts a fresh world each build in `scratch/live`. The user isn't attached to `data/`, but it is never read.
  - Long sweeps go to Katie's laptop, a Remote Control session (find its current name with ListAgents) that works in `C:\Users\Josh\Projects\`. When it's offline, run them here: 4 cores, a frozen worktree, about 1 hour for 12 sixty-year runs.
  - Probes: `scripts/weather-probe.ts`, `surplus-probe.ts`, `place-cost-probe.ts`.
  - Viewer work goes to the `graphics` agent in its own worktree.
  - Write targets in `docs/findings.md` before running anything.
  - Rules: AGENTS.md 14 and 15, CLAUDE.md, and up to 8 tuning rounds.

## Viewer: GBA-inspired palette replaces the 30-colour one (branch `claude/busy-mccarthy-vw1tsc`, 2026-11-13)
- **Choice:** the user previewed six palettes and chose a GBA-inspired one, designed here, with the sand toned down. Preview patches for the others are in the session scratchpad and are not committed.
  - The six: the 30-colour build below, a 46-colour palette, a 256-colour palette, a muted 32-colour palette, a bright 32-colour palette (first as given, then toned down), and the GBA-inspired one.
- **The palette (34 colours):**
  - Built on Game Boy Advance rules without copying any game: every channel a multiple of 8 (15-bit colour), saturated colours, hue-shifted ramps (shadows lean blue or purple, highlights yellow), and a navy outline `#101828` instead of black.
  - The ramps: greens `#104830` to `#b8e870`, blues `#182868` to `#a8e0f8`, yellows `#a85828` to `#f8f8d0`, earth, reds, skin, purples and cool greys.
  - Two muted sand tones (`#d8c088`, `#b89860`) were added for the toned-down sand.
- **Hand picks:**
  - Grass `#40a048`, sand `#d8c088`, deep water `#182868`, rock `#8890a8`, soil `#703020`.
  - People: men blue, women red, pregnant women pink, children yellow, elders grey, the starving purple.
- **Overlay:** crop and field tints never land on the two brightest greens (they read as lime) or on the two muted sand tones (faint tilled-soil tints turned into a tan checkerboard on grass). The overlay memo key now scales with the palette size.
- **Pill menu:** Palette: GBA or Original.
- **Measured:** seed 42, tick 400: 98.3% of world pixels are exact palette colours at cell size 4, 97.4% at 16 and 97.4% at 32.
- **Checks:**
  - With `&palette=original`, all 8 visual shots match the pre-palette baselines (commit 89229ec) at 0.000%.
  - The 8 baselines were regenerated in GBA and reproduce at 0.000%.
  - `VERIFY_VISUAL=1 npm run verify` exit 0. No simulation file changed.
- **Needs you:**
  - A look on the phone.
  - Whether the interface panels should follow the palette.
  - Merging to `main`.

## Viewer: the limited 30-colour palette (branch `claude/busy-mccarthy-vw1tsc`, 2026-11-13)
- **What:** the world view draws in a 30-colour palette the user chose (`src/render/limited-palette.ts`). It is on by default. The pill menu has a "Palette" choice, Limited (30) or Original, saved in localStorage; the page reloads to apply it. `?palette=original` in the URL also works. The interface panels are unchanged.
- **How colours get there:**
  - **Picked by hand:** terrain ramps for all three themes (`palette.ts`) and the people's skin, hair and tunics: men light blue, women rust, pregnant women peach, children yellow, elders grey. Also trees, fire, the pops and the band colours (12).
  - **Mapped automatically:** every other colour in the code goes to its nearest palette colour by perceived difference (OKLab). This happens in `hexToABGR` and in a fillStyle/strokeStyle/shadowColor hook on the world canvas.
  - **Image data:** the terrain cache, the terrain and storm sprites and the atlases are snapped before being put on a canvas.
  - **Overlay:** the see-through layer (crops, worked soil, dry grass, paths, building sites) is pre-mixed with the ground under each cell, snapped, and drawn solid. A faint tint is left clear so the ground texture shows.
- **Measured:** on seed 42, tick 400, about 97 to 98% of world pixels are exact palette colours: 98.0% at cell size 4, 97.1% at 16 and 97.6% at 32. The remainder is translucent drop shadows, glows and fades. The original colours give 0%.
  - Cost: a cached canvas colour about 18 ns per set; the terrain snap 2 ms per rebuild (24 ms once, for the lookup table); a full overlay repaint 3 to 4 ms.
- **Checks:** with `&palette=original`, all 8 visual-check shots match the old baselines at 0.000%. The 8 baselines were then regenerated in the limited palette and reproduce at 0.000%. `VERIFY_VISUAL=1 npm run verify` exit 0. No simulation file changed. The visual check now takes `VISUAL_QUERY` (for example `&palette=original`).
- **Known:**
  - The palette's darkest colours are `#303843` and `#3d3333`, so water, outlines and shadows are lighter than before.
  - It has no strong saturated colours, so figures are softer than the original bright tunics.
  - Bluff and wall drop shadows still blend.
- **Needs you:** a look at the phone and desktop in both palettes. Then decide whether the interface panels should follow, and whether the remaining translucent shadows should become solid palette shades.

## Watchability #3: what people are doing, on screen (branch `claude/busy-mccarthy-vw1tsc`, 2026-11-12)
- **Why:** the user found the world dull to watch (`docs/decisions.md` 2026-11-12). Of the five ideas recorded, #3 went first because it changes no outcome.
- **3a (sim, observer only), commit 58e156a:** `People.activity`, one byte per person, not saved or hashed, with no random draws. The low 4 bits hold this tick's action, where a higher code wins: idle, resting, tending a heap, grazing, gathering, eating, fishing, nursing, drinking, building, walking, fleeing, hunting, giving way, fighting. The high bits hold kill, birth, fire lit and hut finished, kept until the next frame. The person frame is 12 bytes (was 11). The server's merge for slow viewers carries unsent events over. Switch `activityViewEnabled` (on).
  - Fingerprints unchanged at 1800 ticks: `dbeaac54ed27afd8` default (also with the switch off) and `453f741794e836ee` weather on.
  - Perf on this machine at about 13,850 people: 4.165 µs per person per tick against 4.223 on `main`.
  - Seed 42, year 8, share of person-ticks: grazing 39%, walking 19%, tending 12%, gathering 10%, resting 8%, idle 7%, nursing 2.5%. Building, drinking, fishing and giving way are each under 1%. In that year: 100 kills, 374 births, 76 fires lit, 180 huts finished.
- **3b (viewer):** five new figure poses per person type (bend, kneel, strike with a spear, sit, hold a baby). A standing person shows their action, held at least 1 s of real time. A fleeing person gets a white alarm mark. Event pops rise and fade over 1.8 s: meat (kill), pink heart (birth), flame (fire), roof (hut). At far zoom, kills and births are red and pink rings. Two legend lines. The capture hook gained a read-only `people()`.
  - Visual baseline 08 was regenerated on purpose: its tiny figures are now posed and the terrain is identical. 01 to 07 pass unchanged.
- **Not built:** 3c camera moments. The camera stays off (user decision, `docs/decisions.md`).
- **Not measured:** browser frame time with the poses and pops.
- **Needs you (rule 13):** at cell size 16 or more, check that bent grazers, kneeling drinkers, sitters in shelter, mothers holding babies and spear-raised hunters are each readable, and that a kill or birth pop catches the eye without cluttering a crowd. At far zoom, check the kill and birth rings. Then decide on merging to `main`.

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
- **Drawing:** open grass and shrub ground (not forest floor, sand, rock, snow or water) gets a tint in the overlay at every zoom: sun-faded (1), khaki straw (2) and dusty brown (3). Up close, about half the dry cells also get straw stubble (2) or cracks (3) from a new atlas row. Storms (viewer-storm-clouds) are a rain cloud passing over the ground: a dark pixel-dithered cloud shadow (five soft circles hashed from where the storm was first seen, peak alpha 0.25) up to cell size 10, with slanted rain streaks inside at every zoom, animated on wall-clock time (static under `prefers-reduced-motion`). Storms carry no id, so `src/render/storm-layer.ts` matches each payload to the last by predicted position and glides each storm over the next 2 s; the drift between payloads gives the wind direction for the rain slant, so no new sim data is sent. All drawn under people. The peek bar reads "· drought" or "· wet year". Two new legend lines.
- **Checks:** fingerprint `72742a7c2443591a` before and after, and `ea5b59bb6c4fa2e9` with `--weatherEnabled true` before and after. Phone page at 4x CPU throttle, cell size 10: 110 to 112 ms of main-thread time per rAF with the weather view off and 113 to 117 ms with it on (the same saved state; already saturated before this change). At cell size 3: 7.7 ms either way.
- **Needs you (rule 13):** on a weather-on world in a drought year, check that dry ground reads as straw and then as dead brown grass, that it is not mistaken for golden crops, and that storms read as rain clouds drifting with the wind (shadow plus slanted rain) without hiding anyone, from far zoom to cell size 10.

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

