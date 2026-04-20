#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LISTEN_PIDS="$(lsof -n -P -t -iTCP:5173-5190 -sTCP:LISTEN 2>/dev/null | sort -u || true)"

if [[ -z "$LISTEN_PIDS" ]]; then
  exit 0
fi

while IFS= read -r pid; do
  [[ -z "$pid" ]] && continue
  cmd="$(ps -p "$pid" -o command= 2>/dev/null || true)"
  if [[ -z "$cmd" ]]; then
    continue
  fi

  if [[ "$cmd" == *"$ROOT_DIR/node_modules/vite/"* ]] || [[ "$cmd" == *"$ROOT_DIR/node_modules/.bin/vite"* ]]; then
    kill "$pid" 2>/dev/null || true
  fi
done <<< "$LISTEN_PIDS"
