import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuditService } from '../common/audit.service';
import { DeviceCommandDto, PairingTokenDto } from '../devices/devices.dto';
import { DevicesService } from '../devices/devices.service';
import { PaymentsService } from '../payments/payments.service';
import { ProjectsService, type Project } from '../projects/projects.service';
import {
  QrisSourcesService,
  type QrisSource,
} from '../qris/qris-sources.service';
import { ConfirmTransactionDto } from '../transactions/transactions.dto';
import { TransactionsService } from '../transactions/transactions.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { AdminGuard } from './admin.guard';
import {
  CreateProjectDto,
  CreateQrisSourceDto,
  ListEventsQuery,
  UpdateProjectDto,
  UpdateQrisSourceDto,
} from './admin.dto';

function projectView(p: Project) {
  return {
    id: p.id,
    name: p.name,
    webhook_url: p.webhookUrl,
    default_return_url: p.defaultReturnUrl,
    default_qris_source_id: p.defaultQrisSourceId,
    default_expiry_min: p.defaultExpiryMin,
    created_at: p.createdAt.toISOString(),
  };
}

function qrisView(q: QrisSource) {
  return {
    id: q.id,
    label: q.label,
    merchant_name: q.merchantName,
    nmid: q.nmid,
    source_package: q.sourcePackage,
    is_active: q.isActive,
    created_at: q.createdAt.toISOString(),
  };
}

/** Pengelolaan oleh owner. Nanti dipakai dashboard; sementara diakses dengan ADMIN_TOKEN. */
@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(
    private readonly projects: ProjectsService,
    private readonly qris: QrisSourcesService,
    private readonly devices: DevicesService,
    private readonly transactions: TransactionsService,
    private readonly payments: PaymentsService,
    private readonly webhooks: WebhooksService,
    private readonly audit: AuditService,
  ) {}

  // --- QRIS ---
  @Get('qris-sources')
  async listQris() {
    return (await this.qris.list()).map(qrisView);
  }

  @Post('qris-sources')
  async createQris(@Body() dto: CreateQrisSourceDto) {
    const q = await this.qris.create({
      label: dto.label,
      payload: dto.payload,
      sourcePackage: dto.source_package,
    });
    await this.audit.log('qris.created', q.id, {
      label: q.label,
      merchant: q.merchantName,
    });
    return qrisView(q);
  }

  @Patch('qris-sources/:id')
  async updateQris(@Param('id') id: string, @Body() dto: UpdateQrisSourceDto) {
    const q = await this.qris.update(id, {
      label: dto.label,
      sourcePackage: dto.source_package,
      isActive: dto.is_active,
    });
    await this.audit.log('qris.updated', id, { ...dto });
    return qrisView(q);
  }

  // --- Proyek & API key ---
  @Get('projects')
  async listProjects() {
    return (await this.projects.list()).map(projectView);
  }

  /** webhook_secret hanya ditampilkan sekali di respons ini. */
  @Post('projects')
  async createProject(@Body() dto: CreateProjectDto) {
    const { project, webhookSecret } = await this.projects.create({
      name: dto.name,
      webhookUrl: dto.webhook_url,
      defaultReturnUrl: dto.default_return_url,
      defaultQrisSourceId: dto.default_qris_source_id,
      defaultExpiryMin: dto.default_expiry_min,
    });
    await this.audit.log('project.created', project.id, { name: project.name });
    return { ...projectView(project), webhook_secret: webhookSecret };
  }

  @Patch('projects/:id')
  async updateProject(@Param('id') id: string, @Body() dto: UpdateProjectDto) {
    const p = await this.projects.update(id, {
      name: dto.name,
      webhookUrl: dto.webhook_url,
      defaultReturnUrl: dto.default_return_url,
      defaultQrisSourceId: dto.default_qris_source_id,
      defaultExpiryMin: dto.default_expiry_min,
    });
    await this.audit.log('project.updated', id, { ...dto });
    return projectView(p);
  }

  /** api_key hanya ditampilkan sekali di respons ini. */
  @Post('projects/:id/api-keys')
  async createApiKey(@Param('id') id: string) {
    const k = await this.projects.createApiKey(id);
    await this.audit.log('api_key.created', k.id, {
      projectId: id,
      prefix: k.prefix,
    });
    return {
      id: k.id,
      prefix: k.prefix,
      api_key: k.key,
      created_at: k.createdAt.toISOString(),
    };
  }

  @Post('api-keys/:id/revoke')
  @HttpCode(204)
  async revokeApiKey(@Param('id') id: string) {
    await this.projects.revokeApiKey(id);
    await this.audit.log('api_key.revoked', id);
  }

  // --- Perangkat ---
  @Get('devices')
  async listDevices() {
    return {
      status: await this.devices.listenerStatus(),
      devices: await this.devices.list(),
    };
  }

  /** Token sekali pakai untuk pairing HP listener (berlaku 10 menit). */
  @Post('devices/pairing-tokens')
  createPairing(@Body() dto: PairingTokenDto) {
    return this.devices.createPairingToken(dto.device_name);
  }

  /** Perintah jarak jauh: rescan, refresh_config, atau flush_queue. */
  @Post('devices/:id/commands')
  @HttpCode(200)
  queueCommand(@Param('id') id: string, @Body() dto: DeviceCommandDto) {
    return this.devices.queueCommand(id, dto.command);
  }

  @Post('devices/:id/revoke')
  @HttpCode(204)
  revokeDevice(@Param('id') id: string) {
    return this.devices.revoke(id);
  }

  // --- Transaksi & event ---
  @Post('transactions/:id/confirm')
  @HttpCode(200)
  async confirm(@Param('id') id: string, @Body() dto: ConfirmTransactionDto) {
    return this.transactions.view(
      await this.transactions.confirmManually(id, dto.reason),
    );
  }

  @Get('transactions/:id/webhooks')
  webhookLog(@Param('id') id: string) {
    return this.webhooks.listForTransaction(id);
  }

  @Post('webhook-deliveries/:id/retry')
  @HttpCode(204)
  retryWebhook(@Param('id') id: string) {
    return this.webhooks.retryNow(id);
  }

  @Get('events')
  listEvents(@Query() q: ListEventsQuery) {
    return this.payments.listEvents({
      parseStatus: q.parse_status,
      matchStatus: q.match_status,
    });
  }

  /** Proses ulang event yang belum terbaca/belum cocok, mis. setelah parser atau package diperbarui. */
  @Post('events/reprocess')
  @HttpCode(200)
  async reprocess() {
    const r = await this.payments.reprocess();
    await this.audit.log('events.reprocessed', null, r);
    return r;
  }
}
