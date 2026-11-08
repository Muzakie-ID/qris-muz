import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { sql } from 'drizzle-orm';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { validateEnv, type Env } from '../src/config/env';
import { DB, type Db } from '../src/db/db.module';
import { setupApp } from '../src/setup';

/** `env` mengganti variabel lingkungan untuk app ini saja (lewat ConfigService pengganti). */
export async function createTestApp(
  env: Record<string, string> = {},
): Promise<INestApplication<App>> {
  let builder = Test.createTestingModule({ imports: [AppModule] });
  if (Object.keys(env).length) {
    const values = validateEnv({ ...process.env, ...env });
    builder = builder.overrideProvider(ConfigService).useValue({
      get: (key: keyof Env) => values[key],
    });
  }
  const moduleRef = await builder.compile();
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
      projects, device_nonces, device_pairing_tokens, devices, qris_sources, audit_logs,
      owner_sessions, users, settings, notifications, backup_runs
    restart identity cascade`);
}
