import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { TransactionEvents } from './events.service';
import { SecretsService } from './secrets.service';

@Global()
@Module({
  providers: [TransactionEvents, SecretsService, AuditService],
  exports: [TransactionEvents, SecretsService, AuditService],
})
export class CommonModule {}
