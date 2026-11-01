# Neolithic Engine — Status

## Current State
Phase 1 (Life) complete on branch `phase-1-life`.
- **People Core (`src/sim/people.ts`)**: Columnar typed arrays (`Float32Array`, `Uint32Array`, `Uint16Array`, `Uint8Array`, `Int16Array`), alive flag, free list, slot-plus-generation IDs (20-bit slot, 12-bit generation), dynamic doubling, save and restore roundtrip.
- **Land & Geography (`src/sim/land.ts`)**: 256×256 wrapped grid with coordinate wrap helpers (`wrapDiff`, `distSqWrap`), plant food per cell, logistic regrowth curve with grazing floor (`landGrazingFloor`), elevation/riparian soil fertility integration.
- **Spatial Index (`src/sim/spatial.ts`)**: Counting-sort neighbor lookup with prefix sums (`cellStarts` of size 65537, `cellPeople`, `cellCounts`), wrapping neighbor iteration, zero per-tick allocations.
- **Life Pipeline (`src/sim/life.ts`)**: Daily metabolism upkeep leak, starvation death, old age death, grazing above floor, wandering with water avoidance, mating search with kin avoidance (parent-child and full/half siblings), gestation, childbirth with energy transfer.
- **Energy Ledger (`src/sim/ledger.ts`)**: Fully wired energy accounting across birth, foraging, metabolism, movement, and death with zero violations.
- **Determinism & Invariants (`tests/mechanics.test.ts`, `tests/snapshot.test.ts`)**: 29 automated tests verifying ledger balance, slot reuse generation bumping, strict 0..255 coordinate wrapping, exact save/restore stateHash reproducibility, and identical seed fingerprints.
- **200-Year Multi-Seed Stability**: Verified across seeds 1, 2, 3, 4, 5 (72,000 ticks each). All seeds settle into a steady carrying capacity band between 8,291 and 9,972 people without dying out or exploding.
- **Performance Benchmark (`npm run perf`)**:
  - Average population: 11,062
  - Tick duration: 3.022 ms / tick
  - **Perf: 0.273 µs / person / tick** on desktop (budget: <= 15.0 µs; 55× faster than budget).
- Phase 1 checklist verified and ticked in `docs/ROADMAP.md`.

## Next Steps
1. Merge `phase-1-life` into `main`.
2. Begin Phase 2 (Window):
   - Adapt renderer (`src/render/renderer.ts`) to draw 10,000 stick figures up close, dots and colored regions zoomed out.
   - Replace old organism card with compact person card.
   - Frame packing format in `protocol.ts` and SSE transport.
   - Long-running stability check on Galaxy S21 phone / desktop viewer.
