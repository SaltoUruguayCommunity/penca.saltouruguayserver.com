import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

const turso = createClient({
  url: import.meta.env.TURSO_DATABASE_URL ?? process.env.TURSO_DATABASE_URL!,
  authToken: import.meta.env.TURSO_AUTH_TOKEN ?? process.env.TURSO_AUTH_TOKEN,
});

export const client = drizzle(turso, { schema });
export { turso };
