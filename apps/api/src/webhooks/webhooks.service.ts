import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, asc, count, desc, eq, inArray, lte } from 'drizzle-orm';
import { hmacSha256Hex } from '../common/crypto';
import { newId } from '../common/ids';
import type { Env } from '../config/env';
import { DB, type Db, type DbOrTx } from '../db/db.module';
import { projects, transactions, webhookDeliveries } from '../db/schema';
import { ProjectsService } from '../projects/projects.service';
import {
  toApiView,
  type TransactionRow,
} from '../transactions/transaction-view';

export type WebhookEventType =
  'transaction.paid' | 'transaction.expired' | 'transaction.late_paid';

/** Jeda sebelum percobaan berikutnya: 8 percobaan dalam ±24 jam. */
export const RETRY_DELAYS_MS = [
  60_000,
  5 * 60_000,
  15 * 60_000,
  30 * 60_000,
  60 * 60_000,
  3 * 3600_000,
  6 * 3600_000,
  12 * 3600_000,
];
export const MAX_ATTEMPTS = RETRY_DELAYS_MS.length;
const CLAIM_LEASE_MS = 2 * 60_000;
const TIMEOUT_MS = 10_000;

export function signWebhook(
  secret: string,
  timestamp: string,
  body: string,
): string {
  return hmacSha256Hex(secret, `${timestamp}.${body}`);
}

@Injectable()
export class WebhooksService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WebhooksService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly config: ConfigService<Env, true>,
    private readonly projectsService: ProjectsService,
  ) {}

  onModuleInit() {
    if (this.config.get('JOBS_ENABLED', { infer: true })) {
      this.timer = setInterval(() => void this.dispatchDue(), 5_000);
    }
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Dicatat di transaksi database yang sama dengan perubahan status (pola outbox). */
  async enqueue(
    tx: DbOrTx,
    type: WebhookEventType,
    transaction: TransactionRow,
  ): Promise<void> {
    const eventId = newId.webhookEvent();
    const payload = {
      id: eventId,
      type,
      created_at: new Date().toISOString(),
      data: toApiView(transaction, {
        publicApiUrl: this.config.get('PUBLIC_API_URL', { infer: true }),
        checkoutBaseUrl: this.config.get('CHECKOUT_BASE_URL', { infer: true }),
      }),
    };
    await tx.insert(webhookDeliveries).values({
      id: newId.delivery(),
      eventId,
      eventType: type,
      projectId: transaction.projectId,
      transactionId: transaction.id,
      payload,
    });
  }

  /** Mengirim webhook yang sudah jatuh tempo. Aman dijalankan bersamaan (SKIP LOCKED). */
  async dispatchDue(limit = 20): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try {
      const claimed = await this.db.transaction(async (tx) => {
        const due = await tx
          .select({ id: webhookDeliveries.id })
          .from(webhookDeliveries)
          .where(
            and(
              eq(webhookDeliveries.status, 'PENDING'),
              lte(webhookDeliveries.nextRetryAt, new Date()),
            ),
          )
          .orderBy(asc(webhookDeliveries.nextRetryAt))
          .limit(limit)
          .for('update', { skipLocked: true });
        if (due.length === 0) return [];
        const ids = due.map((d) => d.id);
        // Sewa sementara agar tidak diambil proses lain selama dikirim.
        return tx
          .update(webhookDeliveries)
          .set({ nextRetryAt: new Date(Date.now() + CLAIM_LEASE_MS) })
          .where(inArray(webhookDeliveries.id, ids))
          .returning();
      });
      for (const d of claimed) await this.deliver(d);
      return claimed.length;
    } catch (e) {
      this.logger.error(
        `Gagal memproses antrian webhook: ${(e as Error).message}`,
      );
      return 0;
    } finally {
      this.running = false;
    }
  }

  private async deliver(
    d: typeof webhookDeliveries.$inferSelect,
  ): Promise<void> {
    const project = await this.db.query.projects.findFirst({
      where: eq(projects.id, d.projectId),
    });
    const attempt = d.attempt + 1;
    let statusCode: number | null = null;
    let error: string | null = null;

    if (!project?.webhookUrl) {
      error = 'Proyek belum punya webhook_url.';
    } else {
      const body = JSON.stringify(d.payload);
      const timestamp = String(Date.now());
      try {
        const res = await fetch(project.webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'qrismuz-webhook/1',
            'X-Event-Id': d.eventId,
            'X-Event-Type': d.eventType,
            'X-Timestamp': timestamp,
            'X-Signature': signWebhook(
              this.projectsService.webhookSecret(project),
              timestamp,
              body,
            ),
          },
          body,
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        statusCode = res.status;
        if (!res.ok) error = `Klien membalas HTTP ${res.status}.`;
      } catch (e) {
        error = (e as Error).message;
      }
    }

    if (!error) {
      await this.db
        .update(webhookDeliveries)
        .set({
          status: 'DELIVERED',
          attempt,
          lastStatusCode: statusCode,
          lastError: null,
          deliveredAt: new Date(),
        })
        .where(eq(webhookDeliveries.id, d.id));
      return;
    }

    const failed = attempt >= MAX_ATTEMPTS;
    await this.db
      .update(webhookDeliveries)
      .set({
        status: failed ? 'FAILED' : 'PENDING',
        attempt,
        lastStatusCode: statusCode,
        lastError: error.slice(0, 500),
        nextRetryAt: new Date(
          Date.now() + RETRY_DELAYS_MS[Math.min(attempt - 1, MAX_ATTEMPTS - 1)],
        ),
      })
      .where(eq(webhookDeliveries.id, d.id));
    if (failed)
      this.logger.warn(
        `Webhook ${d.eventId} gagal permanen setelah ${attempt} percobaan: ${error}`,
      );
  }

  /** Log semua pengiriman webhook, terbaru dulu, untuk dashboard. */
  async list(q: {
    status?: 'PENDING' | 'DELIVERED' | 'FAILED';
    page: number;
    perPage: number;
  }) {
    const where = q.status ? eq(webhookDeliveries.status, q.status) : undefined;
    const [items, [{ total }], grouped] = await Promise.all([
      this.db
        .select({
          d: webhookDeliveries,
          projectName: projects.name,
          webhookUrl: projects.webhookUrl,
          merchantRef: transactions.merchantRef,
        })
        .from(webhookDeliveries)
        .innerJoin(projects, eq(projects.id, webhookDeliveries.projectId))
        .innerJoin(
          transactions,
          eq(transactions.id, webhookDeliveries.transactionId),
        )
        .where(where)
        .orderBy(desc(webhookDeliveries.createdAt))
        .limit(q.perPage)
        .offset((q.page - 1) * q.perPage),
      this.db.select({ total: count() }).from(webhookDeliveries).where(where),
      this.db
        .select({ status: webhookDeliveries.status, n: count() })
        .from(webhookDeliveries)
        .groupBy(webhookDeliveries.status),
    ]);
    const counts = { ALL: 0, PENDING: 0, DELIVERED: 0, FAILED: 0 };
    for (const g of grouped) {
      counts[g.status] = g.n;
      counts.ALL += g.n;
    }
    return {
      items: items.map(({ d, projectName, webhookUrl, merchantRef }) => ({
        id: d.id,
        event_id: d.eventId,
        event_type: d.eventType,
        project_name: projectName,
        webhook_url: webhookUrl,
        transaction_id: d.transactionId,
        merchant_ref: merchantRef,
        status: d.status,
        attempt: d.attempt,
        last_status_code: d.lastStatusCode,
        last_error: d.lastError,
        next_retry_at:
          d.status === 'PENDING' ? d.nextRetryAt.toISOString() : null,
        delivered_at: d.deliveredAt?.toISOString() ?? null,
        created_at: d.createdAt.toISOString(),
      })),
      total,
      page: q.page,
      per_page: q.perPage,
      counts,
    };
  }

  /** Riwayat pengiriman webhook satu transaksi. */
  listForTransaction(transactionId: string) {
    return this.db.query.webhookDeliveries.findMany({
      where: eq(webhookDeliveries.transactionId, transactionId),
      orderBy: (w, { asc: a }) => [a(w.createdAt)],
    });
  }

  /** Menjadwalkan kirim ulang segera (dari dashboard/admin). */
  async retryNow(deliveryId: string): Promise<void> {
    const rows = await this.db
      .update(webhookDeliveries)
      .set({ status: 'PENDING', nextRetryAt: new Date() })
      .where(eq(webhookDeliveries.id, deliveryId))
      .returning({ id: webhookDeliveries.id });
    if (rows.length === 0)
      throw new NotFoundException('Pengiriman webhook tidak ditemukan.');
  }
}
