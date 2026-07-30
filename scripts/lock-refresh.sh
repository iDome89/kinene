#!/bin/sh
# Regenerate package-lock.json for the platform Render actually builds on.
#
# npm resolves optional/wasm dependencies per platform. A lockfile written on
# macOS omits entries that linux/amd64 needs (@emnapi/*, sharp's wasm fallback),
# and `npm ci` then fails in the container with EUSAGE — while passing locally,
# because `npm ci --dry-run` with node_modules present does not simulate a
# clean install. Generating the lock inside the target image avoids both traps.
set -e

IMAGE=node:24-slim
PLATFORM=linux/amd64

if ! docker info >/dev/null 2>&1; then
  echo "Docker non è in esecuzione: serve per rigenerare il lockfile per linux/amd64." >&2
  exit 1
fi

echo "→ rigenero package-lock.json su ${PLATFORM}"
docker run --rm --platform "$PLATFORM" -v "$PWD":/app -w /app "$IMAGE" \
  npm install --package-lock-only --no-audit --no-fund

echo "→ verifico npm ci su ${PLATFORM}"
docker run --rm --platform "$PLATFORM" -v "$PWD":/app -w /app "$IMAGE" \
  sh -c 'cp package.json package-lock.json /tmp/ && cd /tmp && npm ci --no-audit --no-fund >/dev/null'

echo "✓ lockfile valido per la build Docker"
