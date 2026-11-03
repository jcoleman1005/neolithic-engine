## Current State
Phase 5c (mounds and nests) on branch `phase-5c-stigmergy`, built, tested and watched: nests, food heaps and brush heaps read well. `main` (local, not pushed) now includes 5c; fast-forwarded 2026-11-02. Project identity updated: an autonomous colony sim from primitive hunter-gatherers (see `docs/ROADMAP.md` and `docs/decisions.md`).

- **Stockpiles**: well-fed people gather surplus food and unload it where people congregate; hungry people eat from heaps; idle fed people tamp a heap; a big compacted heap becomes a granary floor. Switch `stockpilesEnabled`.
- **Nests**: brush from woodland, unloaded and tamped the same way, becomes a nest that cuts upkeep to 70%. Switch `nestsEnabled`. Code name `nest` (the Stage 1 shelter); `hut` is reserved for dry-stone.
- **Viewer**: food heaps as pyramids of round mixed produce (orange cells zoomed out), granary floors as planks, brush heaps as crisscrossed sticks (zoomed in only), nests as brush lean-tos. Brush is carried out of the woods and unloaded only on open ground, so nests form where people gather.
- **Tools**: `npm run sweep -- --kind farming|stockpiles` (checkpoint warm-up, early abort, per-year progress), `npm run stockpiles`, `npm run farming`.
- **Verify**: see the commit; tests `tests/stockpiles.test.ts`, `tests/farming.test.ts`.
- **Perf**: about 14k people, **4.4 us / person / tick** (budget 15).
- **Known**: nests keep growing (about 100 a year) with nothing limiting them; granary floors marginal at 5 on one seed. Both for the combined tuning pass.

## Finite resources (branch `phase-5-finite-resources`, piece 1 of the port)
- **Done**: trees (finite wood, brush gathering uses it up, slow regrowth) and berries (a hunger top-up). Switch `finiteResourcesEnabled`. Tests `tests/finite-resources.test.ts`. Tuned set G in `docs/findings.md`: pop +3 to +6% vs off, woodland settles near 58%, nests about 390.
- **Verify** passes; **perf** 4.2 us / person / tick (budget 15).
- **Visible**: thinned woodland draws as pale straw; fully stripped stands become stumps (block regrowth for 3 years), then rot to open meadow for good (13% of woodland by year 30). Cleared ground can hold berries but not trees or nests (it keeps the wooded mask). No reforestation yet: a parking-lot candidate. Fish (shore food) and thirst (hydration, walk to fresh water, drink, upkeep when low) are built on `phase-5-fish-thirst`; people now cluster nearer rivers and lakes (mean distance to fresh water 6.5 vs 10.5). Woodland now matches the drawn forest (3199 lowland cells), tree sprites thin with cutting, and a first-tick-after-load bug in the crowd rule is fixed. Next: herds.

## Phase 6a herds (branch `phase-6a-herds`)
- **6a-1 done**: herbivores in `src/sim/herds.ts` (graze, drift, flee, breed, die; own PRNG; plant-side energy; saved and hashed). Herd settles at `herdSoftCap` 300; people within 5% of herds off. Tests `tests/herds.test.ts`. Perf 4.4 us / person / tick.
- **6a-3 viewer done**: herd positions stream with every frame (2 bytes per animal) and draw as tan dots zoomed out and little antlered quadrupeds zoomed in (they snap tile to tile, no interpolation yet). Needs a server restart and a watch. Next: 6a-2 hunting with meat piles, then 6a-4 wolves.

## Next Steps
1. Continue the port: draw thinned woodland, then fish and thirst, then herds (start of 6a); see the roadmap's 5-pre entry.
2. 5d: cold, natural caves and campfire hearths (Stage 1), then 5e golden crops and 5f stone huts. Plan posted, waiting for your go on the defaults.
3. A combined tuning pass over 5b to 5f once the features are in; decide the starting population (open question in the roadmap).
