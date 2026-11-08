#!/usr/bin/env bash
# After Claude edits or writes a TypeScript file, type-check the app (src/) and the server and
# scripts. Errors go to stderr with exit code 2, which hands them back to Claude to fix.
f=$(jq -r '.tool_input.file_path // empty')
case "$f" in *.ts) ;; *) exit 0 ;; esac
cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}" || exit 0
out=$( { npx tsc --noEmit -p tsconfig.app.json; npx tsc --noEmit -p tsconfig.server.json; } 2>&1 | awk '!seen[$0]++' | head -30 )
if [ -n "$out" ]; then
  printf 'Type errors after editing %s:\n%s\n' "$f" "$out" >&2
  exit 2
fi
exit 0
