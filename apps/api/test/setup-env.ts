import { buildStaticQris } from '../src/qris/core/fixtures';

/** Env untuk e2e. Dimuat sebelum AppModule, karena ConfigModule membaca env saat itu. */
export const E2E_STATIC_QRIS = buildStaticQris({ withTip: true });

process.env.QRIS_STATIC_PAYLOAD = E2E_STATIC_QRIS;
process.env.QRIS_TOOLS_ENABLED = 'true';
process.env.QRIS_MAX_AMOUNT = '10000000';
