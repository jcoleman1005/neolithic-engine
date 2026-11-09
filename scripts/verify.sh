#!/usr/bin/env bash
# Runs check, tests and build; prints one line per step. On failure, prints the failing test names
# and the tail of the step, and keeps the full output in a log file.
# VERIFY_TESTS="tests/a.test.ts tests/b.test.ts" npm run verify limits the test step while iterating.
# VERIFY_VISUAL=1 npm run verify adds the screenshot check (it needs Playwright's Chromium); without it, it is skipped and says so.
# Test files run in parallel (cores - 1 workers); VITEST_MAX_WORKERS=N overrides, e.g. 1 on a phone.
cd "$(dirname "$0")/.." || exit 1
run() {
  local name=$1; shift
  local out; out=$(mktemp "${TMPDIR:-/tmp}/neolithic-verify-$name.XXXXXX")
  if "$@" >"$out" 2>&1; then
    echo "ok   $name"; rm -f "$out"
  else
    echo "FAIL $name"
    grep -E '^ *(FAIL|Test Files|Tests |Errors )|Unhandled' "$out" | sort -u | head -n 40
    echo "--- end of output"
    tail -n 40 "$out"
    echo "--- full log: $out"
    exit 1
  fi
}
run check npx tsc -b
# shellcheck disable=SC2086
run test npx vitest run --reporter=dot $VERIFY_TESTS
# `npm run build` is `tsc -b && vite build`; the check step above already ran tsc -b.
run build npx vite build
# Screenshots of the real app against visual/baseline (scripts/visual-check.ts). Needs Chromium; it fails,
# never skips quietly, when there is none. It is opt-in (decided 2026-11-08) so verify passes where
# there is no Chromium, such as a phone: VERIFY_VISUAL=1 runs it; otherwise it is skipped and says so.
if [ "${VERIFY_VISUAL:-0}" != "1" ]; then
  echo "skip visual-check (set VERIFY_VISUAL=1 to run it)"
else
  run visual-check npx vite-node scripts/visual-check.ts
fi
