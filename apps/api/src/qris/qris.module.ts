import { Global, Module } from '@nestjs/common';
import { QrisSourcesService } from './qris-sources.service';
import { QrisController } from './qris.controller';
import { QrisToolsGuard } from './qris-tools.guard';
import { QrisService } from './qris.service';

@Global()
@Module({
  controllers: [QrisController],
  providers: [QrisService, QrisSourcesService, QrisToolsGuard],
  exports: [QrisService, QrisSourcesService],
})
export class QrisModule {}
