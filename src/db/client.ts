import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema.ts';

const url = process.env.DATABASE_URL ?? 'file:./data/kinene.db';
const authToken = process.env.DATABASE_AUTH_TOKEN || undefined;

export const sqlite = createClient({ url, authToken });
export const db = drizzle(sqlite, { schema });
export { schema };
