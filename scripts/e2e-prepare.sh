#!/bin/sh
set -e
rm -f ./data/e2e.db ./data/e2e.db-shm ./data/e2e.db-wal
npm run build
DATABASE_URL=file:./data/e2e.db npx tsx scripts/migrate.ts
