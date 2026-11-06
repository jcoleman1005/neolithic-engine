# Neolithic Engine — Decisions

Decisions are settled; change one only on purpose, record why here, and update the table in `docs/ROADMAP.md`.

| Area | Decision | Notes |
| --- | --- | --- |
| Repo | New repo `neolithic-engine`, seeded from `artificial-life` at `ca3e97f` | `artificial-life` stays as it is; nothing is merged back |
| Platform | The simulation runs as the Node server in Termux on the S21; Chrome on the same phone is the viewer | Already proven by `artificial-life`; no background-tab throttling |
| Hosts | One `SimulationHost`, run by the Termux server on the phone or a Web Worker for desktop development | Same code in both |
| Engine budget | At most 30 µs per person per tick on the S21, 15 µs on desktop | `artificial-life` organisms measured 177 µs on the S21 |
| Determinism | Seeded random numbers and a fingerprint check stay | Free here, and it lets an agent prove a refactor changed nothing |
| Pace | 1 tick is about 1 day, 360 ticks a year, about 3 ticks a second | About 30 years per real hour; a speed dial for fast-forward |
| World | 256 x 256 cells that wrap at the edges | Fog of war lifts where anyone has walked |
| Population | Grows with no fixed cap; aim for 10,000 to 20,000 | Arrays double when full |
| Currency | One energy number per person that leaks every tick | Zero means death; surplus above a threshold becomes a child |
| Behavior | Three local rules: climb, copy, touch | Following, raiding and tribute are names for patterns, not code |
| Jobs | None; labels come from what someone has done recently | Skill grows with practice |
| Genes | Eight inherited traits: strength, bravery, greed, piety, charisma, curiosity, wisdom, cruelty | Blended from both parents, plus mutation; list settled in Phase 3 |
| Culture | Each habit inherited from one parent at random, plus drift and rare innovations; habits shift with experience | Replaces blending (halved differences each generation). Tunables in `config.ts` |
| Groups | Leader links only, no group table | A tribe is everyone under the same root leader, computed |
| Combat | Abstract clashes for groups, individual injury up close | |
| Resources | Food, seeds, brush and stone, carried one at a time; meat piles are food on the land | Like Age of Empires II villagers. Gold only if raids need loot |
| Religion | Builds cooperation, backs leaders, binds group identity | Works through shared ritual raising similarity |
| Viewer | Strictly watch-only: zoom, pan, tap to inspect, auto-camera | Stick figures up close; dots and colored regions zoomed out. No input reaches the simulation |
| Phone Host | Neolithic Engine takes over S21 exclusively | Stop `artificial-life` service while Neolithic runs to claim full CPU headroom |
| Art Style | WorldBox pixel art (procedural atlas) | Procedural sprite atlas in code, crisp pixels (smoothing off, integer zoom steps 1x, 2x, 3x...), 1 px/cell terrain offscreen cache with elevation shading and dirty redraws, small tree sprites on forest cells zoomed in, direct ImageData blit zoomed out, stick-figure sprites with deterministic ID offsets zoomed in, 30 FPS cap |
| Phase 4: Naming | Invented names + English descriptive words | Each band has a "tongue" (small syllable set) seeded from founder's lineage; split bands inherit tongue with slight drift. People: "Kesh of the Varn". Notable leaders get English epithet from traits/deeds ("the Tall", "the Cruel", "Twice-Exiled"). Places: invented root + English landform from terrain ("Varn Ridge", "Oshel Marsh"). Derived purely by hashing IDs (never simulation PRNG). |
| Phase 4: Camera | Focus band tracking with event priority | Follow oldest large band between events; switch only on death or higher-priority event; hold shots >= 30s; slow idle drift. Priority: Battles between bands > band split/new band > death of leader with 20+ followers > long migration. Famine/boom in ticker only. |
| Phase 4: Chronicle | 10–30 entries/hr target at 1x | Battle: multi-clashes between same two bands within a few days (bands >= 20 only). Thresholds tuned and logged to hit target. |
| Direction | A toy-physics antfarm: visible, dramatic consequences on the ground | The goal paragraph in the roadmap was reworded; history and the chronicle are by-products. Drama priority: land and weather, buildings and stockpiles, raids and politics |
| Authoring | Physics only, rule 4 kept | World drama is a field, a cost or a reward (weather field, fire fuel, soil), never a scripted group event |
| No locked abilities | No unlock flags, no discovery step | Farming is physics: worked soil regrows faster, tired people drop carried seeds. Walls and ritual appear when their physics exists |
| Chronicle | Half and half; frozen after Phase 4 | New detectors only for visible physical events. No more work on names, epithets or thresholds |
| Phase order | 5 Settle and farm, 6 Weather and disaster, 6b Animals and hunting, 7 Raids and defense, 8 Leaders and city-states, 9 Religion (optional), 10 On the shelf | Physical world before social ladder |
| Weather legibility | Consequences drawn on the ground | Dry brown grass, flooded riverbanks, black scorch marks. No opaque overlay over people |
| Animals | Phase 6b: dumb herbivores (meat piles) and simple wolves (danger emitters) | Wander-and-flee only |
| Phase 2 gate | Ongoing audit, does not block | Ticked only when the S21 confirms |
| No player tools | The poke brush was approved and then dropped before it shipped | The engine runs as a completely autonomous, untouched terrarium. Keeps determinism pure, removes reverse input plumbing, keeps the focus on autonomous toy-physics emergence |
| Calm movement | People on a tile with at least half its food stay and graze; a 180 degree step back needs a strong pull | Fixes jitter (65% reversals); `prevDir` is saved and hashed; switch `calmMovementEnabled` |
| Identity | An autonomous, self-running colony sim from primitive hunter-gatherers: a self-playing RimWorld or Dawn of Man terrarium that begins in the deep Stone Age | Replaces the "toy-physics antfarm" wording; the antfarm decisions (physics only, watch-only, no flags) all stand |
| Start state | Year 0: small nomadic bands; zero structures, zero advanced tools, zero farming; caves and campfires are the only early shelters | A test checks the structure and farm arrays are empty at tick 0. Starting population (now 1,000) is an open question |
| Zero management | No player blueprints, no build orders, no assigned jobs | Colonists act on internal drives, physical affordances and local imitation |
| Architectural arc | Stage 1 brush nests, lean-tos, cave shelters; Stage 2 trampled crop clearings and communal hearths; Stage 3 dry-stone huts, preserved granaries, defensive barricades | Built by stigmergy: dropped, stacked and tamped material that snaps into a form. In code, the brush-built form is a `nest`; `hut` is reserved for the dry-stone form |
| Readable visuals | Top-down pixel art: glowing campfires, food mounds, golden crop patches, stone walls closing into rooms | Rule 13 applies: a phase closes when someone has watched it |
| Phase 5 split | 5a seasons, 5b farming (done), 5c mounds and nests (built), 5d cold, caves and campfires, 5e golden crops and hearths, 5f stone and dry-stone huts | Barricades move to Phase 7 |
| Phase order | 5 Primitive to settled, 6a Animals and hunting, 6b Weather and disaster, 7 Raids and defense, 8 Leaders and city-states, 9 Religion (optional), 10 On the shelf | Hunting is promoted ahead of weather so the Stone Age start has meat. Supersedes the earlier phase-order row |
| 2026-11-02 | Finite resources | Fold the `exp-finite-resources` prototype into the plan: port it in pieces after 5c (trees feed brush, berries/fish/water as land arrays, herds start Phase 6a). The branch is not merged as is. |
| 2026-11-04 | World shape | Land is 64% of the map (sea fraction 0.28), small land-locked lakes are dropped, hills begin at height 0.68 so green land is about 40% of the map; a new world starts with 700 people. Earlier tuning was done on the old map and is re-checked in the combined pass. |
| 2026-11-04 | Art: 3/4 oblique objects | Things standing on the map (trees, stumps, caves, fires, nests, heaps, people, herds, wolves, carcasses) are redrawn as 3/4 oblique sprites: front face visible, height drawn upward, north-west light, small ground shadow. Terrain, hillshading, overlays and the grid stay flat top-down for now; terrain gets its own pass later. Viewer only: no sim change, no new packed channels. Supersedes "top-down pixel art" in the Readable visuals row for objects. |
| 2026-11-05 | Art: Unified Graphics & Zoom Consistency | Standardize on NW illumination, SE ground shadows, and 8-px art unit. Retint zoomed-out graves to earth/bone (#7a5832 / #e6dbbc) to decouple from carcasses (#8a2e22); add zoomed-out brush heap markings in overlay; brighten zoomed-out wolf markers to #5c5c68 for coat parity. |
| 2026-11-05 | Settlement plan | Settlements, villages and cities follow `docs/SETTLEMENTS.md`. Other sim work from `docs/primitives.md` follows that plan rather than running alongside it; spoilage, tending and 5e move into its S4 |
| 2026-11-05 | How settlements form | Physics plus local habits: no planner and no scripted upgrades, and tiers such as village or town are observer labels only. Building habits spread by imitation |
| 2026-11-05 | Why people stay | The real benefits of a place (stores, shelter, safety, resources) must drive staying. No home anchor (primitive 54) and no new place scent |
| 2026-11-05 | Shelter and rooms | Continuous exposure replaces yes/no shelter when its switch is on, and rooms are simply places where exposure is low. Answers the closed-rooms question. Walls stay one tile thick and cost energy to cross rather than blocking movement |
| 2026-11-05 | Art: planimetric | `docs/art-style-planimetric.md`: flat top-down ground and unroofed floor-plan walls at every zoom, low-profile oblique figures. Replaces oblique structures from the 2026-11-04 row; lifting roofs were considered and dropped |
| 2026-11-05 | City scale | Stay on 256 x 256. A city is about 1,000 to 5,000 people, roughly 3,000 to 4,000 tiles, so only a few fit. A larger map stays in the Parking lot |
| 2026-11-05 | Toroidal Geography & Seamless Edges | Elevation generation and value noise use toroidal distance and modular wrapping when `config.wrapping` is enabled. Continental plates, noise, priority flood, and riparian lifts connect seamlessly across east-west and north-south edges without boundary seams. Renderer displays a single centered map bounded by dark void margins when zoomed out. Auto-camera disabled by default on startup. |
| 2026-11-05 | Tuning deferred | Tuning that a stage's targets ask for, including S1's missed "lasted at least double" on seed 2 and the extreme wounds, waits for one combined pass at the end of the settlement plan. Stages report a missed target and move on |
| 2026-11-05 | Carried water | Water becomes an ordinary hand-carried item (one thing at a time) poured into small stores at camps; thirsty people can find and drink from stores. Chosen over a personal waterskin, which would break the one-carry rule. The carried items are now food, seeds, brush, stone, packed earth and water. Wells and waterskins go to the Parking lot |
