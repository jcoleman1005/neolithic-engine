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
| Resources | Food, seeds, wood and stone, carried one at a time; meat piles are food on the land | Like Age of Empires II villagers. Gold only if raids need loot |
| Religion | Builds cooperation, backs leaders, binds group identity | Works through shared ritual raising similarity |
| Viewer | Watch, plus a poke brush: zoom, pan, tap to inspect, auto-camera; brush drops grain (Phase 5), fire and water (Phase 6) | Stick figures up close; dots and colored regions zoomed out. Brush acts on land and items only |
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
| Poke brush | Initial infrastructure in Phase 5 with Drop grain; fire and water in Phase 6 | Host handles pokes in a fixed seeded order; saved with the world |
| Calm movement | People on a tile with at least half its food stay and graze; a 180 degree step back needs a strong pull | Fixes jitter (65% reversals); `prevDir` is saved and hashed; switch `calmMovementEnabled` |
