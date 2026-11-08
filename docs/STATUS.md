# Neolithic Engine — Status

> Historical phase logs are archived in [`docs/archive/status-history.md`](file:///home/jcoleman/Projects/neolithic-engine/docs/archive/status-history.md).

## Persistent-walk jitter (branch `ccr-72645d63-0n3gjg`, not merged)
- **Done**: `src/sim/jitter.ts` (CRW turns, staggered dash epochs, seed-keyed hash, one PRNG draw per call, packed-int result); wired into `Rules.climb` behind `jitterEnabled` (default true); six tunables in `config.ts`. Off-switch parity tests (`clash`, `drives-and-stages`) now set `jitterEnabled: false`. Full suite passes (277/277). Perf: **2.57 µs / person / tick** at 8,395 people.
- **Next**: nothing agreed. The jitter measured as a no-op (see `docs/findings.md`); roaming pressure and probe stubs are in the Parking lot and `scripts/probes/README.md`. Decide with the user whether to leave `jitterEnabled` on.

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
