# Neolithic Engine — Status

## Current State
Phase 3 (People) fully implemented, refined for cohesion and decisive clashes, and verified on branch `fix-phase-3-cohesion`.

### Key Enhancements & Fixes
- **Allies in Touch & Cached Root Leaders (`src/sim/people.ts`, `src/sim/rules.ts`)**:
  - `Rules.isAllied` prevents violence between allies: direct leader/follower (`A->B` or `B->A`), shared `rootLeaderId`, mates, maternal siblings (`same motherId`), and parent-child.
  - Added cached `rootLeaderId: Uint32Array` refreshed in staggered time-slices (1/8th slice per tick) with 16-hop cycle breaker.
- **Decisive Clashes with Conservation (`src/sim/rules.ts`)**:
  - Combat score compares strength (dominant weight) + nearby allies + PRNG noise.
  - Loser loses energy share (`clashLossShare = 0.25`); winner loots up to capacity (`clashLootEfficiency = 0.8`); struggle waste and excess over capacity are booked to `ledger.attack`. Loser retreats.
- **Unbiased Leader Choice & Incumbency Bonus (`src/sim/rules.ts`)**:
  - Incumbency bonus (`incumbencyBonus = 0.35`) applies only against the current leader or self to stabilize allegiance.
  - Candidates compared via plain `>`; randomized spatial scan offset eliminates north/directional scan bias; closure-free and zero heap allocations.
- **Full Cell Pairing (`src/sim/rules.ts`)**:
  - `touchCell` pairs all co-located people in a cell in a rotating disjoint order, not just the first two.
- **Band Visibility & Stats (`src/render/renderer.ts`, `src/ui/controls.ts`, `src/ui/metrics-view.ts`)**:
  - Added "Colour by band" mode: each person colored by a deterministic hash of `rootLeaderId`, loners grey.
  - Metric panel displays active band count ($\ge 2$) and largest band.
- **Measurement Script & Verification (`scripts/bands.ts`)**:
  - `npm run bands` prints per-decade statistics (% following, bands 5+, bands 20+, largest band, retention rate, clash relationship breakdown).
  - 200-year runs across 3 seeds (Touch ON vs OFF) confirm:
    - Leader retention: **99.5%–99.9%** per decision cycle.
    - Clashes by relationship: Stranger clashes ~50k–65k/year; In-band / Leader / Kin clashes: **0.0 / year**.
    - Band scale: Largest bands grow to **339–378** people.

### Verification & Performance
- **Automated Verification (`npm run verify`)**:
  - TypeScript type check (`npm run check`): 0 errors.
  - 55 automated tests across 9 test suites passing cleanly with 0 errors.
  - Save/restore round trip reproduces bit-identical `stateHash`.
  - Energy ledger balance maintains 0 residual across all ticks.
- **Performance Benchmark (`npm run perf`)**:
  - Population: **12,731** people.
  - Tick duration: **38.257 ms** / tick.
  - **Perf: 3.005 µs / person / tick** on desktop (budget: $\le 15.0$ µs; 5× faster than budget).

## Next Steps
1. Merge branch `fix-phase-3-cohesion` into `main`.
2. Begin Phase 4 (Chronicle): event detectors (famine, boom, migration, group split, clash, notable deaths), naming system, ticker, and auto-camera.
