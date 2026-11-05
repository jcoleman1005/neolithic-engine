# Neolithic Engine: 100 primitives

**Order:** sim work from this list follows `docs/SETTLEMENTS.md` (decision 2026-11-05). Don't start an item here unless that plan's current stage calls for it.

Numbers match the original list. Sections: **A** already in the sim (17), **B** partly there (11), **C** new (72).

## Rules that apply to every primitive (from AGENTS.md)

- Do not script anything at group level. No raid, tribe, leader or state rules. Change land, bodies, costs or rewards instead.
- Typed arrays only. Allocate nothing per person in the tick loop. New per-person arrays must grow with `People.grow`, reset in `spawn`/`kill`, and go through `exportState`/`importState`.
- Every tunable number lives in `src/sim/config.ts`. Log each tuned value (old, new, why) in `docs/findings.md`.
- Every new mechanic ships on by default with a switch in `config.ts`, so an off run can be compared.
- Seeded random numbers only, drawn in a fixed order. No `Math.random()` or `Date.now()` in sim code.
- Energy is conserved. Anything that moves energy in or out of people or the land gets a line in `src/sim/ledger.ts`.
- Any new state array must be saved, restored, and added to `World.stateHash()`. Note that `Land.exportState` currently saves only `food`.
- Observers (chronicle, names, detection of buildings, hierarchies and shrines) only read the world, draw no random numbers, and change no outcome.
- Tests check mechanisms and invariants (energy balance, wrapping, slot reuse, save round trip, same seed gives the same fingerprint). Never assert that a behavior emerges.
- Work one phase at a time. Reply first with a short plan (files, new state, risks, open questions). Ideas outside the current phase go to the Parking lot.
- Suggested first slice for Phase 5: 1, 2, 5, 7, 8, 9, 29 to 36, 45 to 48.

### Working efficiently (cuts usage)

- Read only `AGENTS.md`, `docs/STATUS.md`, the current phase in `docs/ROADMAP.md`, and the entries you are about to build here. Do not read the whole repo. Skip `docs/findings.md` (long tables; find its last row with Grep and append) and everything under `src/render/` and `src/ui/` unless the item touches the viewer.
- Find code with Grep on the function or array name, then Read a window with offset and limit (about 40 lines either side). `rules.ts`, `life.ts` and `people.ts` are 400 to 700 lines each; never read them whole.
- One edit pass per file. Do not re-read a file after editing it. Group items that touch the same function into one change.
- Do not spawn subagents for these tasks; each one starts cold and re-reads context.
- Iterate on short runs: `npm run sim -- --seed 3 --years 20` and one targeted test file. A 200-year run takes about 5 minutes per seed on desktop (see `docs/findings.md`), so run 200 years on several seeds once, at the end, to tick a phase check. Run `npm run perf` and the full `npm run verify` once before merging, not after every edit.
- Take one slice per session: 3 to 6 items from one section. Never attempt a whole section or the whole list.
- Prove a new primitive changes nothing when its switch is off: same seed, same fingerprint as before (`scripts/fingerprint.ts`; check `package.json` for the npm script name).
- Report back in a short table: item numbers, files changed, switch name, test and run results, perf number. No logs and no file dumps (rule 12).

---

## A. Already in the sim

**Agent guidance:** Treat these as a fixed contract and the hooks new primitives plug into. Do not read their files in full and do not change their behavior unless an entry in B or C says to. To see one, Grep its function or config name and read a small window. If you must touch one, put the change behind a new switch and confirm the same-seed fingerprint is unchanged with the switch off.

3. **Regrowth** — Plant food recovers along a logistic curve toward `maxFood`. Lives in `Land.step` (`landRegrowthRate`). Reuse it; do not add a second regrowth path.
4. **Depletion floor** — A cell cannot be grazed below `landGrazingFloor`. Lives in `Land.graze`.
15. **Energy as the single currency** — `People.energy` (Float32). Zero means death, surplus above `reproductionThreshold` funds a child. All flows are booked in `EnergyLedger`.
16. **Leak** — `metabolismCost` is subtracted from every living person each tick in `LifeSystem.step` (step 3).
17. **Move cost** — `moveCost` is subtracted per step taken in `LifeSystem.step` (step 5).
52. **Experience habits** — Outcomes nudge habits in small steps: hunger raises forage and roaming, wins raise belligerence, help raises generosity and loyalty. See `Rules.experienceNeeds`, `Rules.nudgeHabit`, switch `experienceHabitsEnabled`.
53. **Innovation** — At birth, a rare chance (`habitInnovationRate`) makes one habit jump by up to `habitInnovationRange`. Lives in the childbirth block of `LifeSystem.step`.
58. **Exploration** — The curiosity gene plus the roaming habit set the chance of a random step in `Rules.climb`.
59. **Leader link** — `leaderId` per person, `rootLeaderId` cached and refreshed a slice per tick. Chosen by `Rules.copy` using `scoreAttraction`. A band is everyone under one root leader; there is no group table.
60. **Mate link** — `mateId`, set by the mating search (step 7 of `LifeSystem.step`), which skips close kin.
61. **Kin links** — `motherId` and `fatherId` per person, used for kin avoidance and for allied tests.
62. **Ally test** — `Rules.isAllied`: follows or is followed, shares a root leader, mates, maternal siblings, parent and child.
63. **Sharing with hungry allies** — In `Rules.touch` (section 1), a fed person gives `shareEnergyAmount` to a hungry ally or to anyone when generosity is high.
75. **Clash** — In `Rules.touch` (section 2), belligerent non-allies fight; the loser forfeits `clashLossShare` of energy, may die, and retreats. Observer log: `ClashLog`.
77. **Ally bonus in fights** — `Rules.countNearbyAllies` adds to each side's clash score.
80. **Danger scent** — `ScentFields.dangerCurrent`, deposited on deaths and clashes (`depositDanger`), diffused and evaporated, read by `Rules.climb` as aversion.
86. **Tolerance by similarity** — `Rules.habitDistance` below `cultureToleranceThreshold` suppresses clashes; above it, clash chance rises with `cultureClashSlope`. Switch `cultureTouchEnabled`.

---

## B. Partly in the sim (finish these)

**Agent guidance:** Finish these, do not rewrite them. Each is a small diff in code that already exists: Grep the named function or array, read a window, edit. Batch items that touch the same function (18, 24, 25 and 28 all land in `life.ts` or `rules.ts`) into one pass. Reuse an existing array before adding a new one. Default behavior must be identical with the new switch off, so add the switch first and check the fingerprint.

6. **Fertility that changes** — `Land.fertility` is set once in `initFoodCapacities` and never changes, and it is not saved. Make it mutable (improves with tending, degrades with overuse), and save and hash it.
13. **Passability** — Movement only checks `isWaterAt`. `config.ts` holds slope and drag values (`elevationSlopeUp`, `swimLandDrag`, etc.); check whether anything reads them, and if not, decide whether to wire slope cost into movement.
18. **Hunger drive** — Hunger only shifts the forage and roaming habits. `Rules.climb` always blends food scent, danger scent and leader pull. Add a drive chosen from body state that selects which gradient dominates (food, home, shrine).
24. **Life stages** — `adultAge` gates mating and leader attraction, and the frame look byte shows child, adult, elder. Add stage differences in yield, carry capacity and cost.
25. **Pregnancy and childcare** — Gestation, `birthTax` and `childEnergy` exist. Add an ongoing cost for dependent children.
28. **Strength gene** — Only used in the clash score and in leader scoring. Also scale carrying and work output.
56. **Success bias** — `scoreAttraction` includes the target's energy, but only for choosing a leader. Generalize it so people also copy knowledge and habits from whoever is visibly doing well.
68. **Loyalty** — `HABIT_LOYALTY` is nudged by receiving help, but nothing reads it. Make it fall when a leader only takes and rise with protection, and let it decide when followers drop a leader.
93. **Devotion habit** — `HABIT_DEVOTION` is inherited and shown in the inspector, but no sim code reads it. Use it as the trigger for attending gatherings (88).
94. **Piety gene** — Only used in `scoreAttraction` (wisdom value). Also use it to scale ritual effect and sacrifice (92, 95).
100. **Notable tracking** — The chronicle follows bands, leaders and large battles. Check `src/sim/chronicle.ts` for whether individuals beyond leaders are tracked before extending it. Observer only.

---

## C. New

**Agent guidance:** Build shared state once and reuse it. Items 1, 2, 31 and 45 are the shared foundation (cell stock, material IDs, the carry slot, the knowledge bitmask); do them first and let later items consume them. Check an entry's dependencies before starting it (for example 11 needs 7 and 10, 42 needs 43, 88 needs 87 and 89). Each item should be roughly one file, one config switch and one mechanism test. Never add a second full pass over `capacity` or over the 65,536 cells when an existing loop can carry the work.

### Land and materials

**Agent guidance:** Land arrays live in `land.ts` next to `fertility`. Add all the arrays for your slice in one edit, and extend `exportState`, `importState` and `World.stateHash()` once for all of them rather than per item (today `exportState` saves only `food`, so also save `maxFood` and anything tending changes). Run per-cell updates for 8, 9 and 14 inside the existing 65,536-cell loop in `Land.step`, not in separate loops; if perf shows a cost, process a rotating slice per tick like `refreshRootLeadersSlice`. Season (10) needs no stored state: derive it from `tick % ticksPerYear`. Good invariant tests: material is never negative, stock never exceeds the stack limit, save and restore reproduces every array.
1. **Stock per cell** — Typed arrays in `land.ts` holding an amount per cell per material (start with food, wood, stone). Needed by nearly everything below.
2. **Material types** — Material IDs as constants: food, wood, stone, fiber, clay, ore, gold. Start with three; add others when a recipe needs them. Each has a decay rate in `config.ts`.
5. **Tending** — When a cell is harvested lightly and repeatedly, raise its regrowth multiplier; let it decay back when untended. Farming is this physics, not a rule. Switch `farmingEnabled` (already declared with no code behind it).
7. **Durability** — Uint8 per cell, rising as build materials are deposited. Observers decide what counts as a building from it.
8. **Erosion** — Durability falls a little each tick, processed in a rotating slice of cells like the root-leader refresh. Buildings need upkeep or they vanish.
9. **Spoilage** — Stored food loses a fraction per tick, less on durable or containerized cells. Lost energy goes to a ledger line.
10. **Season** — A year clock from `ticksPerYear` that modulates regrowth and cold. Deterministic, no random draws.
11. **Shelter factor** — A cell with enough durability reduces the cold-season energy leak for people on it. Depends on 7 and 10.
12. **Water access** — A static per-cell value from proximity to water (precomputed from `isWater` and riparian data) that raises yield.
14. **Path wear** — Uint8 per cell incremented when stepped on and decaying slowly; high wear lowers move cost.

### Body and needs

**Agent guidance:** Add every new per-person array in a single edit of `People` (constructor, `grow`, `spawn`, `kill`, `exportState`, `importState`) plus `stateHash`; doing them one at a time repeats the same six edits. Fold new costs into the existing per-person loops in `LifeSystem.step` (steps 3 to 5) instead of adding passes. Book each new energy term in the ledger in the same edit that introduces it, or `ledger.check` will fail every tenth tick. Disease (23) must draw random numbers in a fixed order; note any change to draw order in `docs/findings.md`, since it changes every fingerprint.
19. **Fatigue** — Per-person Uint8 raised by moving and working, cleared by standing still; high fatigue slows or raises the leak.
20. **Cold stress** — Extra per-tick leak in the cold season for anyone not on a sheltered cell. Book it as upkeep.
21. **Injury** — Per-person Uint8 set by clashes; slows movement and drains energy until healed.
22. **Healing** — Injury decays when the person is fed and still.
23. **Disease** — Per-person flag spread through `touch` with a seeded chance; drains energy, then clears or kills. Draw random numbers in a fixed order.
26. **Carry capacity** — One item at a time (settled in the roadmap), so a person has one carry slot, not an inventory.
27. **Skill** — A few per-person Uint8 skills (foraging, building, making) that rise with use and decay without it. Keep the count small.

### Carrying and making

**Agent guidance:** Put materials, recipes and tools in one new data file (for example `src/sim/recipes.ts`) as constant typed tables, not objects looked up per person. Build in this order: 41, 31, 29, 30 (stack limit, carry arrays, pick up, drop), test them, then 32 to 36 on top. Run recipe checks only for people standing on a cell with stock, staggered by ID like `Rules.copy`, never every person every tick. Best invariant test: material is conserved (inputs consumed equals output plus refuse), and a person never holds two items.
29. **Pick up** — Move an amount from cell stock into the person's carry slot; fails if already carrying something else or the cell is empty.
30. **Drop** — Move the carried amount onto cell stock up to the stack limit; clear the carry slot.
31. **Carried item** — `carryType` and `carryAmount` arrays on `People`. Handle them in `grow`, `spawn`, `kill`, export/import, `stateHash` and the inspector.
32. **Work time** — A per-person countdown for multi-tick actions; the person stays put while it runs.
33. **Combine** — At a cell, if stock or carried items match a recipe and the person knows it, consume the inputs and produce the output after the work time.
34. **Recipe table** — A constant table: inputs, output, work ticks, required knowledge bit. This is tech physics, not group behavior.
35. **Build progress** — Depositing a build material adds durability to that cell in proportion, capped at 255.
36. **Structure type** — Uint8 per cell set by the recipe or material that raised its durability (store, shelter, wall, shrine, hearth). Observers name it.
37. **Tool item** — A separate per-person tool slot (so the one-carry rule holds) that the forage, build and clash code consult.
38. **Tool wear** — Uses remaining on a tool; at zero it breaks and the slot clears.
39. **Tool bonus** — Per-tool multipliers in `config.ts` applied to the forage bite, build amount or clash score.
40. **Container** — An item or structure that raises the stack limit or lowers spoilage for stock on its cell.
41. **Stack limit** — Maximum stock per cell per material, in `config.ts`.
42. **Cooking** — A recipe that turns food into higher-energy or slower-spoiling food; needs a hearth (43) and a knowledge bit.
43. **Hearth** — A structure cell with a fuel stock that burns down; while lit it enables cooking and warms nearby people.
44. **Refuse** — Leftover material from crafting stays as a small stock on the cell.

### Knowledge and learning

**Agent guidance:** Keep everything in one Uint32 bitmask per person with a constant prerequisites table. Run discovery (46) and observation (48) in the existing staggered decision slot (`(tick + slot) % decisionStaggerInterval`, next to `Rules.copy`), so no new loop is needed. Test mechanisms only: a bit is never gained without its prerequisites, a bit is gone once its last holder dies, and the bitmask round-trips through save. Do not test that anything gets discovered (rule 10), and never keep a global "discovered" set the sim reads (50); observers may count holders read-only.
45. **Knowledge bit** — A `knowledge` Uint32 bitmask per person. Newborns start empty and learn from others.
46. **Discovery chance** — While working or foraging, a person with the right ingredients and a curious gene rolls a seeded chance to gain a bit whose prerequisites they already hold. Stagger by ID like the other decisions.
47. **Prerequisites** — A table saying which bits must be held before another can be discovered or learned.
48. **Observation** — In `copy` and `touch`, a person may copy a bit from a nearby holder, with chance scaled by curiosity and distance.
49. **Teaching** — Higher transfer chance between kin or leader-follower pairs during `touch`.
50. **Loss** — No code of its own: bits live only in people, so when the last holder dies the bit is gone. Never keep a global "discovered" set that the sim reads; observers may count holders read-only.
51. **Skill decay** — Skills (27) drop slowly when unused.
54. **Home anchor** — *Not to be built (decision 2026-11-05): people stay because of the real benefits of a place; see `docs/SETTLEMENTS.md`.* Original idea: `homeX` and `homeY` per person, set where they last sheltered or stored goods; used as a pull in `Rules.climb`.
55. **Danger memory** — A small per-person memory of where harm happened, used as extra aversion. Optional; the danger scent (80) already covers most of this.
57. **Conformity** — In `Rules.copy`, weight the local majority's habit above an individual candidate's.

### Bonds and signals

**Agent guidance:** Partner-specific memory (64 to 66) is expensive if stored per pair. Store one partner ID and one small counter per person (two arrays) and overwrite when someone more significant appears. Reuse the existing `touch` pairing for all of it so no new neighbor scans are added. For the mark channel (71) and call (72), copy the structure of `ScentFields` (double-buffered Float32, diffusion in one loop) and add channels to the same diffusion pass rather than a second loop. Each extra channel adds about 512 KB and one more diffusion term, which is fine against the current 3.3 µs per person budget but should be measured with `npm run perf`.
64. **Reciprocity memory** — Per-person slot for who last helped them and how much; sharing in `touch` favors that person.
65. **Debt** — A small signed counter toward one partner ID, raised by receiving help.
66. **Grudge** — A counter toward one partner ID raised by harm; raises clash chance with that person.
67. **Reputation** — A per-person Uint8 raised by generosity and wins, readable by neighbors in `scoreAttraction`.
69. **Tribute** — On `touch` between a follower and their leader, transfer a small amount upward when loyalty is high. An internal transfer, so the ledger balance is unchanged.
70. **Redistribution** — A person standing at a stock gives from it to a hungry ally on the same cell, extending sharing (63) to stored goods.
71. **Mark channel** — Uint8 per cell of signs left by people who spent time there, decaying slowly. Foundation for territory, shrines and burial.
72. **Call** — A short-range signal: a transient scent channel deposited at the caller that allies' `climb` weights.
73. **Badge** — Bits in the frame look byte derived from habits so the viewer can show cultural groups. Render and protocol only.
74. **Dialect** — A habit-like trait compared during teaching and touch; a mismatch lowers transfer chance.

### Conflict and protection

**Agent guidance:** All combat outcomes already flow through `Rules.touch` (section 2). Change the scoring and outcome terms there instead of writing a new combat function, and leave the `ClashLog` push untouched (rule 11). Changing clash frequency shifts the chronicle: battle entries are thresholded at 150, 300 and 700 clashes, and the target is 10 to 30 entries per 30-year hour. After any change here, run a short headless run and the chronicle count script, and log any retuned threshold in `docs/findings.md`. Cheap check: compare clashes per year on seed 1 over 30 years with the switch on and off.
76. **Courage** — Before a clash, compare ally-adjusted odds to the bravery gene; below a threshold the person retreats instead (reuse `retreatStep`).
78. **Loot** — The winner of a clash also takes the loser's carried item.
79. **Stock scent** — Stored goods emit a scent channel (as land food does today) so people with a taste for taking climb toward it.
81. **Wall** — A structure type whose durability adds to defenders' clash score on that cell.
82. **Lookout** — Elevated or tower cells extend `leaderSearchRadius` and scent sensing for people standing on them.
83. **Weapon item** — A tool type that raises clash strength.
84. **Combat injury** — Clash outcomes set injury (21) instead of only draining energy.
85. **Territory mark** — Marks (71) left by a band's habits feed the tolerance rule (86), so strangers on marked ground are less tolerated.

### Ritual and meaning

**Agent guidance:** Build in dependency order: 71 (marks), 87 (shrine), 89 (pulse), 88 (gathering), then 90 to 92. The calendar pulse is just `tick % N === 0`, with no stored state or random draws. Gathering should reuse `Rules.climb` by adding a shrine channel and a drive (18), not a new movement routine. The similarity pull uses the existing `Rules.nudgeHabit`, and the payoff already exists in the tolerance rule (86), so no new clash code is needed. Measure the effect with the existing `npm run bands` and `npm run culture` scripts (ritual on versus off, rule 9) instead of writing new instrumentation.
87. **Shrine** — A structure type cell that accumulates marks and attendance.
88. **Gathering** — People with high devotion (93) move toward a marked cell at each calendar pulse and stay a few ticks.
89. **Calendar pulse** — A world-level periodic tick every N ticks that everyone can read. No random draws.
90. **Ritual cost** — Attending costs energy and work time, booked in the ledger. Switch `ritualEnabled` (already declared with no code behind it).
91. **Synchrony** — The effect scales with the number of attendees on the same cell at the pulse.
92. **Similarity pull** — Attendees' habits are nudged toward the attendee mean (use `Rules.nudgeHabit`). The existing tolerance rule (86) then turns that similarity into fewer clashes.
95. **Sacrifice** — A person destroys carried or stored material at a shrine, booked as a ledger loss, in exchange for a loyalty or devotion gain.
96. **Taboo** — A habit bit that makes `Rules.climb` treat certain cells or actions as to be avoided.

### Time and pressure

**Agent guidance:** Hazard events (98) should draw from the world PRNG at one fixed point, once a year when `tick % ticksPerYear === 0`, so draw order stays deterministic; say in `docs/findings.md` that fingerprints changed. The burial mark (97) is a single write on death, but death happens in several places (starvation, old age and movement in `life.ts`, clashes in `rules.ts`): Grep `people.kill(` and call one shared helper from each site rather than duplicating the write. The crowding penalty (99) can read the spatial index's per-cell counts that `spatial.build` already produces, so it needs no extra neighbor scan.
97. **Burial mark** — When someone dies, write a mark (71) at their cell. Persistent and read-only for observers.
98. **Hazard events** — Seeded yearly events (drought lowers regrowth in a region, flood, plague) drawn from the world PRNG in a fixed order. Switchable.
99. **Crowding penalty** — Per-cell density raises disease chance and speeds depletion of that cell.
