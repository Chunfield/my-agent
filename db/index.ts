import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const globalForDb = globalThis as unknown as {
  conn: ReturnType<typeof drizzle> | undefined;
};

const connectionString = process.env.DATABASE_URL!;

export const db =
  globalForDb.conn ??
  drizzle(postgres(connectionString), { schema });

if (process.env.NODE_ENV !== 'production') {
  globalForDb.conn = db;
}
