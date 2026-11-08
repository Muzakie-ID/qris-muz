import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AdminController } from './admin/admin.controller';
import { AdminGuard, OwnerGuard } from './admin/admin.guard';
import { AlertsModule } from './alerts/alerts.module';
import { AccountController, AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { DashboardService } from './admin/dashboard.service';
import { CheckoutController } from './checkout/checkout.controller';
import { CommonModule } from './common/common.module';
import { validateEnv, type Env } from './config/env';
import { DbModule } from './db/db.module';
import { DeviceSignatureGuard } from './devices/device-signature.guard';
import { DevicesController } from './devices/devices.controller';
import { DevicesService } from './devices/devices.service';
import { HealthController } from './health.controller';
import { ParsersService } from './payments/parsers.service';
import { PaymentsService } from './payments/payments.service';
import { ProjectsModule } from './projects/projects.module';
import { QrisModule } from './qris/qris.module';
import { StatusController } from './status.controller';
import { TransactionsController } from './transactions/transactions.controller';
import { TransactionsService } from './transactions/transactions.service';
import { WebhooksModule } from './webhooks/webhooks.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        throttlers: [
          {
            ttl: 60_000,
            limit: config.get('RATE_LIMIT_PER_MIN', { infer: true }),
          },
        ],
        skipIf: () => !config.get('RATE_LIMIT_ENABLED', { infer: true }),
        errorMessage: 'Terlalu banyak request. Coba lagi sebentar lagi.',
      }),
    }),
    AlertsModule,
    DbModule,
    CommonModule,
    QrisModule,
    ProjectsModule,
    WebhooksModule,
  ],
  controllers: [
    HealthController,
    StatusController,
    TransactionsController,
    DevicesController,
    CheckoutController,
    AdminController,
    AuthController,
    AccountController,
  ],
  providers: [
    TransactionsService,
    PaymentsService,
    ParsersService,
    DevicesService,
    DeviceSignatureGuard,
    AdminGuard,
    OwnerGuard,
    AuthService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    DashboardService,
  ],
})
export class AppModule {}
