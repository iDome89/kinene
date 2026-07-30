#!/bin/sh
set -e

DATA_DIR="$(dirname "$(printf '%s' "${DATABASE_URL#file:}" | cut -d? -f1)")"

if [ ! -w "$DATA_DIR" ]; then
  echo "✗ $DATA_DIR non e scrivibile dall'utente $(id -un)."
  echo "  Un disco Render appena collegato appartiene a root: apri la shell del servizio"
  echo "  e lancia chown -R node:node $DATA_DIR."
  exit 1
fi

echo "→ applying migrations to ${DATABASE_URL}"
node --experimental-strip-types scripts/migrate.ts

echo "→ starting server on ${HOST}:${PORT}"
exec node ./dist/server/entry.mjs
