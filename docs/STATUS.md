## Current State
Phase 5b (farming physics) built on branch `phase-5b-farming`, **retuned, not merged (waiting for you to watch it)**. `main` has Phase 4, seasons, calm movement and the antfarm roadmap.

- **Farming physics**: no unlock flags. Grazing tills a cell; tilled soil and seeds regrow faster; tired people resting drop the seeds they carry; stripped soil wears down to desert and recovers slowly. Switch `farmingPhysicsEnabled`.
- **Viewer**: strictly watch-only (the poke brush was dropped). A land overlay shows farmland brown, desert sand and seeds yellow on the ground. Not yet looked at in a browser.
- **Verify**: passes. Tests: `tests/farming.test.ts` (9). `npm run farming` measures it.
- **Perf**: about 14k people, **5.1 us / person / tick** (budget 15; load average about 3 from other jobs).
- **Tuning**: values from `npm run farming-sweep`, confirmed over 50 years on seeds 1 to 3: population +1.2 to +2.7% against farming off, worked soil 16 to 19% of land, desert 6 to 7%, seeds on 15 to 16%. Details in `docs/findings.md`.

## Next Steps
1. You watch 5b (server rebuilt from this branch): do the brown farm patches, sandy desert and yellow seeds read clearly with people on top? Then merge.
2. 5c: stigmergic stockpiles and building: items dropped by resting, full or burdened people grow into visible heaps; idle fed people work them in place (a per-person step in the touch phase, separate from the pair rule) until a tile snaps to a heap, granary floor or hovel. No build orders. Food and seeds only; stone and mud with walls in Phase 7.
3. Phase 6 weather and disaster, 6b animals, then raids; see `docs/ROADMAP.md`.
