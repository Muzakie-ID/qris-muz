import { Throttle } from '@nestjs/throttler';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiKeyGuard, CurrentProject } from '../projects/api-key.guard';
import type { Project } from '../projects/projects.service';
import { CreateTransactionDto } from './transactions.dto';
import { TransactionsService } from './transactions.service';

const METADATA_MAX_BYTES = 4096;

@Throttle({ default: { limit: 600, ttl: 60_000 } })
@Controller('v1/transactions')
@UseGuards(ApiKeyGuard)
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  /** Membuat tagihan. Kirim header Idempotency-Key agar aman diulang. */
  @Post()
  async create(
    @CurrentProject() project: Project,
    @Body() dto: CreateTransactionDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (
      idempotencyKey !== undefined &&
      (idempotencyKey.length < 1 || idempotencyKey.length > 100)
    ) {
      throw new BadRequestException('Idempotency-Key harus 1–100 karakter.');
    }
    if (
      dto.metadata &&
      Buffer.byteLength(JSON.stringify(dto.metadata)) > METADATA_MAX_BYTES
    ) {
      throw new BadRequestException(
        `metadata maksimal ${METADATA_MAX_BYTES} byte.`,
      );
    }
    const { transaction, replayed } = await this.transactions.create(project, {
      amount: dto.amount,
      merchantRef: dto.merchant_ref,
      expiryMin: dto.expiry_min,
      returnUrl: dto.return_url,
      metadata: dto.metadata,
      qrisSourceId: dto.qris_source_id,
      idempotencyKey,
    });
    res.status(replayed ? 200 : 201);
    if (replayed) res.setHeader('Idempotent-Replayed', 'true');
    return this.transactions.view(transaction);
  }

  @Get(':id')
  async get(@CurrentProject() project: Project, @Param('id') id: string) {
    return this.transactions.view(
      await this.transactions.getForProject(project, id),
    );
  }

  @Post(':id/cancel')
  @HttpCode(200)
  async cancel(@CurrentProject() project: Project, @Param('id') id: string) {
    return this.transactions.view(await this.transactions.cancel(project, id));
  }
}
