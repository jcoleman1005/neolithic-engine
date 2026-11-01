# Neolithic Engine — Status

## Current State
Phase 0 (Fork and strip) complete on branch `phase-0-strip`.
- Repository stripped of organism core, brain, DNA, species, activity, and organism UI views.
- Clean land-only 256×256 wrapped `World` stub implemented.
- `SimulationConfig` updated to 256×256, wrapping on, 360 ticks per year, zero organism settings.
- Headless runner `scripts/run.ts` implemented (`npm run sim -- --seed 3 --years 50`).
- `npm run verify` passes (tsc -b, 24 vitest tests, vite production build).
- `npm run perf` baseline recorded (0.000 ms/tick for empty world).
- Phase 0 checklist verified and ticked in `docs/ROADMAP.md`.

## Next Steps
1. Merge `phase-0-strip` into `main`.
2. Begin Phase 1 (Life):
   - `src/sim/people.ts`: typed arrays, alive flag, free list, slot-plus-generation IDs, doubling, save and restore.
   - `src/sim/land.ts`: 256×256 terrain/elevation with wrapping and plant food regrowth curve.
   - `src/sim/spatial.ts`: counting-sort neighbor lookup with prefix sums.
   - `src/sim/life.ts`: metabolism, foraging, wandering, mating, pregnancy, birth, death.
   - Energy ledger integration (`src/sim/ledger.ts`).
