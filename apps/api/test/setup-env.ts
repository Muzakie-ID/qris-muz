import { buildStaticQris } from '../src/qris/core/fixtures';

/** Env untuk e2e. Dimuat sebelum AppModule, karena ConfigModule membaca env saat itu. */
export const E2E_STATIC_QRIS = buildStaticQris({ withTip: true });
export const E2E_ADMIN_TOKEN = 'admin-token-untuk-test-e2e-saja-123';
export const E2E_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgres://qris:qris@localhost:5432/qrismuz_test';

process.env.DATABASE_URL = E2E_DATABASE_URL;
process.env.APP_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString('base64');
process.env.ADMIN_TOKEN = E2E_ADMIN_TOKEN;
process.env.JOBS_ENABLED = 'false';
process.env.PUBLIC_API_URL = 'http://api.test';
process.env.CHECKOUT_BASE_URL = 'http://web.test';
process.env.QRIS_STATIC_PAYLOAD = E2E_STATIC_QRIS;
process.env.QRIS_TOOLS_ENABLED = 'true';
process.env.QRIS_MAX_AMOUNT = '10000000';
process.env.UNIQUE_CODE_GRACE_HOURS = '24';
