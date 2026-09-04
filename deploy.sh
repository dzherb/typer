#!/usr/bin/env bash
# Build and publish. One command, no CI.
set -euo pipefail

cd "$(dirname "$0")"

# Where a copy of typer goes is a property of the copy, not of the project, so
# the answer sits in a file git does not carry. TYPER_HOST is an ssh alias or
# a user@host; the other two have defaults.
[ -f deploy.env ] && . ./deploy.env

HOST="${TYPER_HOST:?not set — see Deployment in the README}"
ROOT="${TYPER_ROOT:-/var/www/typer}"

bun run build

# --delete clears out hashed assets from earlier builds. Anyone mid-load keeps
# working: the service worker serves them the version it already cached.
rsync -az --delete --human-readable dist/ "$HOST:$ROOT/"

echo "→ ${TYPER_URL:-$HOST:$ROOT}"
