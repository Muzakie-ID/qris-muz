import { runMigrations } from '../src/db/migrate';

/** Menyiapkan skema database test sekali sebelum semua e2e test. */
export default async function globalSetup(): Promise<void> {
  await runMigrations(
    process.env.TEST_DATABASE_URL ??
      'postgres://qris:qris@localhost:5432/qrismuz_test',
  );
}
