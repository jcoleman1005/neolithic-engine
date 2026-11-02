## Current State
Phase 5c (mounds and nests) on branch `phase-5c-stigmergy`, built, tested and watched: nests, food heaps and brush heaps read well. `main` (local, not pushed) now includes 5c; fast-forwarded 2026-11-02. Project identity updated: an autonomous colony sim from primitive hunter-gatherers (see `docs/ROADMAP.md` and `docs/decisions.md`).

- **Stockpiles**: well-fed people gather surplus food and unload it where people congregate; hungry people eat from heaps; idle fed people tamp a heap; a big compacted heap becomes a granary floor. Switch `stockpilesEnabled`.
- **Nests**: brush from woodland, unloaded and tamped the same way, becomes a nest that cuts upkeep to 70%. Switch `nestsEnabled`. Code name `nest` (the Stage 1 shelter); `hut` is reserved for dry-stone.
- **Viewer**: food heaps as pyramids of round mixed produce (orange cells zoomed out), granary floors as planks, brush heaps as crisscrossed sticks (zoomed in only), nests as brush lean-tos. Brush is carried out of the woods and unloaded only on open ground, so nests form where people gather.
- **Tools**: `npm run sweep -- --kind farming|stockpiles` (checkpoint warm-up, early abort, per-year progress), `npm run stockpiles`, `npm run farming`.
- **Verify**: see the commit; tests `tests/stockpiles.test.ts`, `tests/farming.test.ts`.
- **Perf**: about 14k people, **4.4 us / person / tick** (budget 15).
- **Known**: nests keep growing (about 100 a year) with nothing limiting them; granary floors marginal at 5 on one seed. Both for the combined tuning pass.

## Next Steps
1. Port `exp-finite-resources` onto 5c in pieces (trees feed brush, berries/fish/water, herds as the start of 6a); see the roadmap's 5-pre entry.
2. 5d: cold, natural caves and campfire hearths (Stage 1), then 5e golden crops and 5f stone huts. Plan posted, waiting for your go on the defaults.
3. A combined tuning pass over 5b to 5f once the features are in; decide the starting population (open question in the roadmap).
