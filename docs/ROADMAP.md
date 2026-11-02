# Neolithic Engine — Roadmap

Oct 31, 2026 · @Joshua Coleman

## Goal

Build a toy-physics antfarm on a dedicated Galaxy S21: stick-figure bands forage, settle, farm, burn, flood, raid and rebuild, and you watch the consequences happen on the map (and poke it with a brush). About 30 years pass per real hour; a written chronicle and the auto-camera help you follow along.

The bar to clear: consequences must be visible and dramatic on the ground, even though the rules underneath are simple. Nothing at the level of raids, tribes or states is scripted, and nothing is gated behind unlock flags; it all has to grow out of land, bodies, costs and rewards. Drama comes from physics (fields, fuel, soil, stockpiles), never from scripted events.

The work is done by a coding agent (Claude Code or Antigravity) in a new repo, `neolithic-engine`, seeded from `artificial-life` at commit `ca3e97f`. Export this doc to Markdown as `docs/ROADMAP.md`, and paste the Agent rules section into the new `AGENTS.md`.

## Locked decisions

These decisions are settled; change one only on purpose, record why in `docs/decisions.md`, and update this table.

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
| Genes | Eight inherited traits: strength, bravery, greed, piety, charisma, curiosity, wisdom, cruelty | Blended from both parents, plus mutation |
| Culture | Each habit inherited from one parent at random, plus drift and rare innovations; habits also shift with experience (winning, hunger, help received) | Replaces blending, which halved differences every generation. Tunables in `config.ts` |
| Groups | Leader links only, no group table | A tribe is everyone under the same root leader, computed |
| Combat | Abstract clashes for groups, individual injury up close |  |
| Resources | Food, seeds, wood and stone, carried one at a time; meat piles from dead animals are food on the land | Like Age of Empires II villagers. Gold only if raids need loot. No ability is locked behind a flag; things appear when their physics exists |
| Religion | Builds cooperation, backs leaders, binds group identity | Works through shared ritual raising similarity |
| Viewer | Watch, plus a poke brush: zoom, pan, tap to inspect, auto-camera; brush drops grain now, fire and water in Phase 6 | Stick figures up close; dots and colored regions zoomed out. The brush changes land and items only, never people's rules, and goes through the host in a fixed, seeded order |

## Starting point

Keep the plumbing of `artificial-life`, adapt its geography and observers, and replace its organism core. The core is the problem: organisms are objects in a map with string IDs, a 52-input brain and a DNA genome, which is why they cost 177 µs each on the S21.

| Area | Files in `artificial-life` | Action | Notes |
| --- | --- | --- | --- |
| Host and transport | `src/sim/host.ts`, `worker.ts`, `protocol.ts`, `server/*`, `src/ui/simulation-client.ts` | Adapt | Keep the host, the 250 ms catch-up cap, SSE and frame merging. `WorldView` sends maps of organism objects; replace with packed arrays |
| Phone service | `scripts/termux-boot.sh`, server options (`ALIFE_MAX_SPEED`, saves, backups) | Keep | Rename the `ALIFE_` prefix only if it's cheap |
| Determinism and tools | `src/sim/prng.ts`, `state-hash.ts`, `scripts/fingerprint.ts`, `perf.ts`, `verify.sh`, `vitest.config.ts` | Keep | Repoint at the new world |
| Experiment runner | `scripts/experiment.ts` | Adapt | It imports brain and DNA code; cut it down to a headless run with seeds, years and on/off switches |
| Energy ledger | `src/sim/ledger.ts` | Keep | No imports; wire it to people in Phase 1 |
| Saving | `exportState()` / `fromState()` pattern, `server/store.ts`, `src/ui/saved-worlds.ts` | Adapt | New save format at version 1; old saves don't load |
| Geography | `src/sim/terrain.ts`, `elevation.ts`, `src/render/terrain-paint.ts`, `elevation-paint.ts` | Adapt | Plates, rivers, lakes and ocean; built for 60 x 60 with no wrapping |
| Land physics | `src/sim/grazing.ts`, `seasons.ts` | Adapt (seasons done in Phase 5a) | Cell health that drops when bitten and recovers with rest; `grazing.ts` depends on a type in `plants.ts` |
| Names and events | `src/ui/names.ts`, `src/sim/events.ts`, `history.ts`, `src/ui/events-view.ts`, `history-view.ts` | Adapt | Become the chronicle, the ticker and the trend charts |
| Kin | `src/sim/lineage.ts`, `family.ts` | Adapt | Move to slot-plus-generation IDs |
| Page shell | `src/main.ts`, `src/ui/sheet.ts`, `controls.ts`, `dom.ts`, `inspector.ts`, `legend.ts`, `metrics-view.ts`, `src/style.css` | Adapt | Strip organism-specific panels |
| Renderer | `src/render/renderer.ts` (2,178 lines) | Adapt | Keep camera, smoothing and overlays; rewrite what gets drawn |
| Groups | `src/sim/groups.ts` | Replace | Colour buckets become root-leader tribes |
| Organism core | `src/sim/world.ts`, organism parts of `types.ts`, `brain.ts`, `brain-trace.ts`, `dna.ts`, `policy.ts`, `sensors.ts`, `memory.ts`, `traits.ts`, `lifehistory.ts`, `sex.ts`, `growth.ts`, `plants.ts`, `genes.ts`, `tags.ts`, `species.ts`, `speciation.ts`, `activity.ts`, `metrics.ts` | Replace | New flat-array people world |
| Organism views | `src/ui/brain-view.ts`, `species-view.ts`, `species-settings.ts`, `lineage-view.ts`, `organism-card.ts`, `peek-view.ts` | Delete | A new person card replaces `organism-card.ts` |
| Weather | `src/sim/weather.ts` | Reuse ideas | Written for the 60 x 60 grid; rewritten for 256 x 256 wrapped in Phase 6 |
| Tests | 51 files in `tests/` | Delete most | Keep the patterns in `prng`, `snapshot`, `server` and `host` tests |
| Docs | `AGENTS.md`, `WORLD_RULES.md`, `docs/*` | Replace | New `AGENTS.md`, `docs/ROADMAP.md`, `STATUS.md`, `decisions.md`, `findings.md` |

This sort comes from module headers, imports and the `artificial-life` docs, not a line-by-line read; Phase 0 confirms it while stripping.

## Architecture

One `SimulationHost` owns all world state and runs in the Termux server on the phone (or a Web Worker on desktop); the page only draws what the host sends it.

&#91;embedded content: runtime architecture · worker and page\]

Everything that decides history happens in the host, so the renderer can be rewritten without touching the simulation.

### Files

```
neolithic-engine/
  AGENTS.md             agent rules (from this doc)
  docs/                 ROADMAP.md, STATUS.md, decisions.md, findings.md
  server/               kept: Termux host, SSE out, saves, backups
  scripts/              verify, fingerprint, perf, run (headless), termux-boot.sh
  src/sim/config.ts     every tunable number and feature switch
  src/sim/host.ts       kept: tick timing, catch-up cap, viewers
  src/sim/worker.ts     kept: browser host for desktop work
  src/sim/protocol.ts   rewritten: packed frames
  src/sim/prng.ts       kept (also state-hash.ts, ledger.ts)
  src/sim/people.ts     new: typed arrays, free list, IDs
  src/sim/land.ts       adapted terrain, elevation, grazing; wrapped
  src/sim/fields.ts     new: food and danger scent fields
  src/sim/spatial.ts    new: counting-sort neighbor lookup
  src/sim/life.ts       new: metabolism, birth, death, genes, habits
  src/sim/rules.ts      new: climb, copy, touch
  src/sim/world.ts      new: tick order, save and restore
  src/sim/chronicle.ts  adapted from events.ts
  src/render/           adapted renderer and sprites
  src/ui/               adapted page shell
  tests/
```

### Data rules

- One typed array per field. Float32 for energy and other continuous values; clamp any write that could overflow.
- A person's ID is a Uint32: 20 bits of slot and 12 bits of generation, so a reference to someone who died never points at a newborn.
- An alive flag and a free list. Arrays start with spare room and double when full.
- The tick loop allocates nothing: no objects, strings, closures or maps per person.

### Wrapping

- Positions wrap with modulo 256.
- One shared "shortest difference" helper is used for distance, neighbor lookup, diffusion and on-screen smoothing.

### Frames

- A frame packs each person into a few bytes (x, y, a look byte), sent as base64 inside the existing SSE stream. Today's server turns typed arrays into plain JSON arrays, which is too big at 10,000 people.
- The existing frame merging caps viewers at about 10 frames a second; the selected person's full record is sent only on request.

### Saving

- Keep the server's saves (every 5 minutes and on shutdown, plus hourly compressed backups) and the browser auto-save for desktop work.
- Save and restore must reproduce the world exactly; a test checks the round trip.

### Headless runs

- `scripts/run.ts` runs the same simulation in Node with no screen, so 200 years finish in minutes on desktop and print one stats line per year.

## Agent rules

Thirteen rules for the coding agent; paste this section into `AGENTS.md` as it stands.

1. At the start of a session, read `AGENTS.md`, `docs/STATUS.md` and the current phase in `docs/ROADMAP.md`. At the end, update `docs/STATUS.md`: what was done, what is next.
2. Work one phase at a time, on a branch per task off `main`. Merge when `npm run verify` passes; tick a phase's checks only when a run or the S21 confirms them.
3. First reply on a task: a short plan only (files touched, new state, risks, open questions). Then build it.
4. Script nothing at the level of groups. No raid, tribe, leader or state rules; change the land, bodies, costs or rewards instead.
5. Every tunable number lives in `src/sim/config.ts`. Log each tuned value, old and new, and why, in `docs/findings.md`.
6. Seeded random numbers only, in a fixed order. No `Math.random()` or `Date.now()` in simulation code, which never imports render or UI code.
7. The tick loop uses typed arrays and allocates nothing per person.
8. Run `npm run perf` at 10,000 people before merging. Stay at or under 15 µs per person per tick on desktop; report the number in `docs/STATUS.md`.
9. New mechanics go in on by default, with a switch in `config.ts` so an off run can be compared.
10. Tests check mechanisms and invariants: energy balances, wrapping, slot reuse, save round trip, same seed gives the same fingerprint. Never assert that a behavior emerges.
11. Observers (chronicle, tribes, city-state detection, names) only read the world, draw no random numbers, and change no outcome.
12. Ideas outside the current phase go to the Parking lot. Agree bigger changes with the user first and record them in `docs/decisions.md`. Keep chat output short: summary tables, not logs.
13. Every phase names a visible consequence, something you can point at on the map, and closes only when someone has watched it happen. Metrics alone do not close a phase.

## Roadmap at a glance

&#91;embedded content: roadmap · 10 phases in 4 stages, a gate each\]

Phases run in order. Phase 1 is highlighted because every later phase inherits its balance and its speed.

## Phase details

Each phase lists its goal, the tasks with the files they touch, and the checks that close it. Give the agent one phase per session.

### Phase 0: Fork and strip

Goal: a working app with an empty 256 x 256 world, built from `artificial-life`.

- Create `neolithic-engine` from a copy of `artificial-life` at `ca3e97f`, without its git history; name that commit in the README.
- Delete the files marked Replace and Delete in Starting point. Stub `World` with land and no people, so the host, worker, server and page still run.
- New `SimulationConfig`: world size 256, wrapping on, seed, ticks per year 360, plus switches. Drop every organism setting.
- Cut `scripts/experiment.ts` down to `scripts/run.ts` (`npm run sim -- --seed 3 --years 50`), printing one stats line per year.
- Replace `AGENTS.md` with the Agent rules, add this doc as `docs/ROADMAP.md`, start a fresh `STATUS.md`, `decisions.md` and `findings.md`, and remove `WORLD_RULES.md` and the old specs.

* [x] `npm run verify` passes.
* [x] The dev page and `npm run server` both show an empty world.
* [x] `npm run sim` prints a line per year.

### Phase 1: Life

Goal: a population that neither dies out nor explodes, within the speed budget.

- `src/sim/people.ts`: typed arrays, alive flag, free list, slot-plus-generation IDs, doubling, save and restore.
- `src/sim/land.ts`: terrain and elevation adapted to 256 x 256 with wrapping; plant food per cell that regrows along a curve and stops below a floor (adapted from `grazing.ts`).
- `src/sim/spatial.ts`: counting-sort neighbor lookup with prefix sums (an array of cells + 1, no -1 entries), wrapping.
- `src/sim/life.ts`: energy leak each tick, forage, wander, mate with a nearby fed adult of the other sex who isn't close kin, pregnancy, birth, death by starvation or old age.
- Wire `ledger.ts` so every unit of energy is booked.

* [x] Population stays in a steady band for 200 years on 5 seeds.
* [x] The ledger balances, and the same seed gives the same fingerprint.
* [x] At most 15 µs per person per tick on desktop at 10,000 people.

Watch out: this is the hardest tuning in the project, and every later phase inherits it. Log every tuned number.

### Phase 2: Window

Goal: watch Phase 1 on the S21, running for hours.

- `protocol.ts`: packed frames (x, y and a look byte per person, base64 in SSE); the selected person's record on request.
- Renderer: terrain cached as one 256 x 256 image, people as dots, smoothing that handles the wrap edge, 30 FPS cap, zoom, pan, tap to inspect.
- Page: year, population and ticks-per-second readout, speed dial, a person card in place of the organism card.
- On the phone: install with `scripts/termux-boot.sh`, set `ALIFE_MAX_SPEED` for about 3 ticks a second, open Chrome at `localhost`, run `npm run perf` in Termux.

Ongoing audit gate: it does not block later phases; tick each check only when the S21 confirms it.

* [ ] 8 hours on the S21 without a crash or a temperature collapse.
* [ ] The world resumes after a force-close and after a reboot.
* [ ] At most 30 µs per person per tick on the S21 at 10,000 people.

### Phase 3: People

Goal: groups form, follow and clash with no group code.

- `src/sim/fields.ts`: food and danger scent fields on the CPU, double-buffered, diffused every few ticks, wrapping.
- `src/sim/rules.ts`: climb, copy and touch, each with a switch. Heavy decisions staggered by ID, every 8 to 16 ticks.
- Six genes, eight habits, parent and mate links, and a leader link for whoever someone currently follows.

* [x] Bands visibly gather around strong or charismatic people.
* [x] Groups split past some size instead of growing forever.
* [x] With touch switched off, border clashes disappear.
* [x] Still within the speed budget.

### Phase 4: Chronicle

Goal: an hour of watching produces a readable history.

Frozen after this phase: no more work on names, epithets or thresholds. A new chronicle detector is added only with a visible physical event (fire, flood, drought, famine, a settlement founded or lost).

- `src/sim/chronicle.ts` from `events.ts`: detectors for famine, boom, migration, group split, clash, and the death of a notable person.
- Names from `names.ts` for people, groups and places; a tracked list of notable people.
- Ticker from `events-view.ts`, a plain-English inspector, and an auto-camera that drifts to the most interesting event.
- A "while you were away" summary when Chrome reopens.

* [x] An hour yields 10 to 30 entries that match what was on screen.

### Phase 5: Settle and farm

Goal: some groups settle while others stay nomadic, in the same run, and you can see why.

Visible consequence: farmland, houses and granaries on the map; overworked land turning to desert.

- Seasons from `seasons.ts` (5a, done): regrowth swings with the year.
- Calm movement (fix, built): people stay and graze on rich tiles so repeated harvesting is real.
- Farming is 100% physics, with no unlock flag and no discovery step: trampled or worked soil regrows faster, overgrazed soil degrades, seeds are an ordinary carried item, and a tired person who rests drops the seeds they carry. Whatever grows from dropped seeds is farming. (5b)
- Home anchors, food stockpiles, houses and granaries as land state; sprites for trees and buildings; overgrazed land drawn as desert. (5c)
- Poke brush, first tool only: "Drop grain" in the inspector, so you can test stockpiles, soil regrowth and dragging by hand. Handled by the host in a fixed order, seeded, saved. (built with 5b)

* [ ] Settled and nomadic groups coexist for 100 years or more.
* [ ] Land recovery time is tuned against how long a migration front takes to circle the map.
* [ ] A farm is visible as a patch on the map, and overworked land is visible as desert.

### Phase 6: Weather and disaster

Goal: the sky and the ground act on people, and you can read what happened from the ground.

Visible consequence: dry brown grass in drought, flooded riverbanks, black scorch marks after fire.

- A moving weather field (rain fronts, dry spells), flooding along rivers and lakes, and fire that spreads through grass and forest from seeded lightning, all as fields and costs. Rewritten from the ideas in `artificial-life` `weather.ts` for 256 x 256 wrapped. No scripted disaster events.
- Legibility rule: consequences are drawn on the terrain. Never an opaque cloud or rain overlay that hides people; any front indicator is faint and never covers figures.
- Poke brush adds "Light fire" and "Spawn water".
- Chronicle detectors for fire, flood and drought come with it.

* [ ] A drought, a flood and a fire each happen in a typical run and leave marks you can see.
* [ ] Burned ground regrows; floodplains are richer afterwards.
* [ ] Bands visibly flee or suffer, with no group rule saying so.

### Phase 6b: Animals and hunting

Goal: other living things add food and danger to the land.

- Dumb herbivores that wander and flee, and leave a meat pile (food on the land) when they die; simple wolves that wander and emit danger scent. Rules stay at wander-and-flee: no pack tactics, no scripted hunts.

* [ ] Herds and wolves persist for 50 years or more without taking over the map.
* [ ] Hunting and wolf danger visibly change where people go.

### Phase 7: Raids and defense

Goal: stored wealth attracts raids, and defense makes them costly.

- Wood and stone (gold only if loot needs it), a stockpile per resource, walls and towers.
- Abstract clashes for groups, health and injury for individuals, loot carried home, danger marked in the scent field.

* [ ] Raids target stockpiles rather than random people.
* [ ] Walled settlements survive more raids than open ones.
* [ ] Raiding is neither universal nor absent.

### Phase 8: Leaders and city-states

Goal: polities spanning several settlements rise and fall.

- Cached root leaders, refreshed a slice per tick; loyalty that rises with protection and falls with taking.
- Tribute as repeated touch between leaders and followers; territory computed from root leaders; borders and flags drawn.
- City-state detection (followers, walls, granary, territory) for borders and headlines, as an observer.

* [ ] A typical run produces at least one multi-settlement polity that later breaks apart.

### Phase 9: Religion (optional)

Optional: decide after Phase 8 whether it earns its place. Goal: shared ritual lets groups grow larger before they split.

- Shrines, ritual gatherings that cost time and food and raise similarity and loyalty, piety, punishing defectors, and standing for leaders who host rituals.

* [ ] Groups that practice ritual hold together at larger sizes than groups that don't.

### Phase 10: On the shelf

Goal: the phone runs worlds for weeks unattended.

- Dim mode and a slight pixel shift against burn-in; keep-awake in Chrome.
- When a world dies out or stagnates, archive its chronicle and start a new one.
- A profiling pass that optimizes only what the S21 benchmark shows is slow.

* [ ] One week unattended, with a readable archive of finished worlds.

## Open creative questions

These calls were yours to make; each is needed by the phase in brackets. The agent should ask when it reaches one.

- [x] Does `artificial-life` keep running on the S21, or does Neolithic take the phone over? Two servers can share it, but they split one CPU core's worth of headroom. (Phase 2) — *Neolithic Engine takes over exclusively; artificial-life stopped.*
- [x] Art direction: palette, sprite size, and how the zoomed-out view looks. (Phase 2) — *WorldBox game style art: vibrant terrain, miniature pixel figures up close, crisp dots zoomed out.*
- [x] Final trait list: keep the six, or add something like cruelty or wisdom, up to eight. (Phase 3) — *Expanded to 8 traits: strength, bravery, greed, piety, charisma, curiosity, wisdom, cruelty.*
- [x] What mostly makes people follow someone: food, strength, kin or charisma? All four will count; pick the one weighted most. (Phase 3) — *Balanced multi-attribute utility: equal base weights in config; observer's own genes modulate respect (greed respects wealth, piety respects wisdom).*
- [x] What the auto-camera treats as interesting: battles, foundings, deaths of leaders, migrations? (Phase 4) — *Settled in `decisions.md`: battles > split or new band > leader death > migration.*
- [x] Naming style for people and places: an invented language, or English compounds like Ashford? (Phase 4) — *Invented names plus English descriptive words; see `decisions.md`.*
- [x] Which abilities start locked and must be discovered: farming, walls, ritual, crafting? (Phase 5) — *None. No unlock flags; farming and building are physics.*

## Parking lot

These ideas are deferred on purpose; revisit them after Phase 10 or when a phase clearly needs one.

- Seas, rivers you can sail, and boats
- Trade, markets and debt networks
- Healing, teaching and burying the dead
- Costly signaling and prestige goods
- Small evolving brains, only for a few notable characters, borrowed from `artificial-life`
- GPU diffusion and WebAssembly, only if the S21 benchmark demands them
- Chronicle entries written by a language model (needs a server off the phone)
