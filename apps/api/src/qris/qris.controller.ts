import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Post,
  Query,
  StreamableFile,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import {
  CreateDynamicQrisDto,
  DynamicQrisImageQuery,
  InspectQrisDto,
} from './qris.dto';
import { QrisErrorFilter } from './qris-error.filter';
import { QrisToolsGuard } from './qris-tools.guard';
import { QrisService } from './qris.service';

/**
 * Alat uji Tahap 1: cek QRIS statis dan buat QRIS dinamis untuk dicoba scan.
 * Endpoint transaksi sesungguhnya (POST /v1/transactions) dibuat di Tahap 2.
 */
@Controller('v1/qris')
@UseGuards(QrisToolsGuard)
@UseFilters(QrisErrorFilter)
export class QrisController {
  constructor(private readonly qris: QrisService) {}

  /** Memeriksa QRIS: valid atau tidak, dan isinya (merchant, NMID, dll). */
  @Post('inspect')
  @HttpCode(200)
  inspect(@Body() dto: InspectQrisDto) {
    return this.qris.inspect(dto.payload);
  }

  /** Membuat QRIS dinamis bernominal beserta gambar SVG-nya. */
  @Post('dynamic')
  @HttpCode(200)
  async createDynamic(@Body() dto: CreateDynamicQrisDto) {
    const result = this.qris.createDynamic(dto.amount, dto.payload);
    return { ...result, svg: await this.qris.toSvg(result.payload) };
  }

  /** Gambar PNG QRIS dinamis dari QRIS statis yang disetel. Buka di browser lalu scan. */
  @Get('dynamic.png')
  @Header('Content-Type', 'image/png')
  @Header('Cache-Control', 'no-store')
  async dynamicPng(
    @Query() query: DynamicQrisImageQuery,
  ): Promise<StreamableFile> {
    const { payload } = this.qris.createDynamic(query.amount);
    return new StreamableFile(await this.qris.toPng(payload));
  }
}
