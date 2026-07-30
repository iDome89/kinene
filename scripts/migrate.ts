import { migrate } from 'drizzle-orm/libsql/migrator';
import { db } from '../src/db/client.ts';

await migrate(db, { migrationsFolder: './drizzle' });
console.log('migrations applied');
process.exit(0);
