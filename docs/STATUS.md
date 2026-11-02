## Current State
Phase 4 step 4a (naming and band tracking) done on branch `phase-4a-naming`. Steps 4b (chronicle detectors, ticker) and 4c (auto-camera, inspector text, "while you were away") are next, each on its own branch.

- **Naming (`src/core/naming.ts`)**: pure hash functions, no simulation random stream. Tongues (6 distinct syllables) seeded from lineage; `driftTongue` replaces one syllable for a split band. `personName`, `bandName`, `fullName` ("Kesh of the Varn"), `epithet` (deeds before traits, e.g. "Twice-Exiled", "the Cruel"), `landformFor` and `placeName` ("Varn Ridge").
- **Band tracker (`src/sim/bands.ts`)**: observer, grouped by `rootLeaderId`, one pass every `bandTrackInterval` = 60 ticks. Per band: founder, parent, size, peak, wrapping centroid, distance travelled, tongue. Tells succession (old root leader dead, new root takes over) from a real split. Returns `BandChange` lists (founded / split / succession / died) for 4b. Export/import for saving. Wired into `host.ts`; switch `bandTrackEnabled`.
- **Probe, seed 1, 20 years**: 154 bands tracked at the end; 223 founded, 70 died, 11 successions, 1 split. Splits are rare because most bands gather around loners, so 4b will need to check how "band split or new band" should be counted. About 1.2 ms per pass.
- **Not yet done**: band tracker state is not yet in the save file (4b, with the event log); no events or UI use the names yet; no notables list; no clash-pair counters.
- **Verify**: `npm run verify` passes. New tests: `tests/naming.test.ts`, `tests/bands.test.ts` (same seed gives the same fingerprint with the tracker on or off).
- **Perf**: 13,736 people, 47.153 ms/tick, **3.433 us / person / tick** (budget 15.0). The benchmark does not run the host, so the tracker adds about 1.2 ms every 60 ticks on top.

## Next Steps
1. Merge `phase-4a-naming` into `main` after the user's go-ahead.
2. 4b: chronicle detectors (battle, split or new band, leader death, migration, famine, boom), clash-pair counters, notables, ticker, save of tracker and event log; tune thresholds to 10-30 entries per hour.
3. 4c: auto-camera, inspector text, "while you were away" summary.
