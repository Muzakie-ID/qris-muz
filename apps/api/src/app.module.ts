import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdminController } from './admin/admin.controller';
import { AdminGuard } from './admin/admin.guard';
import { DashboardService } from './admin/dashboard.service';
import { CheckoutController } from './checkout/checkout.controller';
import { CommonModule } from './common/common.module';
import { validateEnv } from './config/env';
import { DbModule } from './db/db.module';
import { DeviceSignatureGuard } from './devices/device-signature.guard';
import { DevicesController } from './devices/devices.controller';
import { DevicesService } from './devices/devices.service';
import { HealthController } from './health.controller';
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
  ],
  providers: [
    TransactionsService,
    PaymentsService,
    DevicesService,
    DeviceSignatureGuard,
    AdminGuard,
    DashboardService,
  ],
})
export class AppModule {}
