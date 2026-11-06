import { Module } from '@nestjs/common';
import { QrisController } from './qris.controller';
import { QrisToolsGuard } from './qris-tools.guard';
import { QrisService } from './qris.service';

@Module({
  controllers: [QrisController],
  providers: [QrisService, QrisToolsGuard],
  exports: [QrisService],
})
export class QrisModule {}
