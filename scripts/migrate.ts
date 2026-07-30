import { statSync } from 'node:fs';
import { databasePath, storageVerdict, type StorageProbe } from '../src/lib/persistence.ts';

/*
  Stat before anything imports the client: creating a libsql handle creates the
  file, so a static import here would make every empty disk look like a survivor.
*/
const url = process.env.DATABASE_URL ?? 'file:./data/kinene.db';
const path = databasePath(url);
const stats = path === null ? null : statSync(path, { throwIfNoEntry: false });

const probe: StorageProbe = {
  url,
  path,
  existedAtBoot: (stats?.size ?? 0) > 0,
  bytesAtBoot: stats?.size ?? 0,
};

const { db, sqlite } = await import('../src/db/client.ts');
const { migrate } = await import('drizzle-orm/libsql/migrator');

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
