# Agent rules

Twelve rules for the coding agent; paste this section into `AGENTS.md` as it stands.

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
