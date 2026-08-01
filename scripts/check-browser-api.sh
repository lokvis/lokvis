#!/usr/bin/env bash
# ADR-015 architecture guard: runtime / engine-image must not directly touch
# browser APIs. All access goes through @lokvis/browser-adapter.
#
# Exclusions:
#   - test files (__tests__/, *.test.ts)
#   - comment lines (//, /*, * continuation)
#   - pattern appearing only in string literals or trailing comments
#   - ADR-015 documented exemption: avif-encoder.ts `new Worker(new URL(...))`
#     (bundler static analysis requires the literal)
set -euo pipefail

PATTERN='navigator\.|document\.|indexedDB|new Worker\('
DIRS="packages/runtime/src packages/engine-image/src"

matches=$(grep -rn --include='*.ts' -E "$PATTERN" $DIRS \
  | grep -v '__tests__/' \
  | grep -v '\.test\.' \
  | grep -v 'avif-encoder\.ts' \
  || true)

code_violations=""
while IFS= read -r line; do
  [ -z "$line" ] && continue
  # Extract code portion (after file:line:)
  code="${line#*:*:}"
  # Trim leading whitespace
  trimmed="${code#"${code%%[![:space:]]*}"}"
  # Skip comment lines (// single-line, * JSDoc continuation, /* block start)
  case "$trimmed" in
    //*|'*'*|/\**) continue ;;
  esac
  # Strip string literals and trailing comments, then check for pattern.
  # Known limitation: does not handle escaped quotes inside strings (e.g. 'it\'s').
  stripped=$(printf '%s' "$code" | sed "s/'[^']*'//g; s/\"[^\"]*\"//g; s|//.*||")
  if printf '%s' "$stripped" | grep -qE "$PATTERN"; then
    code_violations="${code_violations}${line}"$'\n'
  fi
done <<< "$matches"

if [ -n "$code_violations" ]; then
  echo "ERROR: ADR-015 violation — direct browser API usage in runtime/engine-image:"
  echo ""
  echo "$code_violations"
  echo ""
  echo "All browser API access must go through @lokvis/browser-adapter."
  echo "See docs/adr/015-browser-adapter-layer.md for details."
  exit 1
fi

echo "ADR-015 guard: PASS (no direct browser API in runtime/engine-image)"
