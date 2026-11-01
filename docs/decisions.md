# Neolithic Engine — Decisions

Eighteen decisions are settled; change one only on purpose, record why here, and update the table in `docs/ROADMAP.md`.

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
| Genes | Six inherited traits: strength, bravery, greed, piety, charisma, curiosity | Blended from both parents, plus mutation; list still open |
| Culture | Habits blended from parents and neighbors, medium stickiness | One tunable number |
| Groups | Leader links only, no group table | A tribe is everyone under the same root leader, computed |
| Combat | Abstract clashes for groups, individual injury up close | |
| Resources | Food, wood, stone and gold, carried one at a time | Like Age of Empires II villagers |
| Religion | Builds cooperation, backs leaders, binds group identity | Works through shared ritual raising similarity |
| Viewer | Watch only: zoom, pan, tap to inspect, auto-camera | Stick figures up close; dots and colored regions zoomed out |
| Phone Host | Neolithic Engine takes over S21 exclusively | Stop `artificial-life` service while Neolithic runs to claim full CPU headroom |
| Art Style | WorldBox pixel art (procedural atlas) | Procedural sprite atlas in code, crisp pixels (smoothing off, integer zoom steps 1x, 2x, 3x...), 1 px/cell terrain offscreen cache with elevation shading and dirty redraws, small tree sprites on forest cells zoomed in, direct ImageData blit zoomed out, stick-figure sprites with deterministic ID offsets zoomed in, 30 FPS cap |
