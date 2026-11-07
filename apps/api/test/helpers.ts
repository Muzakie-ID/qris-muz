import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { sql } from 'drizzle-orm';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DB, type Db } from '../src/db/db.module';
import { setupApp } from '../src/setup';

export async function createTestApp(): Promise<INestApplication<App>> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>({
    rawBody: true,
  });
  setupApp(app);
  await app.init();
  return app;
}

/** Mengosongkan semua tabel kecuali parser bawaan. */
export async function resetDb(app: INestApplication): Promise<void> {
  const db = app.get<Db>(DB);
  await db.execute(sql`
    truncate table webhook_deliveries, payment_events, transactions, api_keys,
      projects, device_nonces, device_pairing_tokens, devices, qris_sources, audit_logs
    restart identity cascade`);
}
