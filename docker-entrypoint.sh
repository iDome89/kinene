#!/bin/sh
set -e

echo "→ applying migrations to ${DATABASE_URL}"
node --experimental-strip-types scripts/migrate.ts

echo "→ starting server on ${HOST}:${PORT}"
exec node ./dist/server/entry.mjs
