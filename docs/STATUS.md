## Current State
Phase 4 is done and merged, including the fix pass. Checked on screen by the user: wrapped map, camera glide, pill, ticker, an hour of watching.

- **Culture**: habits inherited per habit from one parent, rare innovations, experience shifts (switch `experienceHabitsEnabled`). Over 200 years on seeds 1 to 3, spread falls from about 37 to 19-20 and flattens; clashes stay at 15,000 to 17,000 a year. Details in `docs/findings.md`. `npm run culture` measures it.
- **Camera and map**: world drawn wrapped (tiled copies); camera glides across edges.
- **Phone width**: pill keeps Play/Pause, speed and tps; Step, Auto camera and colour are in a "..." menu.
- **Ticker**: chronicle entries only, dated "Year N"; speed selector follows the server's speed.
- **Chronicle**: battles reported when they end, with size tier, winner and toll. Thresholds retuned (skirmish 150, battle 300, great 700 clashes). Entries per 30 years: seed 1 13 to 22, seed 2 9 to 29 (one hour at 9). Epithets varied, band names never repeat a syllable.
- **Verify**: `npm run verify` passed before the threshold change; rerun before merge.
- **Perf**: 13,669 people, 45.338 ms/tick, **3.317 us / person / tick** (budget 15.0).
- **Zoom and locate**: zoomed out far enough that the world fits, one map shows with void around it; otherwise it wraps. Tapping a chronicle entry (ticker or list) glides the camera there.
- **Checked by the user**: wrapping, camera glide, pill, hour of watching. The away card and the 360 px pill menu were not reported on.

## Next Steps
1. Phase 5: Settle and farm. Start with a short plan (files, new state, risks, open questions).
