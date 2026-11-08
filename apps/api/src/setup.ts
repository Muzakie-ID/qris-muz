import { INestApplication, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { requestContextMiddleware } from './common/request-context';
import { ConfigService } from '@nestjs/config';
import type { Env } from './config/env';
import { QrisErrorFilter } from './qris/qris-error.filter';

/** Pengaturan bersama untuk aplikasi dan e2e test. Buat app dengan { rawBody: true }. */
export function setupApp(app: INestApplication): void {
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const trust = config.get('TRUST_PROXY', { infer: true });
  // IP asli pembeli/owner dari header X-Forwarded-For yang dipasang Caddy dan server web.
  (app as NestExpressApplication).set(
    'trust proxy',
    /^\d+$/.test(trust)
      ? Number(trust)
      : trust === 'true'
        ? true
        : trust === 'false'
          ? false
          : trust.split(',').map((t) => t.trim()),
  );
  app.use(requestContextMiddleware);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new QrisErrorFilter());
  // Halaman checkout (web app) membaca /public/checkout dari browser.
  app.enableCors({
    origin: config.get('CHECKOUT_BASE_URL', { infer: true }),
    methods: ['GET'],
  });
  app.enableShutdownHooks();
}
