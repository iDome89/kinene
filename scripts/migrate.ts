import { statSync } from 'node:fs';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { db, sqlite } from '../src/db/client.ts';
import { databasePath, storageVerdict, type StorageProbe } from '../src/lib/persistence.ts';

const url = process.env.DATABASE_URL ?? 'file:./data/kinene.db';
const path = databasePath(url);
const stats = path === null ? null : statSync(path, { throwIfNoEntry: false });

const probe: StorageProbe = {
  url,
  path,
  existedAtBoot: stats !== null && stats !== undefined,
  bytesAtBoot: stats?.size ?? 0,
};

await migrate(db, { migrationsFolder: './drizzle' });

const count = async (table: string): Promise<number> =>
  Number((await sqlite.execute(`select count(*) as n from ${table}`)).rows[0]!.n);

console.log(
  storageVerdict(probe, {
    prenotazioni: await count('bookings'),
    recensioni: await count('reviews'),
    foto: await count('gallery_images'),
  }),
);

process.exit(0);
