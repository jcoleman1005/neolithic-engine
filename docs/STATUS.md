# Neolithic Engine — Status

## Current State
Phase 2 (Window) implemented on branch `phase-2-window`.
- **Fast Base64 Engine (`src/sim/base64.ts`)**: Lookup-table-accelerated cross-platform binary base64 encode/decode (~0.05 ms encode, ~0.5 ms decode for 50,000 bytes).
- **Packed Frame Protocol (`src/sim/protocol.ts`)**: 5-byte packed records per alive person (`slot` Uint16, `x` Uint8, `y` Uint8, `look` Uint8 bitfield) encoded into base64 over SSE.
- **Look Byte Encoding**: Bitfields capturing sex (bit 0), gestation/pregnancy (bit 1), life stage child/adult/elder (bits 2..3), and quantized energy levels (bits 4..7).
- **Person Details Inspection (`src/sim/world.ts`, `src/sim/protocol.ts`)**: Full person card details (`PersonDetail`) retrieved on request by slot or 32-bit ID without wire bloat during normal streaming.
- **Offscreen Cached Terrain Background (`src/render/renderer.ts`)**: Single 256×256 offscreen composite canvas caching terrain, elevation, and relief shading with zero redraw cost per frame.
- **WorldBox Art Style (`src/render/renderer.ts`)**: Crisp colored dots when zoomed out; vibrant WorldBox miniature pixel figures when zoomed in (head, hair, sex-colored tunic, pregnant belly bump, walking bob animation, and bouncing selection indicator).
- **Wrap-Aware Motion Smoothing (`src/render/renderer.ts`)**: Continuous lerp between frames using shortest modular difference across wrapping boundaries, eliminating wrap-edge streaking.
- **30 FPS Render Cap & Mobile Gestures**: Frame-rate capped render loop saving battery on Galaxy S21; pinch-to-zoom, mouse wheel, drag-to-pan, tap-to-select, and camera follow.
- **Person Card & HUD (`src/ui/inspector.ts`, `src/ui/controls.ts`, `src/style.css`)**: Compact WorldBox-style card with life stage badge, gestation progress, energy bar, parent navigation, and follow button; TPS readout on playback pill.
- **Phone Setup (`scripts/termux-boot.sh`)**: Script updated to stop `artificial-life` service to dedicate full CPU headroom on Galaxy S21 to Neolithic Engine.
- **Automated Tests (`tests/protocol.test.ts`, `tests/server.test.ts`, `tests/mechanics.test.ts`, etc.)**: 35 automated tests passing with zero failures.
- **Performance Benchmark (`npm run perf`)**:
  - Average population: 11,062
  - Tick duration: 2.801 ms / tick
  - **Perf: 0.253 µs / person / tick** on desktop (budget: <= 15.0 µs; 59× faster than budget).

## Next Steps
1. Verify S21 checks (8 hours unattended run, reboot resumption, and <= 30 µs/person/tick).
2. Merge `phase-2-window` into `main` after verification.
3. Begin Phase 3 (People): food and danger scent fields, climb/copy/touch rules, genes and habits.
