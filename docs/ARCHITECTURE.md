# Architecture & Codebase Map

A quick-reference architectural guide for AI coding agents.

## Core Invariants
- **Platform**: Runs in Node/Termux on Android (Galaxy S21) and desktop browser/worker.
- **Budget**: <= 15 µs / person / tick on desktop, <= 30 µs on S21 at 10,000 population.
- **Allocation Rule**: Zero heap allocations per person in the tick loop. Preallocated typed arrays (SoA).
- **Determinism**: Seeded PRNG (`src/sim/prng.ts`). Simulation never imports render or UI code.

## Directory Layout

### Simulation (`src/sim/`)
- `world.ts`: Simulation lifecycle, tick dispatch sequence, state export/restore, fingerprint hashing.
- `config.ts`: **All** tunable constants, mechanic switches (`*Enabled`), and baseline values.
- `land.ts`: Toroidal 256×256 map arrays (elevation, fertility, food, brush, stone, piles, built structures, wear).
- `people.ts`: Person storage via parallel typed arrays (`x`, `y`, `energy`, `genes`, `habits`, `carry`, `injury`, etc.).
- `life.ts`: Upkeep, natural birth, delivery hazards, starvation, foraging, butchering, aging.
- `rules.ts`: Physical interaction: `climb` (scent gradients), `copy` (imitation), `touch` (social & combat clashes).
- `fields.ts`: Diffused 256×256 scent fields (`food`, `danger`).
- `herds.ts` & `wolves.ts`: Herbivore and predator ecosystem dynamics.
- `naming.ts`: Procedural phonology, syllable tongue generation, epithets, band and place names.
- `bands.ts`, `settlements.ts`, `chronicle.ts`: Read-only observers (Rule 11).

### Rendering & UI (`src/render/` & `src/ui/`)
- `src/render/renderer.ts`: Single-canvas viewport, zoom levels, feature and overlay rendering.
- `src/render/palette.ts`, `autotile.ts`, `terrace.ts`, `terrain-tiles.ts`: Planimetric visual styling.
- `src/render/sprites.ts`: Procedural pixel-art sprites and character atlas.
- `src/ui/`: Web interface controls, auto-camera, metrics view, inspector card.

### Server & Infrastructure (`server/`, `scripts/`, `tests/`)
- `server/`: Node SSE event stream host, checkpoint autosave and backup engine.
- `scripts/verify.sh`: Full CI gate (`npm run verify` = typecheck + vitest + build).
- `scripts/perf.ts`: Performance benchmark (`npm run perf`).
- `tests/`: Mechanism, ledger, invariant, and baseline parity tests.
