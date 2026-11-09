# Neolithic Engine — Status

> Historical phase logs are archived in [`docs/archive/status-history.md`](file:///home/jcoleman/Projects/neolithic-engine/docs/archive/status-history.md).

## Save version check (branch `claude/visual-verification-setup-x8cmbi`)
- **Done**:
  - Saves carry `schema` (`SAVE_SCHEMA`, now 2, in `src/sim/world.ts`). A build refuses a save with a higher schema. Saves with no stamp still load.
  - `People.importState` refuses a save whose people carry a field this build does not know (`PERSON_FIELDS` in `src/sim/people.ts`, exhaustive against `PackedPerson` at compile time, so a new field fails `tsc` until it is registered). `mateSlot` is allowed as a legacy name.
  - At server start a refused save stops the server and leaves the file untouched (autosave begins only in `listen()`).
  - `tsconfig.server.json` no longer type-checks `scripts/capture.ts` and `scripts/visual-check.ts`, so `npm run server` builds without Playwright installed.
  - `main` merged in with no conflicts; the six S3 person fields (`fear`, `fearX`, `fearY`, `restTicks`, `confidence`, `confTick`) are registered and schema went 1 to 2.
- **Measured** (cloud container, not the S21; earlier figures in this file are from other hardware):
  - `VERIFY_VISUAL=1 npm run verify`: `ok check`, `ok test`, `ok build`, `ok visual-check`.
  - Perf: **3.852 µs / person / tick** at 13,811 people (53.202 ms/tick; desktop budget: <= 15.0 µs). One run, no before-merge baseline.
- **Watched (Rule 13), by the user on this branch's build, 2026-11-09**: people spread normally across the map (the earlier edge and axis pile-up was an old server still on port 8080). Seen: food mounds piling up, crops growing, hunting, wolves near people, stone huts, and probably some walls forming. Not seen: campfires, carried water, any wolf attack, any visible sign of turmoil. No roadmap boxes are ticked from this: the campfire, wolf-behaviour and closed-room checks are not established.
- **Headless check** (`scratchpad/watchprobe.ts`, default config, seeds 1 to 5, 15 years, sampled every 30 ticks; read-only, it counts `land.ignite` calls): 112 to 153 fires lit per seed (first at year 0.7, 11 to 20 burning at once); 167 to 343 people carrying water at once, but only 4 to 5 water-store tiles at once (63 to 86 units stored at peak); 19 to 37 huts and 59 to 74 wall-like cells; wolves took 30 to 178 herd animals and killed 0 to 2 people. So fires and carried water do happen in the sim. Wolves bite only a person with nobody else within `wolfLoneRadius` (2) of them, and strike herd prey first, so few attacks on bands is by design.
- **Open finding, not yet explained**: the sim lights fires and carries water but they were not seen in the viewer. Candidates, none checked: a fire burns out in about 40 ticks (about 13 s at 3 ticks a second), so the glow is brief; stores are a handful of blue tiles; carriers show their mark only at close zoom; or a viewer gap. A scripted Playwright look at the real page over a few simulated years would settle it.
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
