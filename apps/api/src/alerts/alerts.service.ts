import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { TransactionEvents } from '../common/events.service';
import type { Env } from '../config/env';
import { DB, type Db } from '../db/db.module';
import { backupRuns, devices, projects, transactions } from '../db/schema';
import { esc, NotifierService } from './notifier.service';
import { SettingsService } from './settings.service';

const rupiah = (n: number) => `Rp${n.toLocaleString('id-ID')}`;

/** Alarm sistem ke Telegram: pembayaran, listener offline, dan backup. */
@Injectable()
export class AlertsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AlertsService.name);
  private timers: NodeJS.Timeout[] = [];
  private unsubscribe?: () => void;

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly config: ConfigService<Env, true>,
    private readonly notifier: NotifierService,
    private readonly settings: SettingsService,
    events: TransactionEvents,
  ) {
    this.unsubscribe = events.onAny((c) => {
      if (c.status === 'PAID' || c.status === 'LATE_PAID')
        void this.paymentAlert(c.transactionId);
    });
  }

  onModuleInit() {
    if (!this.config.get('JOBS_ENABLED', { infer: true })) return;
    this.timers.push(
      setInterval(() => void this.checkListeners(), 30_000),
      setInterval(() => void this.checkBackups(), 5 * 60_000),
    );
  }

  onModuleDestroy() {
    this.timers.forEach(clearInterval);
    this.unsubscribe?.();
  }

  async paymentAlert(transactionId: string): Promise<void> {
    try {
      const [row] = await this.db
        .select({ t: transactions, project: projects.name })
        .from(transactions)
        .innerJoin(projects, eq(projects.id, transactions.projectId))
        .where(eq(transactions.id, transactionId));
      if (!row) return;
      const { t, project } = row;
      if (t.status === 'LATE_PAID') {
        await this.notifier.notify(
          'late_payment',
          `⚠️ <b>Bayar telat</b> ${rupiah(t.finalAmount)}\n${esc(project)} · ${esc(t.merchantRef)}\nTagihan sudah kedaluwarsa saat dibayar. Putuskan di dashboard.`,
        );
      } else {
        await this.notifier.notify(
          'payment',
          `✅ <b>${rupiah(t.finalAmount)}</b> masuk\n${esc(project)} · ${esc(t.merchantRef)}${t.manualNote ? `\nDikonfirmasi manual: ${esc(t.manualNote)}` : ''}`,
        );
      }
    } catch (e) {
      this.logger.error(`Alarm pembayaran gagal: ${(e as Error).message}`);
    }
  }

  /** Alarm saat HP listener offline (sekali per kejadian) dan saat kembali online. */
  async checkListeners(now = Date.now()): Promise<void> {
    const limitMs =
      this.config.get('LISTENER_OFFLINE_AFTER_SEC', { infer: true }) * 1000;
    const rows = await this.db.query.devices.findMany({
      where: isNull(devices.revokedAt),
    });
    for (const d of rows) {
      const seen = d.lastHeartbeatAt?.getTime() ?? d.createdAt.getTime();
      const offline = now - seen > limitMs || d.listenerOk === false;
      if (offline && !d.offlineAlertedAt) {
        await this.db
          .update(devices)
          .set({ offlineAlertedAt: new Date(now) })
          .where(eq(devices.id, d.id));
        const why =
          d.listenerOk === false && now - seen <= limitMs
            ? 'Akses notifikasi mati. Buka aplikasi listener di HP.'
            : `Tidak ada heartbeat sejak ${Math.round((now - seen) / 60_000)} menit lalu. Cek HP, internet, dan charger.`;
        await this.notifier.notify(
          'listener',
          `🔴 <b>Listener offline</b>: ${esc(d.name)}\n${why}\nPembayaran tetap tercatat setelah HP kembali online.`,
        );
      } else if (!offline && d.offlineAlertedAt) {
        await this.db
          .update(devices)
          .set({ offlineAlertedAt: null })
          .where(eq(devices.id, d.id));
        await this.notifier.notify(
          'listener',
          `🟢 <b>Listener kembali online</b>: ${esc(d.name)}`,
        );
      }
    }
  }

  /** Alarm backup gagal (sekali per run) dan backup terlalu lama (paling sering tiap 12 jam). */
  async checkBackups(now = Date.now()): Promise<void> {
    const state = await this.settings.get<{
      seen_failed_id?: string;
      stale_alert_at?: number;
    }>('backup_alerts', {});
    const [latest] = await this.db
      .select()
      .from(backupRuns)
      .orderBy(desc(backupRuns.finishedAt))
      .limit(1);
    if (!latest) return; // backup belum pernah dijalankan: belum dipantau
    let changed = false;
    if (!latest.ok && state.seen_failed_id !== latest.id) {
      await this.notifier.notify(
        'backup',
        `🔴 <b>${latest.kind === 'restore_test' ? 'Uji restore' : 'Backup'} gagal</b>\n${esc(latest.detail ?? 'Tanpa keterangan')}`,
      );
      state.seen_failed_id = latest.id;
      changed = true;
    }
    const [lastOk] = await this.db
      .select()
      .from(backupRuns)
      .where(and(eq(backupRuns.kind, 'backup'), eq(backupRuns.ok, true)))
      .orderBy(desc(backupRuns.finishedAt))
      .limit(1);
    const maxAge =
      this.config.get('BACKUP_MAX_AGE_HOURS', { infer: true }) * 3600_000;
    const age = lastOk ? now - lastOk.finishedAt.getTime() : Infinity;
    if (age > maxAge && now - (state.stale_alert_at ?? 0) > 12 * 3600_000) {
      await this.notifier.notify(
        'backup',
        `🟠 <b>Backup terlambat</b>\n${lastOk ? `Backup sukses terakhir ${Math.round(age / 3600_000)} jam lalu.` : 'Belum ada backup yang sukses.'} Cek container backup di VPS.`,
      );
      state.stale_alert_at = now;
      changed = true;
    }
    if (changed) await this.settings.set('backup_alerts', state);
  }

  async listBackups(limit = 20) {
    const rows = await this.db
      .select()
      .from(backupRuns)
      .orderBy(desc(backupRuns.finishedAt))
      .limit(limit);
    const lastOk = rows.find((r) => r.kind === 'backup' && r.ok) ?? null;
    return {
      max_age_hours: this.config.get('BACKUP_MAX_AGE_HOURS', { infer: true }),
      last_ok_at: lastOk?.finishedAt.toISOString() ?? null,
      runs: rows.map((r) => ({
        id: r.id,
        kind: r.kind,
        ok: r.ok,
        file: r.file,
        size_bytes: r.sizeBytes,
        detail: r.detail,
        started_at: r.startedAt?.toISOString() ?? null,
        finished_at: r.finishedAt.toISOString(),
      })),
    };
  }
}
