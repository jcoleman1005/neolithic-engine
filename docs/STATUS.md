## Current State
Phase 5b (farming physics) built on branch `phase-5b-farming`, **not merged and not tuned**. `main` has Phase 4, seasons, calm movement and the antfarm roadmap.

- **Farming physics**: no unlock flags. Grazing tills a cell; tilled soil and seeds regrow faster; tired people resting drop the seeds they carry; stripped soil wears down to desert and recovers slowly. Switch `farmingPhysicsEnabled`.
- **Viewer**: strictly watch-only (the poke brush was dropped). A land overlay shows farmland brown, desert sand and seeds yellow on the ground. Not yet looked at in a browser.
- **Verify**: passes. Tests: `tests/farming.test.ts` (9). `npm run farming` measures it.
- **Perf**: 14,692 people, **4.382 us / person / tick** (budget 15).
- **Known problem**: far too strong. About 97% of land is farmland and 58% desert after 60 years, and population is 5 to 10% below the farming-off run. See `docs/findings.md`. Do not merge until retuned and the map reads as patches.

## Next Steps
1. Retune 5b so farms are patches and desert is local, then watch it (rule 13) and merge.
2. 5c: home anchors, stockpiles, houses and granaries, with sprites.
3. Phase 6 weather and disaster, 6b animals, then raids; see `docs/ROADMAP.md`.
