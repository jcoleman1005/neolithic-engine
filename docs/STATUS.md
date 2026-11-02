## Current State
Phase 4 step 4c (auto-camera, inspector text, "while you were away") built on branch `phase-4c-camera`, not yet merged. 4a and 4b are merged.

- **Auto-camera (`src/ui/auto-camera.ts`)**: pure state machine over real time. Follows the oldest band of 20+ and stays with it until it dies; shots last at least 30 s; a queued event of higher priority takes over after the hold (battle 4, split or new band 3, leader death 2, migration 1); famine and boom never move it; drifts slowly when idle; backs off 20 s after a manual pan, zoom or tap, and while "follow selected" is on. Settings are in `config.ts` (`cameraHoldSeconds`, `cameraResumeSeconds`, `cameraDriftCellsPerSecond`, `cameraMinBandSize`, switch `autoCameraEnabled`). A "Cam" button in the playback pill toggles it.
- **Renderer**: `setCameraTarget` plus an eased glide (about 0.7 s time constant) that keeps pan in whole pixels, so zoom stays crisp. `onUserInput` fires on wheel and pointer down.
- **Host data**: panels now carry `bands` (large bands with name, size, centroid, founding tick) and `selectedStory` (plain-English lines about the selected person).
- **Inspector**: shows "Kesh the Cruel of the Varn" and a line such as "Leads 83 followers near Vakel Ridge." or "Follows X, with N others, near Y."
- **While you were away (`src/ui/away-view.ts`)**: the browser remembers the last event seen in `localStorage` (wrapped in try/catch). On reconnect, newer chronicle entries show in a dismissible card: at most 8, most important first, in the order they happened, with "and N more". Nothing shows on a first visit, when nothing is new, or when the world was reset. The host keeps only the last 100 events, so a long absence shows only the recent part.
- **Verify**: `npm run verify` passes. New tests: `tests/auto-camera.test.ts` (13), `tests/away-view.test.ts` (6).
- **Perf**: 13,736 people, 46.917 ms/tick, **3.416 us / person / tick** (budget 15.0). Camera and away card are viewer code and do not touch the tick.
- **Not checked in a browser**: the Chrome extension was not connected, so I could not look at the camera glide, the Cam button, the inspector text or the away card on screen. The server built and started (port 8080) and the page type-checks and builds, but nobody has watched it run. The roadmap check "an hour yields 10 to 30 entries that match what was on screen" stays unticked.

## Next Steps
1. Open the app (`npm run server`, then http://localhost:8080) and watch: does the camera glide to battles and new bands, does the Cam button toggle it, does a manual pan hold it off for 20 s, does the inspector text read well, does the away card appear after closing and reopening the tab?
2. Merge `phase-4c-camera` after that look, then watch an hour and tick the Phase 4 check.
3. Phase 5: Settle and farm.
