# Neolithic Engine: notes for Claude

The project rules are in `AGENTS.md`. Who is working on what is in `docs/WORKBOARD.md`.

## Status reporting

Never say a command (verify, perf, a tuning run or a push) has been launched, passed or finished unless you ran it in this session and read its output. When you report, quote the exit code or the final summary line. If something was planned but not done, list it under 'Not done' instead of implying it shipped.

## Git workflow

### After any merge or rebase from main

1. Run `npm run verify` right after the merge, before building anything new.
2. Fix any broken tests before going further.
3. Before running a measurement or experiment, check with `git log main..HEAD` and `git log HEAD..main` that the branch includes the latest main commits that matter, such as the resource-clash change.

### Multi-agent coordination

Several Claude agents work on this repo in parallel on separate branches. Before you start a feature, run `git branch -a` and `git fetch --all` and check whether another branch already touches the same system (for example pregnancy, infant mortality or structures). If one does, say so before you write any code.

### Git push

Run `git commit` and `git push` as separate commands, never chained with `&&`. Don't try to edit lockfiles directly; regenerate them with `npm install`.

## Running simulations

### Process and long-run management

- Never use a broad `pkill`/`pgrep -f` pattern that could match your own shell. Kill only the specific PIDs you saved when you started the process.
- For simulation runs longer than about 5 minutes (for example 50- or 90-year tuning runs), start them with `nohup ... > logs/run-<name>.log 2>&1 &`, save the PID, and check the log rather than relying on the 10-minute tool timeout.
- In worktrees, run `npm install` (or check that `node_modules/.bin/vite-node` exists) before you start any worker or baseline script.
