# Neolithic Engine — Status

## Current State
Phase 2 (Window) Art & Protocol implemented on branch `phase-2-worldbox-art`.
- **Phase 1 Bug Fixes Merged (`main`)**:
  - `mateId: Uint32Array` added to `People` so a woman's `fatherId` is unchanged across mating and childbirth, and newborn receives mother's mate ID as father.
  - Streaming `StateHasher` expanded to hash every per-person array for living people, every land array (`food`, `maxFood`, `fertility`, `isWater`), PRNG state, and tick.
  - Zero-allocation direct loop over `spatial.cellStarts` and `spatial.cellPeople` during mating, eliminating closure allocation per woman per tick.
- **Procedural Sprite Atlas (`src/render/sprites.ts`)**:
  - Code-generated offscreen canvas atlas containing stick-figure sprites (adult male, female, pregnant female with belly bump, child, elder, starving, walking animation frames), tree variants (oak, pine, fruit), and selection chevron.
- **WorldBox Terrain Rendering (`src/render/renderer.ts`)**:
  - Offscreen 1 px/cell ($256 \times 256$) canvas rendered with elevation hillshading and WorldBox palette (deep water `#154273`, shallows `#277da1`, sand `#e9c46a`, grass shades `#489a5b` / `#57cc99`, forest `#2d6a4f`, hills `#8a817c`, mountain `#bcb8b1`, snow `#f8f9fa`).
  - Nearest-neighbor scaled blit; redrawing only changing cells.
- **Crisp Pixels & Whole-Number Zoom Snapping**:
  - `imageSmoothingEnabled = false` across all rendering contexts.
  - Zoom snapped strictly to whole-number integer scales ($1\times, 2\times, 3\times, 4\times, 5\times, 6\times, 8\times, 10\times, 12\times, 16\times, 20\times, 24\times, 32\times$) for mouse wheel and mobile pinch-to-zoom.
- **Zoomed-In Forest Trees**:
  - Visible forest cells rendered with small tree sprites from the atlas when zoomed in ($cellSize \ge 6$).
- **Dual-Mode People Rendering**:
  - **Zoomed out**: Colored pixels written directly into an `ImageData` 32-bit buffer and composited in $<0.1$ ms.
  - **Zoomed in**: Stick figures rendered from the atlas with view frustum culling and deterministic sub-pixel offsets derived from person ID to prevent cell-stacking.
- **30 FPS Render Cap & Mobile UX**:
  - Frame-rate capped render loop saving battery on Galaxy S21; wrap-aware motion smoothing; tap-to-inspect and follow camera.
- **Automated Verification (`npm run verify`)**:
  - 37 automated tests across 7 test suites passing with zero errors.
- **Performance Benchmark (`npm run perf`)**:
  - Average population: 11,062
  - Tick duration: 2.622 ms / tick
  - **Perf: 0.237 µs / person / tick** on desktop (budget: <= 15.0 µs; 63× faster than budget).

## Next Steps
1. Verify S21 checks (8 hours unattended run on Galaxy S21, reboot resumption, and <= 30 µs/person/tick).
2. Merge `phase-2-worldbox-art` into `main`.
3. Begin Phase 3 (People): food and danger scent fields, climb/copy/touch rules, genes and habits.
