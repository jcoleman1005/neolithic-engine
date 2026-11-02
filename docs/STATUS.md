## Current State
Pre-Phase 4 task done on branch `feat-culture-touch`: culture similarity in touch.

- **Culture similarity (`src/sim/rules.ts`, switch `cultureTouchEnabled`)**: non-allied belligerent pairs with mean habit distance <= 0.08 tolerate each other; above it, clash chance is `min(1, 4 x (distance - 0.08))`. Off runs draw no extra random numbers.
- **Stranger clashes/yr, seed 1** (`npm run bands`): culture off about 45k-61k (decades 2-5); culture on 14.7k, 12.9k, 8.0k, 4.8k. Bands of 20+ at decade 5: 99 off, 112 on. Retention 99.6%. Seeds 2 and 3 not measured.
- Threshold and slope logged in `docs/findings.md`. Phase 4 naming, camera and chronicle decisions recorded in `docs/decisions.md`.
- **Verify**: `npm run verify` passes (check, test, build).
- **Perf**: 13,736 people, 46.287 ms/tick, **3.370 us / person / tick** (budget 15.0).

## Next Steps
1. Merge `feat-culture-touch` into `main` (it needs the user's go-ahead). `fix-phase-3-cohesion` may already be merged; check.
2. Begin Phase 4 (Chronicle): event detectors (famine, boom, migration, group split, clash, notable deaths), naming system, ticker, and auto-camera.
