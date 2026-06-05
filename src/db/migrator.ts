import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';

const turso = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const client = drizzle(turso);

await migrate(client, { migrationsFolder: './drizzle' });

console.log('Migrations applied successfully');
await turso.close();
