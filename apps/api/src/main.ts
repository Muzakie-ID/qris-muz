import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import type { Env } from './config/env';
import { setupApp } from './setup';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  setupApp(app);
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const port = config.get('PORT', { infer: true });
  await app.listen(port);
  Logger.log(`API berjalan di http://localhost:${port}`, 'Bootstrap');
  if (config.get('QRIS_TOOLS_ENABLED', { infer: true })) {
    Logger.warn(
      'Alat uji QRIS aktif (QRIS_TOOLS_ENABLED=true). Matikan di produksi.',
      'Bootstrap',
    );
  }
}
void bootstrap();
