## Current State
Phase 5c (mounds and nests) on branch `phase-5c-stigmergy`, built and tested, not yet watched on screen. `main` has Phase 4, seasons, calm movement and 5b farming. Project identity updated: an autonomous colony sim from primitive hunter-gatherers (see `docs/ROADMAP.md` and `docs/decisions.md`).

- **Stockpiles**: well-fed people gather surplus food and unload it where people congregate; hungry people eat from heaps; idle fed people tamp a heap; a big compacted heap becomes a granary floor. Switch `stockpilesEnabled`.
- **Nests**: brush from woodland, unloaded and tamped the same way, becomes a nest that cuts upkeep to 70%. Switch `nestsEnabled`. Code name `nest` (the Stage 1 shelter); `hut` is reserved for dry-stone.
- **Viewer**: heaps and granary floors as coloured cells zoomed out and pixel-art mounds and plank floors zoomed in; nests as brush lean-tos. Not yet looked at.
- **Tools**: `npm run sweep -- --kind farming|stockpiles` (checkpoint warm-up, early abort, per-year progress), `npm run stockpiles`, `npm run farming`.
- **Verify**: see the commit; tests `tests/stockpiles.test.ts`, `tests/farming.test.ts`.
- **Perf**: about 14k people, **5.8 us / person / tick** (budget 15).
- **Known**: nests keep growing (about 100 a year) with nothing limiting them; granary floors marginal at 5 on one seed. Both for the combined tuning pass.

## Next Steps
1. You watch 5c (restart the server from this branch): do heaps, nests and granary floors read on the map and zoomed in?
2. Merge 5c, then 5d: cold, natural caves and campfire hearths (Stage 1), then 5e golden crops and 5f stone huts.
3. A combined tuning pass over 5b to 5f once the features are in; decide the starting population (open question in the roadmap).
