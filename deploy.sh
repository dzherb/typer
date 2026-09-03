#!/usr/bin/env bash
# Build and publish. One command, no CI.
set -euo pipefail

HOST="${TYPER_HOST:-dzherb.ru}"       # ssh alias from ~/.ssh/config
ROOT="${TYPER_ROOT:-/var/www/typer}"

cd "$(dirname "$0")"
bun run build

# --delete clears out hashed assets from earlier builds. Anyone mid-load keeps
# working: the service worker serves them the version it already cached.
rsync -az --delete --human-readable dist/ "$HOST:$ROOT/"

echo "→ https://typer.dzherb.ru"
