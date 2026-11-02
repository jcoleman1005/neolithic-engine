## Current State
Phase 5 step 5a (seasons) built on branch `phase-5a-seasons`, not yet merged. Phase 4 is merged and checked.

- **Seasons (`src/sim/seasons.ts`)**: pure function of the tick, no new state. Regrowth is multiplied by a factor that peaks mid-summer (1.8x) and bottoms mid-winter (0.2x), averaging 1. Switch `seasonsEnabled`, amplitude `seasonAmplitude` (0.8). The peek bar shows "Year N · Summer".
- **Effect**: seed 1 holds about 9% fewer people than without seasons, stable over 100 years (`docs/findings.md`).
- **Verify**: `npm run verify` passes. New tests: `tests/seasons.test.ts` (4). `npm run sim` now accepts `--key value` config overrides.
- **Perf**: about 13.5k people, **4.0 to 5.1 us / person / tick** (budget 15; machine was busy).
- **Not looked at in a browser**: the season label in the peek bar.

## Next Steps
1. Merge 5a after a look at the season label.
2. 5b: farming as land physics. Light, repeated harvesting raises a cell's regrowth; heavy grazing degrades it; knowledge starts locked and is discovered by repetition and spreads by contact.
3. 5c: home anchors, stockpiles, houses and granaries, with sprites.
