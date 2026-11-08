import { Global, Module } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { NotifierService } from './notifier.service';
import { SettingsService } from './settings.service';

@Global()
@Module({
  providers: [SettingsService, NotifierService, AlertsService],
  exports: [SettingsService, NotifierService, AlertsService],
})
export class AlertsModule {}
