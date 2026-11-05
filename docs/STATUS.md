## Unified Graphics & Zoom Consistency (branch `graphics-unification`)
- **Done**: Completed visual audit and established shared style rules (NW lighting, SE soft ground shadows `rgba(26, 18, 8, 0.30)`, 8-px art unit `ap`).
  - **Graves**: Retinted flat/zoomed-out marker from crimson `#8a2e22` (which conflicted with animal carcasses) to earth mound `#6b5238` with stick/bone cross `#e6dbbc`.
  - **Brush Heaps**: Added wood fleck markers to the land overlay (`COLOR_BRUSH_RGB = 0x305a7d`, alpha scaled with heap level) so ground brush accumulation on open land is visible before consolidating into a nest.
  - **Wolves**: Brightened zoomed-out dot from `#3c3c46` to `#5c5c68` for direct color linking to the wolf sprite's coat.
  - **Tap Selection**: Centered hit detection on the visual figure centroid `(cx + 0.5, cy + 0.5)`.
  - **Simulation Fingerprint**: Untouched (`881ea265aa76e667`).
  - **Verify**: `npm run verify` passes (type check, all 31 test suites, production build).
  - **Perf**: **5.30 µs / person / tick** at 11,596 people (budget 15.0 µs).
  - **Screenshots**: Could not be captured in headless environment (no Chrome/display server available). Requires a real browser watch on desktop / S21 per Rule 13.
- **Next**: Watch in Chrome to evaluate tap selection and zoom consistency; proceed to Phase 5e golden crops.

## Where things stand (2026-11-05)
`main` has everything below through Phase 5g bodies and childbirth hazards, and is pushed to `origin`. Built but not watched (rule 13): cold, caves and fires; wolves; huts; injury and grave marks; oblique art; fertility; childbirth hazards; bodies. Not built: 5e golden crops; walls and closed rooms.

- **Verify**: type check and build pass; tests 200 of 200 when run alone. One full run alongside other heavy jobs failed one test (not identified, its name was cut from the output) with 3 vitest worker timeouts, so the suite can fail under load: run it on a quiet machine. It takes 8 to 12 minutes.
- **Perf**: **4.63 µs / person / tick** at 11,596 people (budget 15). Fingerprint `881ea265aa76e667`.
- **Merge note**: `phase-5g-bodies` failed verify by itself: two carry-limit tests still asserted the fixed limit. They now check each person's strength-scaled limit.
- **Bodies and childbirth hazards together** (seeds 1 to 3, against both off, same seeds):

| Year | Seed 1 | Seed 2 | Seed 3 |
|---|---|---|---|
| 10 | 2332 vs 2876 (-19%) | 2544 vs 3192 (-20%) | 2348 vs 3037 (-23%) |
| 20 | 2633 vs 3631 (-27%) | 2863 vs 4315 (-34%) | 2515 vs 3615 (-30%) |

**For the tuning pass, not yet acted on:**
- Wounds look too common: seed 1 at year 4 has 1126 of 1658 people at injury 60 or more, mean 145 of 255.
- Population is about 2,500 to 2,900 at year 20, far from the 10,000 to 20,000 aim (3,600 to 4,300 with bodies and hazards off). `npm run perf` reaches about 12,000 only because it starts with 12,500 people and `landFoodMax` 45, so it measures speed at that size, not a world that grew there.
- Childcare's mate share looks ineffective: `mateId` is cleared at delivery, so after a birth the mother usually has no mate on record, and any later mate is from the next pregnancy, who may not be the father. Read from the code, not measured.

## Deterministic Childbirth Hazards (branch `feat-birth-hazards`)
- **Done**: Introduced physical and metabolic childbirth hazards without RNG:
  - Pregnancy upkeep surcharge (+25%, `pregnancyUpkeepMul` 1.25). Severe starvation (`energy <= 15.0`, `pregnancyMiscarriageEnergy`) triggers early miscarriage to preserve maternal life.
  - Delivery inflicts physical trauma directly to `people.injury` (`birthInjury` 40.0). Delivering inside a shelter (nest, cave, stone hut, or near campfire) cuts trauma by 65% (`birthShelterInjuryMul` 0.35); unsheltered delivery in freezing cold exacerbates trauma by up to 1.5x (`birthColdInjuryMul`) and inflicts hypothermic trauma on the newborn.
  - Mothers reaching full term with insufficient energy to deliver safely suffer delivery exhaustion: pregnancy terminates with partial trauma (`birthExhaustionInjury` 20.0) and stamina loss without live birth.
  - Reused existing typed arrays (`people.pregnant`, `people.injury`, `people.energy`) with zero per-person tick allocations. Energy ledger balances exactly (`ledger.violations === 0`). Full off-switch parity with `birthHazardsEnabled: false`.
- **Tests**: `tests/birth-hazards.test.ts` (pregnancy upkeep surcharge, starvation miscarriage, delivery trauma, shelter mitigation, cold exacerbation, failed delivery exhaustion, off switch parity, multi-generation ledger balance and save/restore determinism).
- **Perf**: **4.66 µs / person / tick** at 12,240 people (desktop budget 15.0 µs).

## Mutable Fertility (branch `feat-mutable-fertility`)
- **Done**: `Land.fertility` is now mutable Float32Array: degrades on overgrazing/stripping bare ground down to `fertilityMin` (0.05), improves via passive tending (tilled, seeded, healthy vegetated soil), composting spoiling food heaps, and active tending (seed dropping, tamping) up to `fertilityMax` (1.5). Saved in `LandState` snapshot and verified in `world.stateHash()`. Switch `fertilityChangeEnabled`.
- **Tests**: `tests/fertility.test.ts` (overuse degradation, explicit seed enrichment, tamping, passive tending, off switch parity, save/restore exact stateHash round-trip).
- **Verify**: all 27 test suites pass; **perf** 9.14 µs / person / tick at 14,163 population (budget 15).

## Phase 5c mounds and nests
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
- **Built**: stone on hill/rock tiles (finite); well-fed people on rock pick it up (`CARRY_STONE`), carry it to where people rest together and set it down, adding durability to that tile; at 60 durability the tile is a hut (shelter from the cold, 0.5x upkeep); durability erodes 1 per 64 ticks via a rotating slice, so unmaintained huts fall back to rubble. Huts reach the viewer as feature kinds 8 to 11, drawn as oblique stone huts. Switch `buildingEnabled`. Tests `tests/huts.test.ts` (7). Perf 4.4 us / person / tick. Needs a reset and a watch (rule 13): grey slab-roofed huts appearing where people live, thinning out where they leave.
- **Combat injury (same branch)**: clashes and wolf bites now wound (`people.injury`, saved and hashed): wounded people pay extra upkeep, lose some steps, and heal only when fed, so a hungry wounded person bleeds out. A wolf bites a lone person (takes energy, wounds) instead of killing outright. Violent and wound deaths leave a grave mark (feature kind 5). About 50 violent deaths a year at year 10; people 5% to 16% under an injury-off run; wolves persist on three seeds. Switch `injuryEnabled`. Tests `tests/injury.test.ts`. Grave marks are drawn as a small earth mound with a stick cross.

## 3/4 oblique art (on `phase-5f-structures`)
- An art agent redrew the objects (trees, stumps, caves, fires, nests, granaries, heaps, people, herds, wolves, carcasses) as 3/4 oblique sprites with back-to-front draw order; terrain stays flat. I added the oblique hut and grave sprites. Viewer only, no sim change. Verified with a software-canvas preview, not yet in a real browser: check tap-select feel (people feet moved half a tile), sprite scaling at cell sizes 10, 12 and 20, and frame time with big forests (per-frame sort).

## Phase 5g bodies (branch `phase-5g-bodies`, off `main`)
- Primitives 24, 25, 28, 19, 23. Life stages (children 0.6, elders 0.8 of adult work: forage bite, carry caps, clash strength); strength gene scales carry and work; childcare (a child under adult age costs its mother, split with a mate beside them); fatigue (steps raise it, standing still clears it; costs upkeep and lost steps); disease (touch spread, hashed spontaneous onset, upkeep drain, fed people recover faster). New per-person `fatigue` and `sick` Uint8 arrays through grow/spawn/kill/export/hash. Deaths with sickness leave grave marks. No viewer tint for the sick (the look byte has no free bit); outbreaks show as grave marks and population dips. Not yet watched in a browser (rule 13). Perf 5.6 µs/person/tick at 11.9k people. Old saves load with zeroed arrays.

## Next Steps
1. Watch the overdue features in a browser with a fresh world (rule 13), including the oblique art checks above.
2. Decide how closed rooms work (roadmap open question): huts are one tile today, but Phase 5's check asks for walls forming closed rooms.
3. Build 5e golden crops.
4. Combined tuning pass: wounds, population, childcare share, nests with no limit; decide the starting population.
5. Graphics work: use the `graphics` agent (`.claude/agents/graphics.md`), starting with an audit.
