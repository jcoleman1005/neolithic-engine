## Current State
Phase 4 step 4b (chronicle detectors, ticker, saving) done on branch `phase-4b-chronicle`. Step 4c (auto-camera, inspector text, "while you were away") is next.

- **Chronicle (`src/sim/chronicle.ts`)**: observer on top of the band tracker. Entry types: battle, split, founded, leaderDeath (also covers a band scattering after its leader dies), migration, famine, boom. Each entry carries text, camera priority (battle 4, split or new band 3, leader death 2, migration 1, famine and boom 0), position and band key, ready for 4c.
- **Clash log (`src/sim/rules.ts`)**: fixed typed ring of clashes between different bands, written in `touch`, drained by the chronicle. No allocation, no random draws.
- **Notables**: leaders are remembered (genes, exiles, peak followers) so epithets and death entries work after the person is gone; capped at 512.
- **Events and UI**: `chronicle` event kind; `events-view.ts` shows it in the ticker. `host.ts` keeps a log of the last 100 events, sends it to new viewers, and saves it with the tracker and notables in `SavedWorld.chronicle` (optional, so older saves load).
- **Tuning**: `npm run chronicle -- --years 90 --seed N`. Seeds 1, 2, 3: **22.3, 25.3 and 20.0 entries per real hour at 1x** (1x is 3 ticks a second, 30 years an hour). Target 10-30. Values logged in `docs/findings.md`.
- **Verify**: `npm run verify` passes. New tests in `tests/chronicle.test.ts`: same fingerprint with the chronicle on or off, reproducible entries, switch off, battle threshold and cooldown, ring overwrite, save round trip, sequence numbers after load.
- **Perf**: 13,736 people, 47.471 ms/tick, **3.456 us / person / tick** (budget 15.0). The benchmark does not run the host.
- **Not confirmed**: the roadmap check "an hour yields 10 to 30 entries that match what was on screen" is not ticked; the rate is measured headless but nobody has watched an hour in the browser.

## Next Steps
1. 4c: auto-camera (follow the oldest large band, hold shots 30 s, priority order, idle drift), plain-English inspector text, "while you were away" summary.
2. Watch an hour in the browser, then tick the Phase 4 check.
