## Phase 7 Foundations: Combat Courage & Battlefield Looting (merged to `main`)
- **Done**:
  - Built **Primitive 78 (Carried Loot Transfer)**:
    - Victor in an unallied clash claims the loser's carried item (`people.carryKind`, `people.carry`).
    - If victor's hands are empty or holding the same item, they loot up to their body capacity (`maxCarryCapacity`), and excess drops to the land.
    - If victor's hands hold a different item, the loser's carried goods are knocked loose onto the ground (`land.dropFood`, `land.dropSeeds`, `land.dropBrush`, `land.build`).
    - Loser's hands are completely stripped.
    - Switch: `clashLootEnabled`.
  - Built **Primitive 76 (Tactical Courage & Honest Physical Retreat Costs)**:
    - Before blow exchange, outmatched fighters calculate ally-adjusted combat power and compare odds against `GENE_BRAVERY`.
    - Timid individuals facing overwhelming odds disengage safely (`Rules.retreatStep`) before taking full clash damage or losing body energy to the victor.
    - Physical costs of fleeing:
      1. Sprint exertion: movement energy cost (`1.5 * moveCost`) booked to `ledger.move`.
      2. Adrenaline exhaustion: `+6` fatigue added to fleeing coward.
      3. Glancing scrapes: takes `20%` clash injury scaled by aggressor's cruelty and belligerence (parting strike).
      4. Cargo panic drop: carried goods exceeding `3.0` units are dropped onto the land tile to sprint away unencumbered.
    - Deposits mild danger scent and grants `HABIT_CAUTION` experience. Fearless fighters stand and clash even when heavily outnumbered.
    - Switches & tunables: `clashCourageEnabled`, `courageOddsThreshold` (0.35), `clashRetreatMoveMul` (1.5), `clashRetreatFatigue` (6), `clashRetreatInjuryMul` (0.20), `clashRetreatDropThreshold` (3.0).
  - Fixed lethal combat energy accounting: remaining positive energy in victims killed by trauma collapse is booked into `ledger.deathFat`, preventing ledger residual violations.
  - **Invariants & Ledger**: Energy ledger verified with zero violations over 300+ ticks (`ledger.violations === 0`). Strict off-switch fingerprint parity verified (`3846cf0469ad880d`).
  - **Tests**: `tests/clash.test.ts` (all 6 tests passing: victor loot claim, full-hands ground drop, outmatched coward retreat with physical exertion & panic drop, brave last stand, off-switch parity, multi-generation energy balance).
  - **Perf**: **12.12 µs / person / tick** at ~8,347 people (well within desktop 15.0 µs budget).
- **Next**: Proceed to Phase 5e golden crops or S3 review.

## Resource-Motivated Clashes & Battlefield Fatalities (merged to `main`)
- **Done**:
  - Audited combat resolution and resolved the zero-casualty phenomenon:
    - Replaced abstract personality friction with material stakes (hunger vs food/supplies, carried food, food heaps, and crowded cold shelter) via `resourceClashEnabled`, `clashHungerThreshold` (35.0), and `clashContestedResourceBonus` (1.5). Peaceful or moderately belligerent strangers without stakes no longer fight.
    - Added strength-scaled flat strike energy damage (`clashFlatDamage: 6.0`, delivering 3.0 to 6.0 flat damage) and severe trauma collapse (`clashLethalInjury: 220`), enabling decisive fatal blows against starving or critically wounded combatants.
    - Fallen combatants drop carried food to `land.pile`, mark death sites, and register casualties (`fell: 1`) in `Rules.clashLog`.
    - Updated Chronicle battle reports (Option B): reports actual casualties when warriors fall (`"${fell} fell (${fellA} of the X, ${fellB} of the Y)"`) and distinguishes non-fatal engagements (`"driven off without fatalities"`).
  - **Simulation Results** (5 years, seed 42): Clashes dropped from 19,078 constant bumping scuffles down to 3,008 meaningful engagements, while combat deaths increased from 3 (0.015%) to 412 (13.70% fatality rate when fighting over survival).
  - **Invariants & Ledger**: Energy ledger verified with 0 violations (`ledger.violations === 0`) across 1,000+ ticks; exact off-switch parity with `resourceClashEnabled: false`.
  - **Perf**: **6.44 µs / person / tick** at ~7,700–10,000 people (budget 15.0 µs).
  - **Type Check & Build**: `tsc -b && vite build` passed cleanly in 3.39s.
- **Next**: Merged to `main`.

## Settlements plan: S2 paths (branch `settlements-s2`)
- **Built**: each step wears the tile (`Land.wear`, saved; hashed only while `pathsEnabled` is on); worn ground costs up to half as much to step onto, and people lean toward the more worn neighbour. Wear fades one point every 2 ticks. Paths reach the viewer as a new per-tile channel with the land overlay and draw as trodden earth; `npm run map` shows them and reports worn land. Tests `tests/paths.test.ts`.
- **Result** (seeds 1 to 3, year 30): 7 to 11% of land worn, population 91 to 100% of paths-off at year 20. Hamlets or larger at 62% of off on seed 3 (target 80%, missed; tuning deferred to the combined pass). Worn ground mostly bands shores and settlements; few trails cross open land between camps. Tuned `wearStep` 16 to 4 and `wearDecaySlices` 8 to 2 (see `docs/findings.md`).
- **Verify** passes. **Perf** 5.03 µs / person / tick; about 4.7 µs at 2,900 people and 4.9 µs at 2,300. **Fingerprint** with paths off is S1's `09169101e488ff9f`; with paths on `d0a8e5aec4ab7c18`.
- **Checked in a browser**: trodden ground around the largest settlement at cell sizes 4 and 10, no page errors. Needs a person's watch.
- **Next**: S3 starts with packed earth (S3-pre) and the layout spike (S3a), which is a stop point for your review.

## Planimetric Hybrid Aesthetic (branch `art-planimetric-scaffold`)
- **Done**: Fully completed Planimetric Hybrid Aesthetic subsystem (Phases 1 through 5):
  - **Modules**: Created `src/render/palette.ts` (4-tone material ramps, atmospheric haze formula), `src/render/autotile.ts` (47-tile 8-neighbor lookup table, 8x8 quadrant decomposition procedural atlas builder, toroidal bitmask math), `src/render/terrace.ts` (6-tier quantization, bluff drop-shadow masking), and `src/render/walls.ts` (16-tile wall connection bitmasking, cutaway blueprint rendering).
  - **Tests**: Created `tests/render-autotile.test.ts`, `tests/auto-camera.test.ts`, and `tests/no-water-spawns.test.ts` (all tests passing: 256-bitmask canonical mapping, headless canvas safety, tier quantization, bluff drop shadows, monotonic slate-blue depth tint, wall connection bitmasking, zero water spawns across seeds).
  - **Renderer Integration (Phases 1–5)**:
    - Preallocated `terraceData`, `activeElevationSlice`, and `wallOccupancyMask` on `CanvasRenderer` with zero per-frame heap allocations.
    - Wired `buildTerraces(elevation.elevation, this.terraceData)` in `updateTerrainCache()` to quantize elevation into 6 discrete topological tiers and compute hard bluff shadow/crest masks.
    - Painted 4-tone autotiled ground transitions (`PALETTE.*` highlight/base/shadow/rim ramps) and hard 1-2px bluff drop shadows (`rgba(20, 24, 36, 0.45)`) directly into `this.terrainImgData` via direct 32-bit ABGR blitting (`this.terrainData32`).
    - **Elevation Slicing (Phase 3)**: Added tier scrubber dropdown (`All`, `T5`–`T1`) to `PlaybackPill` in `src/ui/controls.ts`, wired through `src/main.ts` to `setActiveElevationSlice()`. In `updateTerrainCache()`, lower tiers receive cool slate-blue atmospheric haze via `applyAtmosphericHaze()`, focus tier remains at 100% saturation, and higher sliced tiers render as subtle blueprint contour wireframes.
    - **Blueprint Walls (Phase 4)**: Wired `populateWallSpatialMask()` and `getWallBitmask()` in `collectFeatures()`. Replaced oblique huts with 1-cell-thick top-down `drawCutawayWall()` sorted on ground plane (`GROUND_KEY + 1`), providing 100% interior room inspectability without roof occlusion.
    - **Grounding Shadows & Particles (Phase 5)**: Added subtle planimetric grounding oval shadows (`rgba(20, 24, 36, 0.30)`) under humanoid figures in `drawPerson()`, and animated 1–2px flickering embers drifting from campfires via `PALETTE.hearthFire` in `drawFire()`.
  - **Dwarf Fortress Steam Pixel-Art Terrain (3 Switchable Options)**:
    - Built [`src/render/terrain-tiles.ts`](file:///home/jcoleman/Projects/neolithic-engine/src/render/terrain-tiles.ts) containing procedural 8x8 pixel-art terrain tiles aligned to the 8-pixel art grid (`ap = cs / 8`).
    - **Solid, Restful Hill Stones & Despeckled Water**:
      - Hill stone tops (Variant 0) redesigned as 100% solid, flat stone floors with zero internal stripes or speckled noise, forming clean restful crags in the middle of hills.
      - Shallows and ocean (Variant 0) redesigned as 100% flat tranquil water (removed all 1px white foam noise dots and harsh caustic speckles).
      - Base grass (Variant 0) remains 100% flat tranquil green for maximum figure readability.
    - **Stepped Z-Level Cliff Strata**: top-down 3D cliff courses along elevation drops (lit top lip, horizontal stone strata, vertical crevices, deep drop shadow, talus rubble).
    - **Shoreline Wave Foam**: translucent wave fringes along water borders touching land.
    - **3 Selectable Themes** in [`src/ui/controls.ts`](file:///home/jcoleman/Projects/neolithic-engine/src/ui/controls.ts) and [`src/render/palette.ts`](file:///home/jcoleman/Projects/neolithic-engine/src/render/palette.ts):
      1. `DF Steam Classic`: warm, earthy, naturalistic frontier.
      2. `DF Mountainhome`: high-contrast granite, basalt cliffs, deep spruce turf, glacial turquoise waters.
      3. `DF Wilds Taiga`: Nordic peat bogs, heather moss, dark shale cliffs, deep navy waters.
  - **Single Bounded Viewport & Continuous Toroidal Simulation**:
    - Disables viewer/camera tiled wrapping: renders a single world canvas centered with dark void borders when zoomed out, and clamped to map boundaries when zoomed in. Zero repeated tiled copies.
    - Simulation remains fully toroidal: units, wolves, and herds wrap seamlessly across boundaries ($x=0 \leftrightarrow 255$ and $y=0 \leftrightarrow 255$).
    - Auto-camera disabled by default on startup (`src/main.ts`, `src/ui/controls.ts`, `src/ui/auto-camera.ts`).
  - **Water Spawn Elimination**:
    - Fixed PRNG coordinate bounds in [`src/sim/herds.ts`](file:///home/jcoleman/Projects/neolithic-engine/src/sim/herds.ts) and [`src/sim/wolves.ts`](file:///home/jcoleman/Projects/neolithic-engine/src/sim/wolves.ts) from `nextInt(0, GRID_SIZE)` to `nextInt(0, GRID_SIZE - 1)` so animal coordinates never hit 256 or wrap onto edge cells $(0, y)$.
    - Enforced strict water rejection for founder people, newborn births, herds, and wolves across both `land.isWater` and `land.elevation.water`. Verified with multi-seed test suite [`tests/no-water-spawns.test.ts`](file:///home/jcoleman/Projects/neolithic-engine/tests/no-water-spawns.test.ts).
  - **Band Leader Hovering Stars**:
    - Added procedural 7×7 golden star sprite (`star_leader`) in [`src/render/sprites.ts`](file:///home/jcoleman/Projects/neolithic-engine/src/render/sprites.ts) with brilliant core and warm amber edges.
    - Rendered gently bobbing golden stars hovering over the heads of band leaders (`rId === idOf(slot)` and `bandSizes > 1`) in both zoomed-in oblique and zoomed-out view modes in [`src/render/renderer.ts`](file:///home/jcoleman/Projects/neolithic-engine/src/render/renderer.ts).
  - **Perf**: **5.11 µs / person / tick** at 11,536 people (well within desktop 15.0 µs budget).
  - **Type Check & Build**: `npx tsc -b` 0 errors; `npm run build` passes in 1.80s.
  - **Fingerprint**: `dd4029850bd6d26e` reflecting fixed boundary indices for animal spawns.
- **Next**: Manual browser watch on desktop / Galaxy S21 to verify single bounded map view, tranquil solid hill stones, despeckled water, and leader stars. Merged to `main`.

## Settlements plan: S1 staying pays (branch `settlements-s1`)
- **Built**: the stay check counts the heap underfoot and the real upkeep of the tile, and roaming, curious people need more to stay (`stayValueEnabled`); a comfortable person resists a leader's pull (`comfortableStayEnabled`); a hut or nest's discount is shared above 4 or 3 people (`tileCrowdingEnabled`); heaps add to food scent (`storeScentEnabled`) and carriers unload at heaps (`storeUnloadEnabled`); huts and nests lead cold people to them (`shelterSeekEnabled`); wolves keep off fire-warmed ground (`fireDetersWolvesEnabled`) and people within 2 tiles protect each other (`wolfLoneRadius` 0 to 2). No new saved state. Tests `tests/staying.test.ts`; new probe `npm run probe`.
- **Result** (seeds 1 to 3, year 30): villages appear (3 / 4 / 2, none before), 16 to 21 hamlets or larger, about 1.9x the people. 4 of 5 targets met; "settlements lasting 10 years at least double" missed on seed 2 (1.4x). Stopped after 3 tuning rounds. Details in `docs/findings.md`.
- **Verify** passes. **Perf** 6.34 µs / person / tick at the perf script's size; about 7 µs at 3,100 people and 11 µs at 2,400 (map-wide passes cost the same at any population). **Fingerprint** with every S1 switch off matches `main` at 1,000 and 3,600 ticks; with S1 on it is now `09169101e488ff9f`.
- **Changed test**: `tests/drives-and-stages.test.ts` pins the pre-drives hash, so it now also turns the S1 switches off; same strictness.
- **Seen, not acted on**: about 90% of people are wounded (mean injury about 180 of 255); people already stayed near heaps before S1, and what churned was the built cells.
- **Next**: you watch villages form (rule 13), then S2 paths.

## Settlements plan: S0 labels (branch `settlements-s0`)
- **Built**: observer `src/sim/settlements.ts` finds clusters of built cells, keeps stable ids and names, and ranks them camp to city. Far zoom shows a faint footprint, a placeholder tier icon and a name (camps named from cell size 4); middle zoom marks only towns and cities. Tap a mark or a row in the new Settlements list for a card. Hamlets and larger get chronicle entries. Switch `settlementTrackEnabled`. Tests `tests/settlements.test.ts`. `npm run map` now prints tier counts and lifetimes.
- **Verify** passes. **Perf** 5.30 µs / person / tick (the perf script does not run observers). **Fingerprint** `c85ce4bc93336df5`, unchanged, and a test shows the same state hash with the observer running.
- **Checked in a browser**: labels at cell sizes 3, 4 and 8 on desktop and phone, tap on a label, click on a list row, no page errors. Needs a person's watch (rule 13).
- **Baseline at year 30, seeds 1 / 2 / 3**: see `docs/findings.md`. No lasting settlements yet: 0 / 1 / 0 hamlets, median life 0.3 years.
- **Changed from the plan**: at far zoom a tap on a label beats a person, since people are single pixels packed around camps and labels could not be tapped otherwise. Elsewhere a person still wins.
- **Open**: the S1 gates need replacing before S1 starts (see `docs/SETTLEMENTS.md`). Seed 1 logs 40 chronicle entries in 30 years against a target of 10 to 30 an hour; 33 of them are not settlements.
- **Next**: you watch S0 and decide the S1 gates, then S1.

## Settlements plan: T0 tools (branch `phase-5h-settlements`)
- **Plan**: `docs/SETTLEMENTS.md` is the plan for settlements, villages and cities. Sim work follows it (see `docs/decisions.md`, 2026-11-05).
- **Done (T0)**: `npm run map` (headless PNGs and a stats line per snapshot; saves a world at any year), `npm run capture` (real-renderer screenshots at chosen zooms on desktop and phone widths, with Playwright installed outside the repo), `npm run fingerprint -- --ticks N` with switches, and `verify.sh` now names failing tests and keeps the log. Tool arguments now reject unknown keys and merged flags, and `--xEnabled 0` really turns a switch off. Tests `tests/tools.test.ts`. Sim unchanged.
- **Verify** passes. **Perf** 5.02 µs / person / tick at 11,313 people. **Fingerprint** `c85ce4bc93336df5` (1000 ticks), same as `main`; `9bf18bbc46385a58` at 1800 ticks is the baseline for off-parity checks.
- **Seen in the first images (seed 1, year 8), not yet acted on**: nearly all activity hugs rivers and shores; about 146 bands among 2,380 people; 18 clusters of 3 or more built cells, the largest 10.
- **Next**: you review T0 and do the overdue watch, then S0 (settlement observer and labels). The agent stops here until then.

## Primitives 18, 24, 28: Body Drives, Life Stages & Strength Work (branch `feat-drives-life-stages`)
- **Done**: Implemented internal dominant drives, life stage cost/yield differences, and strength work scaling:
  - **18 (Hunger Drive)**: In `Rules.climb`, internal body state dictates the dominant gradient. When `energy < hungerDriveThreshold` (35% of max energy), the food scent gradient is amplified (2.5x) while leader pull is dampened (0.25x), ensuring hungry foragers prioritize food over blindly following. Critically starving people (`< 20%`) suppress roaming jitter and halve danger aversion to feed. Well-fed people follow leaders and roam normally. Switch: `bodyDrivesEnabled`.
  - **24 (Life Stages)**: Children (`age < adultAge`) pay lower base upkeep (`childUpkeepMul: 0.7`) proportional to lower body mass, while wild harvests (berries, fish, brush) scale with life stage work capacity (`childWork: 0.6`, `elderWork: 0.8`). Switches: `stagesEnabled`, `stageHarvestScale`.
  - **28 (Strength Scaling)**: `GENE_STRENGTH` scales carrying capacity and work output, including tamping heap compaction (`land.tamp`) via worker `bodyMul`. Switches: `strengthScalingEnabled`, `workStrengthScale`.
  - **Memory & Allocation**: Zero new typed arrays; reused existing `people.age`, `people.energy`, `people.injury`, `people.genes`, `people.carry`, `people.carryKind`. Zero allocations per person per tick.
  - **Determinism**: Exact bit-for-bit baseline fingerprint parity (`881ea265aa76e667`) verified with switches disabled.
  - **Perf**: **5.25 µs / person / tick** at 11,313 people (budget 15.0 µs).
  - **Verify**: `npm run verify` passed (check, 33/33 test suites, 207 tests, production build).
- **Next**: Merge branch to `main`; proceed to Spoilage & Farming Tending (Primitives 5, 9, 41) or Phase 5e golden crops.

## Wolf & Herd Animation Polish (branch `fix-wolf-animation`)
- **Done**: Fixed the wolf (and deer) flip-every-tick bug and added smooth inter-frame interpolation:
  - **Heading Tracking**: Replaced coordinate-parity flip `((cx * 29 + cy * 13) & 1) === 0` with persistent heading tracking based on delta movement. Animals face East when moving right, West when moving left, and preserve their facing when moving vertically or idling.
  - **Motion Interpolation**: Interpolated animal positions `rx, ry` between simulation ticks using `(now - lastFrameTime) / frameInterval` with toroidal wrapping for both close-up oblique sprites and flat zoomed-out dots (`renderHerdsFlat`).
  - **Trotting Gait**: Added a 2-phase diagonal trotting gait for quadruped legs and slight tail bob when moving, returning to a neutral grounded stance when resting.
  - **Memory & Allocation**: Used preallocated Float32Array/Uint8Array tracking buffers (`prevWolfX`, `currWolfX`, `nextWolfX`, etc.) on `CanvasRenderer` with zero per-frame garbage collection allocations.
  - **Fingerprint**: Strictly unaffected (simulation logic untouched).
  - **Perf**: **8.93 µs / person / tick** at 11,313 people (under heavy background load, well under 15.0 µs desktop budget).

## Unified Graphics & Zoom Consistency (branch `graphics-unification`)
- **Done**: Completed visual audit and established shared style rules (NW lighting, SE soft ground shadows `rgba(26, 18, 8, 0.30)`, 8-px art unit `ap`).
  - **Graves**: Retinted flat/zoomed-out marker from crimson `#8a2e22` (which conflicted with animal carcasses) to earth mound `#6b5238` with stick/bone cross `#e6dbbc`.
  - **Brush Heaps**: Added wood fleck markers to the land overlay (`COLOR_BRUSH_RGB = 0x305a7d`, alpha scaled with heap level) so ground brush accumulation on open land is visible before consolidating into a nest.
  - **Wolves**: Brightened zoomed-out dot from `#3c3c46` to `#5c5c68` for direct color linking to the wolf sprite's coat.
  - **Tap Selection**: Centered hit detection on the visual figure centroid `(cx + 0.5, cy + 0.5)`.
  - **Simulation Fingerprint**: Untouched (`881ea265aa76e667`).
  - **Verify**: `npm run verify` passes (type check, all 31 test suites, production build).
  - **Perf**: **5.30 µs / person / tick** at 11,596 people (budget 15.0 µs).
  - **Screenshots**: Could not be captured in headless environment (no Chrome/display server available). Requires a real browser watch on desktop / S21 per Rule 13.
- **Next**: Watch in Chrome to evaluate tap selection and zoom consistency; proceed to Phase 5e golden crops.

## Where things stand (2026-11-05)
`main` has everything below through Phase 5g bodies and childbirth hazards, and is pushed to `origin`. Built but not watched (rule 13): cold, caves and fires; wolves; huts; injury and grave marks; oblique art; fertility; childbirth hazards; bodies. Not built: 5e golden crops; walls and closed rooms.

- **Verify**: type check and build pass; tests 200 of 200 when run alone. One full run alongside other heavy jobs failed one test (not identified, its name was cut from the output) with 3 vitest worker timeouts, so the suite can fail under load: run it on a quiet machine. It takes 8 to 12 minutes.
- **Perf**: **4.63 µs / person / tick** at 11,596 people (budget 15). Fingerprint `881ea265aa76e667`.
- **Merge note**: `phase-5g-bodies` failed verify by itself: two carry-limit tests still asserted the fixed limit. They now check each person's strength-scaled limit.
- **Bodies and childbirth hazards together** (seeds 1 to 3, against both off, same seeds):

| Year | Seed 1 | Seed 2 | Seed 3 |
|---|---|---|---|
| 10 | 2332 vs 2876 (-19%) | 2544 vs 3192 (-20%) | 2348 vs 3037 (-23%) |
| 20 | 2633 vs 3631 (-27%) | 2863 vs 4315 (-34%) | 2515 vs 3615 (-30%) |

**For the tuning pass, not yet acted on:**
- Wounds look too common: seed 1 at year 4 has 1126 of 1658 people at injury 60 or more, mean 145 of 255.
- Population is about 2,500 to 2,900 at year 20, far from the 10,000 to 20,000 aim (3,600 to 4,300 with bodies and hazards off). `npm run perf` reaches about 12,000 only because it starts with 12,500 people and `landFoodMax` 45, so it measures speed at that size, not a world that grew there.
- Childcare's mate share looks ineffective: `mateId` is cleared at delivery, so after a birth the mother usually has no mate on record, and any later mate is from the next pregnancy, who may not be the father. Read from the code, not measured.

## Deterministic Childbirth Hazards (branch `feat-birth-hazards`)
- **Done**: Introduced physical and metabolic childbirth hazards without RNG:
  - Pregnancy upkeep surcharge (+25%, `pregnancyUpkeepMul` 1.25). Severe starvation (`energy <= 15.0`, `pregnancyMiscarriageEnergy`) triggers early miscarriage to preserve maternal life.
  - Delivery inflicts physical trauma directly to `people.injury` (`birthInjury` 40.0). Delivering inside a shelter (nest, cave, stone hut, or near campfire) cuts trauma by 65% (`birthShelterInjuryMul` 0.35); unsheltered delivery in freezing cold exacerbates trauma by up to 1.5x (`birthColdInjuryMul`) and inflicts hypothermic trauma on the newborn.
  - Mothers reaching full term with insufficient energy to deliver safely suffer delivery exhaustion: pregnancy terminates with partial trauma (`birthExhaustionInjury` 20.0) and stamina loss without live birth.
  - Reused existing typed arrays (`people.pregnant`, `people.injury`, `people.energy`) with zero per-person tick allocations. Energy ledger balances exactly (`ledger.violations === 0`). Full off-switch parity with `birthHazardsEnabled: false`.
- **Tests**: `tests/birth-hazards.test.ts` (pregnancy upkeep surcharge, starvation miscarriage, delivery trauma, shelter mitigation, cold exacerbation, failed delivery exhaustion, off switch parity, multi-generation ledger balance and save/restore determinism).
- **Perf**: **4.66 µs / person / tick** at 12,240 people (desktop budget 15.0 µs).

## Mutable Fertility (branch `feat-mutable-fertility`)
- **Done**: `Land.fertility` is now mutable Float32Array: degrades on overgrazing/stripping bare ground down to `fertilityMin` (0.05), improves via passive tending (tilled, seeded, healthy vegetated soil), composting spoiling food heaps, and active tending (seed dropping, tamping) up to `fertilityMax` (1.5). Saved in `LandState` snapshot and verified in `world.stateHash()`. Switch `fertilityChangeEnabled`.
- **Tests**: `tests/fertility.test.ts` (overuse degradation, explicit seed enrichment, tamping, passive tending, off switch parity, save/restore exact stateHash round-trip).
- **Verify**: all 27 test suites pass; **perf** 9.14 µs / person / tick at 14,163 population (budget 15).

## Phase 5c mounds and nests
Phase 5c (mounds and nests) on branch `phase-5c-stigmergy`, built, tested and watched: nests, food heaps and brush heaps read well. `main` (local, not pushed) now includes 5c; fast-forwarded 2026-11-02. Project identity updated: an autonomous colony sim from primitive hunter-gatherers (see `docs/ROADMAP.md` and `docs/decisions.md`).

- **Stockpiles**: well-fed people gather surplus food and unload it where people congregate; hungry people eat from heaps; idle fed people tamp a heap; a big compacted heap becomes a granary floor. Switch `stockpilesEnabled`.
- **Nests**: brush from woodland, unloaded and tamped the same way, becomes a nest that cuts upkeep to 70%. Switch `nestsEnabled`. Code name `nest` (the Stage 1 shelter); `hut` is reserved for dry-stone.
- **Viewer**: food heaps as pyramids of round mixed produce (orange cells zoomed out), granary floors as planks, brush heaps as crisscrossed sticks (zoomed in only), nests as brush lean-tos. Brush is carried out of the woods and unloaded only on open ground, so nests form where people gather.
- **Tools**: `npm run sweep -- --kind farming|stockpiles` (checkpoint warm-up, early abort, per-year progress), `npm run stockpiles`, `npm run farming`.
- **Verify**: see the commit; tests `tests/stockpiles.test.ts`, `tests/farming.test.ts`.
- **Perf**: about 14k people, **4.4 us / person / tick** (budget 15).
- **Known**: nests keep growing (about 100 a year) with nothing limiting them; granary floors marginal at 5 on one seed. Both for the combined tuning pass.

## Finite resources (branch `phase-5-finite-resources`, piece 1 of the port)
- **Done**: trees (finite wood, brush gathering uses it up, slow regrowth) and berries (a hunger top-up). Switch `finiteResourcesEnabled`. Tests `tests/finite-resources.test.ts`. Tuned set G in `docs/findings.md`: pop +3 to +6% vs off, woodland settles near 58%, nests about 390.
- **Verify** passes; **perf** 4.2 us / person / tick (budget 15).
- **Visible**: thinned woodland draws as pale straw; fully stripped stands become stumps (block regrowth for 3 years), then rot to open meadow for good (13% of woodland by year 30). Cleared ground can hold berries but not trees or nests (it keeps the wooded mask). No reforestation yet: a parking-lot candidate. Fish (shore food) and thirst (hydration, walk to fresh water, drink, upkeep when low) are built on `phase-5-fish-thirst`; people now cluster nearer rivers and lakes (mean distance to fresh water 6.5 vs 10.5). Woodland now matches the drawn forest (3199 lowland cells), tree sprites thin with cutting, and a first-tick-after-load bug in the crowd rule is fixed. Next: herds.

## Phase 6a herds (branch `phase-6a-herds`)
- **6a-1 done**: herbivores in `src/sim/herds.ts` (graze, drift, flee, breed, die; own PRNG; plant-side energy; saved and hashed). Herd settles at `herdSoftCap` 300; people within 5% of herds off. Tests `tests/herds.test.ts`. Perf 4.4 us / person / tick.
- **6a-3 viewer done**: herd positions stream with every frame (2 bytes per animal) and draw as tan dots zoomed out and little antlered quadrupeds zoomed in (they snap tile to tile, no interpolation yet). Needs a server restart and a watch. **6a-2 hunting done**: hungry people strike adjacent animals; a kill leaves a food heap at the hunter's feet (looks like any food heap for now). About 46 kills a year at 6000 people; herd holds near its soft cap. Next: 6a-4 wolves.

## World shape (branch `fix-world-shape`, on top of `phase-6a-herds`)
- Fewer lake pockets, more land (64%), hills start higher so about 40% of the map is green, 700 founders, herds no longer drawn in the void when zoomed out, dead-animal graphic at fresh kills. See `docs/findings.md`. Needs a fresh world (reset) to see the new map; saved worlds keep their old terrain.

## Wolves (branch `phase-6a-wolves`)
- **6a-4 built**: wolves wander, chase herd prey, kill and leave meat and a carcass, leave danger scent, take lone people; herds flee them. 12 to 38 wolves over 30 years, about 29 people killed a year, people 5% below wolves off at year 30 (a 12% dip at year 20). Tuning stopped here on purpose; the threat is for later phases to answer. Needs a server restart and a watch.

## Phase 5d cold, caves and campfires (branch `phase-5d-cold`)
- **Built**: a seasonal cold (winter and height) that adds upkeep to anyone unsheltered; 40 natural caves on hill edges; campfires that a cold, resting person lights on a big enough brush heap, which burn the brush down and shelter a 2-tile radius; cold, fed people walk to the nearest cave or fire and stay. Caves are drawn as dark mouths, fires as a flickering flame with a faint warm glow. Switches `coldEnabled`, `cavesEnabled`, `firesEnabled`. Tests `tests/cold.test.ts` (8). Perf 4.3 us / person / tick at 13,680 people. People run 3% / 6% / 10% under cold-off at years 5 / 10 / 20 (mean of 3 seeds; seed 2 is 16% under at year 20). Needs a server restart, a reset, and a watch (rule 13): look for glowing fires in winter and bands clustered at fires and cave mouths.

## Phase 5f stone and dry-stone huts (branch `phase-5f-structures`, off `main`)
- **Built**: stone on hill/rock tiles (finite); well-fed people on rock pick it up (`CARRY_STONE`), carry it to where people rest together and set it down, adding durability to that tile; at 60 durability the tile is a hut (shelter from the cold, 0.5x upkeep); durability erodes 1 per 64 ticks via a rotating slice, so unmaintained huts fall back to rubble. Huts reach the viewer as feature kinds 8 to 11, drawn as oblique stone huts. Switch `buildingEnabled`. Tests `tests/huts.test.ts` (7). Perf 4.4 us / person / tick. Needs a reset and a watch (rule 13): grey slab-roofed huts appearing where people live, thinning out where they leave.
- **Combat injury (same branch)**: clashes and wolf bites now wound (`people.injury`, saved and hashed): wounded people pay extra upkeep, lose some steps, and heal only when fed, so a hungry wounded person bleeds out. A wolf bites a lone person (takes energy, wounds) instead of killing outright. Violent and wound deaths leave a grave mark (feature kind 5). About 50 violent deaths a year at year 10; people 5% to 16% under an injury-off run; wolves persist on three seeds. Switch `injuryEnabled`. Tests `tests/injury.test.ts`. Grave marks are drawn as a small earth mound with a stick cross.

## 3/4 oblique art (on `phase-5f-structures`)
- An art agent redrew the objects (trees, stumps, caves, fires, nests, granaries, heaps, people, herds, wolves, carcasses) as 3/4 oblique sprites with back-to-front draw order; terrain stays flat. I added the oblique hut and grave sprites. Viewer only, no sim change. Verified with a software-canvas preview, not yet in a real browser: check tap-select feel (people feet moved half a tile), sprite scaling at cell sizes 10, 12 and 20, and frame time with big forests (per-frame sort).

## Phase 5g bodies (branch `phase-5g-bodies`, off `main`)
- Primitives 24, 25, 28, 19, 23. Life stages (children 0.6, elders 0.8 of adult work: forage bite, carry caps, clash strength); strength gene scales carry and work; childcare (a child under adult age costs its mother, split with a mate beside them); fatigue (steps raise it, standing still clears it; costs upkeep and lost steps); disease (touch spread, hashed spontaneous onset, upkeep drain, fed people recover faster). New per-person `fatigue` and `sick` Uint8 arrays through grow/spawn/kill/export/hash. Deaths with sickness leave grave marks. No viewer tint for the sick (the look byte has no free bit); outbreaks show as grave marks and population dips. Not yet watched in a browser (rule 13). Perf 5.6 µs/person/tick at 11.9k people. Old saves load with zeroed arrays.

## Next Steps
1. Watch the overdue features in a browser with a fresh world (rule 13), including the oblique art checks above.
2. Decide how closed rooms work (roadmap open question): huts are one tile today, but Phase 5's check asks for walls forming closed rooms.
3. Build 5e golden crops.
4. Combined tuning pass: wounds, population, childcare share, nests with no limit; decide the starting population.
5. Graphics work: use the `graphics` agent (`.claude/agents/graphics.md`), starting with an audit.
6. Parked: Clash animation & visual combat feedback (drafted and added to Parking lot in `docs/ROADMAP.md`).
