## Current State
Phase 5 step 5a (seasons) built on branch `phase-5a-seasons`, not yet merged. Phase 4 is merged and checked.

- **Seasons (`src/sim/seasons.ts`)**: pure function of the tick, no new state. Regrowth is multiplied by a factor that peaks mid-summer (1.8x) and bottoms mid-winter (0.2x), averaging 1. Switch `seasonsEnabled`, amplitude `seasonAmplitude` (0.8). The peek bar shows "Year N · Summer".
- **Effect**: seed 1 holds about 9% fewer people than without seasons, stable over 100 years (`docs/findings.md`).
- **Calm movement (branch `fix-movement-jitter`, off 5a)**: from a user-run jitter investigation. People on a tile with 50%+ of its food stay and graze; a 180 degree step back needs a strong pull; `prevDir` is saved and hashed. Reversals fell from about 65% to about 38%, food per move doubled, population 3 to 5% lower. `npm run movement` measures it. Switch `calmMovementEnabled`.
- **Verify**: `npm run verify` passes. Tests: `tests/seasons.test.ts` (4), `tests/calm-movement.test.ts` (5).
- **Perf**: about 13k people, **4.4 us / person / tick** (budget 15; machine busy).
- **Not looked at in a browser**: the season label, and whether movement now reads as calmer.

## Next Steps
1. Watch the app: does movement look calmer, does the peek bar show the season? Then merge `fix-movement-jitter` (it contains 5a).
2. 5b: farming as land physics. Light, repeated harvesting raises a cell's regrowth; heavy grazing degrades it; knowledge starts locked and is discovered by repetition and spreads by contact.
3. 5c: home anchors, stockpiles, houses and granaries, with sprites.
