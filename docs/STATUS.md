# Neolithic Engine — Status

> Historical phase logs are archived in [`docs/archive/status-history.md`](file:///home/jcoleman/Projects/neolithic-engine/docs/archive/status-history.md).

## Active Phase: Phase 5e (Golden Crops & Active Farming Tending — merged to `main`)
- **Status**: Completed & verified; merged to `main`.
  - **Ripening & Art**: Cultivated cells (`farmLevel >= 2`, `tilled >= 0.05` or `seeds > 0`) ripen to golden fields (`COLOR_SEEDS_RGB = 0x28c8f0`) at food capacity >= 0.70. Tuned `cropRipenMinFarmLevel` to 2 to eliminate premature wild grass ripening from single bites, and lowered overlay alpha (50% ripe sheen). Added procedural wheat stalk rendering (`D_CROPS = 15`) with slender stems, golden ears, awn whiskers, and wind sway.
  - **Stone & Nutrients Fix**: Enforced that mineral stone cannot provide nutrients: rock/stone cells are barren (`maxFood = 0`, `fertility = 0`, cannot be grazed or seeded, switch: `stoneBarrenEnabled`). Fixed bug in `life.ts` where carrying stone was transmuted into seeds (`CARRY_SEED`) during grazing meals.
  - **Active Tending**: Gentle harvesting raises `tilled` (`+0.03`); tended soil (`> 0.25`) gets +40% regrowth boost; fallow decays via `tillDecay`.
  - **Hillside Cave Generation Fix**: Restricted natural cave generation in `initCaves` to true cliff faces and hill slopes with an uphill retaining wall (`nh >= h + 0.015`) and downhill drop (`nh <= h - 0.015`), eliminating standalone caves in flat plains.
  - **Invariants**: Energy ledger verified with 0 violations over 300+ ticks; off-switch parity verified.
  - **Perf**: **5.957 µs / person / tick** (benchmark at 8,739 people: 7.620 µs, desktop budget 15.0 µs).
  - **Verify**: 42/42 test suites, 271 tests passing.

## Current Health & Performance (Desktop)
- **Perf**: ~5.0–6.0 µs / person / tick across ~8,500–11,500 people (desktop budget: 15.0 µs).
- **Verify**: `npm run verify` passing (check, tests, production build).
- **Fingerprint**: `b11b505bedb2a659` (off-switch baseline parity preserved).

## Next Steps
1. Visual inspection in browser on desktop & phone (Rule 13) for Golden Crops & wolf chases.
2. Phase 5f (Structures, Stone & Closed Rooms) or Phase 6b (Weather & Disaster).
3. Combined tuning pass: wounds, population, childcare share, nest caps.
