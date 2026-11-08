import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';
import { AuditService } from '../common/audit.service';
import { DeviceCommandDto, PairingTokenDto } from '../devices/devices.dto';
import { DevicesService } from '../devices/devices.service';
import { ParsersService, type ParserRow } from '../payments/parsers.service';
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
import { DashboardService } from './dashboard.service';
import {
  CreateParserDto,
  CreateProjectDto,
  CreateQrisSourceDto,
  ListEventsQuery,
  ListPaymentEventsQueryDto,
  ListTransactionsQueryDto,
  ListWebhookDeliveriesQueryDto,
  TestParserDto,
  TestTransactionDto,
  UpdateParserDto,
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

function parserView(r: ParserRow) {
  return {
    id: r.id,
    package_name: r.packageName,
    pattern: r.pattern,
    priority: r.priority,
    auto_match: r.autoMatch,
    is_active: r.isActive,
    updated_at: r.updatedAt.toISOString(),
  };
}

const iso = (d: Date | null) => d?.toISOString() ?? null;

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
    private readonly dashboard: DashboardService,
    private readonly parsers: ParsersService,
  ) {}

  // --- Dashboard ---
  @Get('dashboard')
  overview() {
    return this.dashboard.overview();
  }

  @Get('transactions')
  listTransactions(@Query() q: ListTransactionsQueryDto) {
    return this.dashboard.listTransactions({
      status: q.status,
      q: q.q,
      projectId: q.project_id,
      page: q.page ?? 1,
      perPage: q.per_page ?? 20,
    });
  }

  /** Tagihan uji dari dashboard (tombol "Buat transaksi uji"). Memakai proyek pertama bila tidak disebut. */
  @Post('transactions/test')
  async createTestTransaction(@Body() dto: TestTransactionDto) {
    const project = dto.project_id
      ? await this.projects.get(dto.project_id)
      : (await this.projects.list())[0];
    if (!project) {
      throw new UnprocessableEntityException(
        'Belum ada proyek. Buat proyek dulu lewat POST /admin/projects.',
      );
    }
    const { transaction } = await this.transactions.create(project, {
      amount: dto.amount,
      merchantRef: `TEST-${Date.now()}`,
      metadata: { test: true },
    });
    await this.audit.log('transaction.test_created', transaction.id, {
      amount: dto.amount,
      projectId: project.id,
    });
    return this.transactions.view(transaction);
  }

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

  /** Daftar API key proyek; key asli tidak pernah ditampilkan lagi, hanya prefix. */
  @Get('projects/:id/api-keys')
  async listApiKeys(@Param('id') id: string) {
    return (await this.projects.listApiKeys(id)).map((k) => ({
      id: k.id,
      prefix: k.prefix,
      last_used_at: iso(k.lastUsedAt),
      revoked_at: iso(k.revokedAt),
      created_at: k.createdAt.toISOString(),
    }));
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
      devices: (await this.devices.list()).map((d) => ({
        id: d.id,
        name: d.name,
        last_heartbeat_at: iso(d.lastHeartbeatAt),
        listener_ok: d.listenerOk,
        battery: d.battery,
        charging: d.charging,
        queued: d.queued,
        source_app_versions: d.sourceAppVersions,
        clock_skew_ms: d.clockSkewMs,
        app_version: d.appVersion,
        last_crash: d.lastCrash,
        last_crash_at: iso(d.lastCrashAt),
        pending_commands: d.pendingCommands,
        revoked_at: iso(d.revokedAt),
        created_at: d.createdAt.toISOString(),
      })),
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

  /** Log semua pengiriman webhook untuk halaman Log webhook. */
  @Get('webhook-deliveries')
  listWebhookDeliveries(@Query() q: ListWebhookDeliveriesQueryDto) {
    return this.webhooks.list({
      status: q.status,
      page: q.page ?? 1,
      perPage: q.per_page ?? 20,
    });
  }

  @Post('webhook-deliveries/:id/retry')
  @HttpCode(204)
  async retryWebhook(@Param('id') id: string) {
    await this.webhooks.retryNow(id);
    await this.audit.log('webhook.retry_requested', id);
  }

  // --- Parser ---
  @Get('parsers')
  async listParsers() {
    return (await this.parsers.list()).map(parserView);
  }

  @Post('parsers')
  async createParser(@Body() dto: CreateParserDto) {
    const r = await this.parsers.create({
      packageName: dto.package_name,
      pattern: dto.pattern,
      priority: dto.priority,
      autoMatch: dto.auto_match,
      isActive: dto.is_active,
    });
    await this.audit.log('parser.created', r.id, { ...dto });
    return parserView(r);
  }

  /** Mencoba teks notifikasi terhadap satu pola, atau semua parser aktif bila pola kosong. */
  @Post('parsers/test')
  @HttpCode(200)
  testParser(@Body() dto: TestParserDto) {
    return this.parsers.test({
      packageName: dto.package_name,
      title: dto.title,
      text: dto.text,
      pattern: dto.pattern,
    });
  }

  @Patch('parsers/:id')
  async updateParser(@Param('id') id: string, @Body() dto: UpdateParserDto) {
    const r = await this.parsers.update(id, {
      packageName: dto.package_name,
      pattern: dto.pattern,
      priority: dto.priority,
      autoMatch: dto.auto_match,
      isActive: dto.is_active,
    });
    await this.audit.log('parser.updated', id, { ...dto });
    return parserView(r);
  }

  @Get('events')
  listEvents(@Query() q: ListEventsQuery) {
    return this.payments.listEvents({
      parseStatus: q.parse_status,
      matchStatus: q.match_status,
    });
  }

  /** Mutasi masuk untuk dashboard (berhalaman, snake_case). */
  @Get('payment-events')
  listPaymentEvents(@Query() q: ListPaymentEventsQueryDto) {
    return this.payments.listPage({
      parseStatus: q.parse_status,
      matchStatus: q.match_status,
      page: q.page ?? 1,
      perPage: q.per_page ?? 20,
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
