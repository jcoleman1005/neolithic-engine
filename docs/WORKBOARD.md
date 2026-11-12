# Work board

The board says who is working on what, so sessions don't build the same thing twice. Read it before starting work. Update it when you claim, finish or drop something, and commit the update on `main` (docs only) or on your own branch. Last reviewed 2026-11-09 (batch of steps 0 to 5: fix merge, units A to D claimed).

## How to use it

1. **Claim first.** Before starting a task, add or update its row below: your session's name, branch, worktree, the files you expect to change, and status. If someone else's row covers the same mechanic or files, stop and ask the user. Don't start a parallel version.
2. **One owner per branch.** Never commit to another session's branch, and never retire or delete one you don't own. Merge `main` into your own branch. Merge your branch into `main` only when `npm run verify` passes and the user has agreed.
3. **One worktree per session.** Work in your own worktree, never in another session's checkout, and leave no merge or rebase half-done when you stop.
4. **Busy files.** `src/sim/rules.ts`, `src/sim/life.ts`, `src/sim/config.ts` and `src/render/renderer.ts` are edited by most tasks. List them in your row when you change them. Add new config keys in a block of your own, with a comment naming the stage.
5. **Plan of record.** The settlement work follows `docs/SETTLEMENTS.md` and the phases follow `docs/ROADMAP.md`. If a task isn't there, agree it with the user and record it in `docs/decisions.md` first.
6. **Hand-offs.** When you stop, update your row: status, what's next, and anything not committed (there should be nothing).

## Claims

| Work | Branch | Worktree | Owner session | Files | Status |
|---|---|---|---|---|---|
| Settlements S3: coordination, the S3a re-run (step 4) and the S4 draft (step 5) | `settlements-s3` | `neolithic-engine-structures` | Neolithic Engine 11/5/26 | `docs/*`; map dumps in `scratch/` | Coordinating units A to D below. Merges each unit's PR to `main` after verify and an off-switch fingerprint check. S3 is not closed until your rule-13 watch. |
| **A.** Place-cost memory (S3x item 2), switch `placeCostEnabled` | `s3x-place-cost` | Katie's laptop | katies-laptop-effervescent-sunset | `src/sim/rules.ts`, `life.ts`, `people.ts`, `config.ts`, `types.ts`, `world.ts`; `tests/turmoil.test.ts`, `chronicle.test.ts`; `scripts/place-cost-probe.ts` (new; wound probe untouched) | Merged to `main` on 2026-11-09 (PR #4), **switched off by default** (your decision): losers-away target missed because fights are rare; revisit in the end-of-plan tuning pass. |
| **B.** S3 art: fight / give-way marker, building in progress, earth and stone colours, carry marks, dirt path | `viewer-s3-art` | own worktree on dhcp-10-56-164-95 | graphics agent of Neolithic Engine 11/5/26 | `src/sim/protocol.ts`, `host.ts`, `src/ui/simulation-client.ts`, `src/render/renderer.ts`, `walls.ts`, `src/ui/legend.ts`; `visual/` | Merged to `main` on 2026-11-09 (PR #3), verify green with the visual check, fingerprint unchanged (`fa5596d7e60c04ca`). Waits for your rule-13 watch; frame time not measured. |
| **C.** 5f port: ray enclosure, wind shadow, hearth anchor | `s3-exposure-port` | Katie's laptop | katies-laptop-effervescent-sunset | `src/sim/land.ts`, `seasons.ts`, `settlements.ts`, `config.ts`, `types.ts`; `tests/exposure.test.ts`, `settlements.test.ts`; `scripts/perf.ts`, `map-dump.ts` | Merged to `main` on 2026-11-09 (PR #5); default fingerprint unchanged. Sub-switches on, but they act only with `exposureEnabled` (still off). |
| **D.** 5f port: wall crossing and breakout, doorway extras, switch `wallCrossingEnabled` | `s3-wall-crossing` | own branch in `neolithic-engine-structures` | Neolithic Engine 11/5/26 (laptop offline) | `src/sim/rules.ts`, `life.ts`, `config.ts`, `types.ts`; `tests/exposure.test.ts` | Built here 2026-11-09, off by default with S3a; targets met (`docs/findings.md`). Merged after verify. |
| Phase 6b weather and disaster, stage 6b-1 climate and moisture (`weatherEnabled`) | `phase-6b-weather` | `neolithic-engine-structures` | Neolithic Engine 11/5/26 | new `src/sim/weather.ts`, `tests/weather.test.ts`, `scripts/weather-probe.ts`; `src/sim/land.ts`, `life.ts`, `world.ts`, `config.ts`, `types.ts`; `host.ts`, `protocol.ts`, `simulation-client.ts`, `renderer.ts` | 6b-1 closed 2026-11-12: merged (off by default), accepted by the user after round 3 and a 12-year watch (rain clouds read well). 6b-2 wildfire parked (branch `phase-6b-wildfire`, not merged). |
| Watchability #3: 3a activity byte per person (observer only) and 3b poses and event pops. 3c camera moments not built (user decision: the camera stays off) | `claude/busy-mccarthy-vw1tsc` | cloud | Neolithic Engine cloud session 11/12/26 | `src/sim/activity.ts` (new), `people.ts`, `life.ts`, `rules.ts`, `world.ts`, `protocol.ts`, `config.ts`, `types.ts`; `server/viewer-stream.ts`; `src/render/poses.ts` (new), `renderer.ts`, `sprites.ts`; `src/ui/capture-hook.ts`, `legend.ts`, `feature-switches.ts`; tests | Built and pushed on the branch; not merged to `main`. Waits for the user's rule-13 watch and merge approval. |
| Faster verify: parallel test files, calibrated test loops | `main` (d2832f8, dce6b48) | n/a | made by an earlier session; verified and pushed by Neolithic Engine 11/5/26 | `vitest.config.ts`, `scripts/verify.sh`, `tests/*` | Done on `main`. |
| Phase 5f structures (ray enclosure, wind shadow, doorways, wall crossing, hearth anchor) | `phase-5f-exposure` (d38588c, not pushed) | main checkout `neolithic-engine` | unknown (no active session claims it) | `src/sim/land.ts`, `life.ts`, `rules.ts`, `seasons.ts`, `settlements.ts`, `config.ts`; `tests/exposure.test.ts` | **Retired by the user's decision of 2026-11-08:** `settlements-s3` is the one structures branch. Don't merge it to `main`. Its ideas are queued below. Branch deleted on 2026-11-08 at the user's request; its one commit, d38588c, holds the ideas queued below. |
| Persistent-walk jitter (shelved, switched off; probes and notes kept) | merged to `main` via PR #1 (885e024) | cloud | Jitter computation logic review (cloud session) | `src/sim/jitter.ts`, `config.ts`, `types.ts`; `tests/jitter.test.ts` | Done and shelved: jitter had little effect (`docs/findings.md`). Added to the board after the fact on 2026-11-08. |
| Visual verification: Playwright screenshots of the camera, terrain, water and cliffs, pixel-diffed against `visual/baseline/`, run from `npm run verify` with `VERIFY_VISUAL=1` | `claude/visual-verification-setup-x8cmbi` | cloud | Neolithic Engine 11/8/26 (cloud session) | `scripts/visual-check.ts`, `visual-lib.ts`, `visual-snapshot.ts`, `png.ts`, `verify.sh`; `src/ui/capture-hook.ts`, `src/main.ts` (the `?capture` block), `src/render/renderer.ts` (one read-only `cameraState()` getter, 10 lines); `tests/visual-lib.test.ts`; `visual/` | Merged to `main` on 2026-11-08 by Neolithic Engine 11/5/26, with the visual step made opt-in. Baselines regenerated after `settlements-s3` merged. |
| Save version check: saves carry `schema`; a build refuses a newer schema or unknown per-person fields. Bump `SAVE_SCHEMA` when a save gains state | `claude/visual-verification-setup-x8cmbi` | cloud | Neolithic Engine 11/9/26 (cloud session) | `src/sim/world.ts` (`SAVE_SCHEMA`, `fromState`), `src/sim/people.ts` (`PERSON_FIELDS`, `importState`); `tests/snapshot.test.ts` | Merged to `main` (42fcc73). Anyone adding a field to `PackedPerson` must also add it to `PERSON_FIELDS`, or `tsc` fails by design. |
| Fix: `People.grow()` mid-tick left `LifeSystem.step` writing to stale typed arrays (lost gestation tick and mateId on the tick a birth forced a resize) | `ccr-7234c5d4-p92vis` | cloud | Neolithic Engine cloud session 11/9/26 | `src/sim/life.ts` (a pre-grow block at the top of `step`), `src/sim/people.ts` (`reserve()`); `tests/people-grow-midtick.test.ts` | Merged to `main` on 2026-11-09 by Neolithic Engine 11/5/26 after verify. Its owner can retire the branch. |
| Merge of `main` into the S3 work (parallel copy) | `settlements-s3-b` | `.claude/worktrees/bridge-cse_01RaXxaJwZqqG6mXpDarUq92` | Neolithic Engine 11/6/26 | none now | Paused by its owner. Everything on it is now on `settlements-s3` (the fearX/fearY fix and the chronicle battle-test pin included), so its owner can retire it. |

## Queue: Phase 5f ideas to port into S3, one at a time, each with a switch and measured

Now claimed as units C and D above. Taken from `phase-5f-exposure` (commit d38588c), whose perf was 14.2 µs per person per tick, close to the 15 µs budget. That's a reason to port them one at a time and measure each.

1. **4-way ray enclosure** (cardinal rays up to 4 tiles; enclosed tiles drop to a low exposure). Candidate for S3b's exposure field.
2. **Wind shadow** downwind of walls, cliffs and woods. Candidate for S3c.
3. **Doorways from traffic:** carriers avoid unloading on well-worn tiles, so entrances stay open. S3d.
4. **Wall crossing and breakout:** stepping over a strong wall costs extra energy and wears it. S3d.
5. **Hearth anchor:** the settlement observer anchors on fires, nests, granaries and walls rather than one-tile huts. S0 follow-up, observer only.

## Needs a person

- A rule-13 watch of S3 and S3x once units A to D are merged (S0, S1 and S2 passed on 2026-11-09).
- Whether to turn S3a (`exposureEnabled`, `directionalBuildEnabled`) on by default, after the step-4 re-run.
- Approving the S4 draft (step 5).
- Whether `data/` (the saved world) is backed up.

Closed on 2026-11-09: the old stash was dropped; carried water not being visible in the viewer is accepted for now (your decision).
