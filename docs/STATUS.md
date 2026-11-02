## Current State
Phase 4 fix pass on branch `fix-phase-4-polish` (4a to 4c are merged). Not yet merged.

- **Culture**: habits inherited per habit from one parent, rare innovations, experience shifts (switch `experienceHabitsEnabled`). Over 200 years on seeds 1 to 3, spread falls from about 37 to 19-20 and flattens; clashes stay at 15,000 to 17,000 a year. Details in `docs/findings.md`. `npm run culture` measures it.
- **Camera and map**: world drawn wrapped (tiled copies); camera glides across edges.
- **Phone width**: pill keeps Play/Pause, speed and tps; Step, Auto camera and colour are in a "..." menu.
- **Ticker**: chronicle entries only, dated "Year N"; speed selector follows the server's speed.
- **Chronicle**: battles reported when they end, with size tier, winner and toll. Thresholds retuned (skirmish 150, battle 300, great 700 clashes). Entries per 30 years: seed 1 13 to 22, seed 2 9 to 29 (one hour at 9). Epithets varied, band names never repeat a syllable.
- **Verify**: `npm run verify` passed before the threshold change; rerun before merge.
- **Perf**: 13,669 people, 45.338 ms/tick, **3.317 us / person / tick** (budget 15.0).
- **Not checked in a browser**: wrapped map, pill menu at 360 px, ticker, camera, away card. The Phase 4 hour-watch check stays unticked.

## Next Steps
1. Run `npm run verify`, then open the app (`npm run server`, http://localhost:8080) and look at the items above, including 360 px width.
2. Merge, then watch an hour and tick the Phase 4 check.
3. Phase 5: Settle and farm.
