## Mutable Fertility (branch `feat-mutable-fertility`)
- **Done**: `Land.fertility` is now mutable Float32Array: degrades on overgrazing/stripping bare ground down to `fertilityMin` (0.05), improves via passive tending (tilled, seeded, healthy vegetated soil), composting spoiling food heaps, and active tending (seed dropping, tamping) up to `fertilityMax` (1.5). Saved in `LandState` snapshot and verified in `world.stateHash()`. Switch `fertilityChangeEnabled`.
- **Tests**: `tests/fertility.test.ts` (overuse degradation, explicit seed enrichment, tamping, passive tending, off switch parity, save/restore exact stateHash round-trip).
- **Verify**: all 27 test suites pass; **perf** 9.14 µs / person / tick at 14,163 population (budget 15).

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
- **6a-3 viewer done**: herd positions stream with every frame (2 bytes per animal) and draw as tan dots zoomed out and little antlered quadrupeds zoomed in (they snap tile to tile, no interpolation yet). Needs a server restart and a watch. **6a-2 hunting done**: hungry people strike adjacent animals; a kill leaves a food heap at the hunter's feet (looks like any food heap for now). About 46 kills a year at 6000 people; herd holds near its soft cap. Next: 6a-4 wolves.

## World shape (branch `fix-world-shape`, on top of `phase-6a-herds`)
- Fewer lake pockets, more land (64%), hills start higher so about 40% of the map is green, 700 founders, herds no longer drawn in the void when zoomed out, dead-animal graphic at fresh kills. See `docs/findings.md`. Needs a fresh world (reset) to see the new map; saved worlds keep their old terrain.

## Wolves (branch `phase-6a-wolves`)
- **6a-4 built**: wolves wander, chase herd prey, kill and leave meat and a carcass, leave danger scent, take lone people; herds flee them. 12 to 38 wolves over 30 years, about 29 people killed a year, people 5% below wolves off at year 30 (a 12% dip at year 20). Tuning stopped here on purpose; the threat is for later phases to answer. Needs a server restart and a watch.

## Phase 5d cold, caves and campfires (branch `phase-5d-cold`)
- **Built**: a seasonal cold (winter and height) that adds upkeep to anyone unsheltered; 40 natural caves on hill edges; campfires that a cold, resting person lights on a big enough brush heap, which burn the brush down and shelter a 2-tile radius; cold, fed people walk to the nearest cave or fire and stay. Caves are drawn as dark mouths, fires as a flickering flame with a faint warm glow. Switches `coldEnabled`, `cavesEnabled`, `firesEnabled`. Tests `tests/cold.test.ts` (8). Perf 4.3 us / person / tick at 13,680 people. People run 3% / 6% / 10% under cold-off at years 5 / 10 / 20 (mean of 3 seeds; seed 2 is 16% under at year 20). Needs a server restart, a reset, and a watch (rule 13): look for glowing fires in winter and bands clustered at fires and cave mouths.

## Phase 5f stone and dry-stone huts (branch `phase-5f-structures`, off `main`)
- **Built**: stone on hill/rock tiles (finite); well-fed people on rock pick it up (`CARRY_STONE`), carry it to where people rest together and set it down, adding durability to that tile; at 60 durability the tile is a hut (shelter from the cold, 0.5x upkeep); durability erodes 1 per 64 ticks via a rotating slice, so unmaintained huts fall back to rubble. Huts reach the viewer as feature kinds 8 to 11 (drawn flat for now; the oblique art branch needs a hut sprite when the two merge). Switch `buildingEnabled`. Tests `tests/huts.test.ts` (7). Perf 4.4 us / person / tick. Needs a reset and a watch (rule 13): grey slab-roofed huts appearing where people live, thinning out where they leave.
- **Found while looking into wolves and fights** (not fixed yet): wolves kill only 2 to 17 people a year and die out on some seeds (seed 1 by year 9, even with cold off), so the earlier "29 a year" figure predates the new map. Clashes number thousands a year but 0 to 3 a year are fatal, because the loser only forfeits 25% of energy and dies only if that leaves zero.

## Next Steps
1. Continue the port: draw thinned woodland, then fish and thirst, then herds (start of 6a); see the roadmap's 5-pre entry.
2. 5d: cold, natural caves and campfire hearths (Stage 1), then 5e golden crops and 5f stone huts. Plan posted, waiting for your go on the defaults.
3. A combined tuning pass over 5b to 5f once the features are in; decide the starting population (open question in the roadmap).
