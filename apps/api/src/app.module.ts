import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env';
import { HealthController } from './health.controller';
import { QrisModule } from './qris/qris.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    QrisModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
