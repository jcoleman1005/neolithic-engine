# Work board

The board says who is working on what, so sessions don't build the same thing twice. Read it before starting work. Update it when you claim, finish or drop something, and commit the update on `main` (docs only) or on your own branch. Last reviewed 2026-11-08.

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
| Settlements S3: structures, carried water, turmoil (healing, contest, place cost), and the S3b to S3d port | `settlements-s3` | `neolithic-engine-structures` | Neolithic Engine 11/5/26 | `src/sim/rules.ts`, `life.ts`, `land.ts`, `people.ts`, `config.ts`, `types.ts`, `world.ts`; `tests/turmoil.test.ts`, `exposure.test.ts`, `water-carry.test.ts`; `scripts/*-probe.ts` | Active. `main` (through the work board) merged in on 2026-11-08, verify green. Next: the place-cost memory, then port the Phase 5f ideas (below). Not merged to `main`; needs a quiet-machine verify, your review and a rule-13 watch. |
| Faster verify: parallel test files, calibrated test loops | `main` (d2832f8, dce6b48) | n/a | made by an earlier session; verified and pushed by Neolithic Engine 11/5/26 | `vitest.config.ts`, `scripts/verify.sh`, `tests/*` | Done on `main`. |
| Phase 5f structures (ray enclosure, wind shadow, doorways, wall crossing, hearth anchor) | `phase-5f-exposure` (d38588c, not pushed) | main checkout `neolithic-engine` | unknown (no active session claims it) | `src/sim/land.ts`, `life.ts`, `rules.ts`, `seasons.ts`, `settlements.ts`, `config.ts`; `tests/exposure.test.ts` | **Retired by the user's decision of 2026-11-08:** `settlements-s3` is the one structures branch. Don't merge it to `main`. Its ideas are queued below. The main checkout is left mid-merge (conflict in `docs/STATUS.md`, plus `REBASE_HEAD` and `stash@{0}`), for the user to finish or abort. |
| Merge of `main` into the S3 work (parallel copy) | `settlements-s3-b` | `.claude/worktrees/bridge-cse_01RaXxaJwZqqG6mXpDarUq92` | Neolithic Engine 11/6/26 | none now | Paused by its owner. Everything on it is now on `settlements-s3` (the fearX/fearY fix and the chronicle battle-test pin included), so its owner can retire it. |

## Queue: Phase 5f ideas to port into S3, one at a time, each with a switch and measured

Taken from `phase-5f-exposure` (commit d38588c), whose perf was 14.2 µs per person per tick, close to the 15 µs budget. That's a reason to port them one at a time and measure each.

1. **4-way ray enclosure** (cardinal rays up to 4 tiles; enclosed tiles drop to a low exposure). Candidate for S3b's exposure field.
2. **Wind shadow** downwind of walls, cliffs and woods. Candidate for S3c.
3. **Doorways from traffic:** carriers avoid unloading on well-worn tiles, so entrances stay open. S3d.
4. **Wall crossing and breakout:** stepping over a strong wall costs extra energy and wears it. S3d.
5. **Hearth anchor:** the settlement observer anchors on fires, nests, granaries and walls rather than one-tile huts. S0 follow-up, observer only.

## Needs a person

- A rule-13 watch of the S0 to S3 features in a browser.
- The main checkout's mid-merge on `phase-5f-exposure`: finish or abort.
- Whether `data/` (the saved world) is backed up.
