# Neolithic Engine — Status

## Current State
Phase 3 (People) implemented and verified on branch `phase-3-people`.
- **CPU Scent Fields (`src/sim/fields.ts`)**:
  - Double-buffered food and danger scent fields ($256 \times 256$) with wrapped torus boundary conditions.
  - Periodic diffusion (every 4 ticks) and evaporation with zero per-tick heap allocations.
  - Wrap-aware gradient computation (`getFoodGradient`, `getDangerGradient`).
- **Eight Genes & Eight Habits (`src/sim/people.ts`)**:
  - Expanded traits to 8 genes: `strength`, `bravery`, `greed`, `piety`, `charisma`, `curiosity`, `wisdom`, `cruelty`.
  - 8 cultural habits: `forage`, `caution`, `generosity`, `belligerence`, `devotion`, `roaming`, `loyalty`, `industry`.
  - Leader link tracking (`leaderId`: 20-bit slot + 12-bit generation); dead leader invalidation and slot reuse safety.
  - Genetic crossover with mutation bounds $[0, 255]$ and parental habit blending upon birth.
- **Three Local Rules (`src/sim/rules.ts`)**:
  - **`climb`**: Food scent gradient attraction, caution/bravery-modulated danger aversion, leader pull, and land/water navigation.
  - **`copy`**: ID-staggered social evaluation (every 8 ticks) evaluating leader attractiveness via multi-attribute utility; observer personality modulates respect (e.g. greed respects wealth, piety respects wisdom); habit drift towards leader.
  - **`touch`**: Physical contact in co-located cells — altruistic sharing among allies with zero-sum ledger balance; combat clashes between belligerent non-allies with damage booked to `ledger.attack`, danger scent deposition, and retreat step.
  - Feature switches (`climbEnabled`, `copyEnabled`, `touchEnabled`) with test proving border clashes vanish when touch is switched off.
- **Inspector Person Card (`src/ui/inspector.ts`, `src/style.css`)**:
  - Person inspection displays leader link, 8 gene chips, and 8 habit chips.
- **Determinism & Ledger Verification**:
  - Energy ledger balances with 0 violations across hundreds of ticks.
  - Save/restore round trip reproduces bit-identical `stateHash` across thousands of subsequent ticks.
- **Automated Verification (`npm run verify`)**:
  - 52 automated tests across 9 test suites passing cleanly with zero errors.
- **Performance Benchmark (`npm run perf`)**:
  - Average population: 9,704
  - Tick duration: 21.696 ms / tick
  - **Perf: 2.236 µs / person / tick** on desktop (budget: <= 15.0 µs; 6.7× faster than budget).

## Next Steps
1. Merge branch `phase-3-people` into `main`.
2. Begin Phase 4 (Chronicle): event detectors (famine, boom, migration, group split, notable deaths), naming system, ticker, auto-camera.
