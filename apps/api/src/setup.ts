import { INestApplication, ValidationPipe } from '@nestjs/common';

/** Pengaturan bersama untuk aplikasi dan e2e test. */
export function setupApp(app: INestApplication): void {
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableShutdownHooks();
}
