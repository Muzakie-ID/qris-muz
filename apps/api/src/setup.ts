import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from './config/env';
import { QrisErrorFilter } from './qris/qris-error.filter';

/** Pengaturan bersama untuk aplikasi dan e2e test. Buat app dengan { rawBody: true }. */
export function setupApp(app: INestApplication): void {
  const config = app.get<ConfigService<Env, true>>(ConfigService);
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
