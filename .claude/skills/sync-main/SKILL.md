---
name: sync-main
description: Merge latest main into the current branch, verify, and report
---
1. Run `git fetch origin && git merge origin/main`. Resolve any conflicts and explain each one.
2. Run `npm run verify` in the foreground and capture the exit code.
3. If tests fail, fix them and re-run until the exit code is 0.
4. Commit, then push in a separate command.
5. Report the verify summary line verbatim, plus a 'Not done' list.
