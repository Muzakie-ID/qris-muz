/**
 * Menjalankan migrasi database: npm run db:migrate
 * Membaca DATABASE_URL dari environment (atau file .env).
 */
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { join } from 'node:path';
import { Pool } from 'pg';

export async function runMigrations(databaseUrl: string): Promise<void> {
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  try {
    await migrate(drizzle(pool), {
      migrationsFolder: join(__dirname, '..', '..', 'drizzle'),
    });
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL belum disetel.');
    process.exit(1);
  }
  runMigrations(url)
    .then(() => console.log('Migrasi selesai.'))
    .catch((e: unknown) => {
      console.error(e);
      process.exit(1);
    });
}
