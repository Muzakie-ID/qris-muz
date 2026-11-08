import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, between, eq, gt, inArray, lt, or, sql } from 'drizzle-orm';
import { randomInt } from 'node:crypto';
import { AuditService } from '../common/audit.service';
import { TransactionEvents } from '../common/events.service';
import { newId } from '../common/ids';
import type { Env } from '../config/env';
import { DB, type Db } from '../db/db.module';
import { qrisSources, transactions } from '../db/schema';
import type { Project } from '../projects/projects.service';
import { toDynamicQris } from '../qris/core';
import { WebhooksService } from '../webhooks/webhooks.service';
import { toApiView, type TransactionRow } from './transaction-view';

export const MAX_UNIQUE_CODE = 999;

export interface CreateTransactionInput {
  amount: number;
  merchantRef: string;
  expiryMin?: number;
  returnUrl?: string;
  metadata?: Record<string, unknown>;
  qrisSourceId?: string;
  idempotencyKey?: string;
}

function isUniqueViolation(e: unknown, constraint?: string): boolean {
  const err = e as {
    code?: string;
    constraint?: string;
    cause?: { code?: string; constraint?: string };
  };
  const code = err?.code ?? err?.cause?.code;
  const name = err?.constraint ?? err?.cause?.constraint;
  return code === '23505' && (!constraint || name === constraint);
}

/** Memilih kode unik 1–999 secara acak dari yang belum dipakai. */
export function pickFreeCode(
  used: Set<number>,
  max = MAX_UNIQUE_CODE,
): number | null {
  const free: number[] = [];
  for (let c = 1; c <= max; c++) if (!used.has(c)) free.push(c);
  return free.length ? free[randomInt(free.length)] : null;
}

@Injectable()
export class TransactionsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TransactionsService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly config: ConfigService<Env, true>,
    private readonly webhooks: WebhooksService,
    private readonly events: TransactionEvents,
    private readonly audit: AuditService,
  ) {}

  onModuleInit() {
    if (this.config.get('JOBS_ENABLED', { infer: true })) {
      this.timer = setInterval(
        () =>
          void this.expireDue().catch((e: Error) =>
            this.logger.error(e.message),
          ),
        15_000,
      );
    }
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  view(t: TransactionRow) {
    return toApiView(t, {
      publicApiUrl: this.config.get('PUBLIC_API_URL', { infer: true }),
      checkoutBaseUrl: this.config.get('CHECKOUT_BASE_URL', { infer: true }),
    });
  }

  async create(
    project: Project,
    input: CreateTransactionInput,
  ): Promise<{ transaction: TransactionRow; replayed: boolean }> {
    if (input.idempotencyKey) {
      const existing = await this.findByIdempotency(
        project.id,
        input.idempotencyKey,
      );
      if (existing) return { transaction: existing, replayed: true };
    }

    const max = this.config.get('QRIS_MAX_AMOUNT', { infer: true });
    if (input.amount + MAX_UNIQUE_CODE > max) {
      throw new BadRequestException(
        `amount maksimal ${max - MAX_UNIQUE_CODE} (menyisakan ruang untuk kode unik).`,
      );
    }

    const sourceId =
      input.qrisSourceId ??
      project.defaultQrisSourceId ??
      (await this.onlyActiveSource());
    const source = await this.db.query.qrisSources.findFirst({
      where: eq(qrisSources.id, sourceId),
    });
    if (!source || !source.isActive) {
      throw new UnprocessableEntityException(
        `QRIS ${sourceId} tidak ada atau tidak aktif.`,
      );
    }

    const expiryMin = input.expiryMin ?? project.defaultExpiryMin;
    const graceMs =
      this.config.get('UNIQUE_CODE_GRACE_HOURS', { infer: true }) * 3600_000;

    try {
      const transaction = await this.db.transaction(async (tx) => {
        // Satu pembuat transaksi per QRIS pada satu waktu, agar kode unik tidak bentrok.
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtext(${source.id}))`,
        );
        const now = new Date();
        const taken = await tx
          .select({ finalAmount: transactions.finalAmount })
          .from(transactions)
          .where(
            and(
              eq(transactions.qrisSourceId, source.id),
              between(
                transactions.finalAmount,
                input.amount + 1,
                input.amount + MAX_UNIQUE_CODE,
              ),
              or(
                gt(transactions.codeLockedUntil, now),
                eq(transactions.status, 'PENDING'),
              ),
            ),
          );
        const code = pickFreeCode(
          new Set(taken.map((t) => t.finalAmount - input.amount)),
        );
        if (code === null) {
          throw new ConflictException(
            'Semua kode unik untuk nominal ini sedang dipakai. Coba lagi beberapa saat lagi.',
          );
        }
        const finalAmount = input.amount + code;
        const expiresAt = new Date(now.getTime() + expiryMin * 60_000);
        const [row] = await tx
          .insert(transactions)
          .values({
            id: newId.transaction(),
            projectId: project.id,
            qrisSourceId: source.id,
            merchantRef: input.merchantRef,
            baseAmount: input.amount,
            uniqueCode: code,
            finalAmount,
            qrisPayload: toDynamicQris(source.rawPayload, finalAmount, {
              maxAmount: max,
            }),
            idempotencyKey: input.idempotencyKey ?? null,
            returnUrl: input.returnUrl ?? project.defaultReturnUrl ?? null,
            metadata: input.metadata ?? null,
            expiresAt,
            codeLockedUntil: new Date(expiresAt.getTime() + graceMs),
          })
          .returning();
        return row;
      });
      return { transaction, replayed: false };
    } catch (e) {
      // Dua request dengan Idempotency-Key sama datang bersamaan: kembalikan yang sudah dibuat.
      if (
        input.idempotencyKey &&
        isUniqueViolation(e, 'transactions_idempotency_uq')
      ) {
        const existing = await this.findByIdempotency(
          project.id,
          input.idempotencyKey,
        );
        if (existing) return { transaction: existing, replayed: true };
      }
      throw e;
    }
  }

  async getForProject(project: Project, id: string): Promise<TransactionRow> {
    const t = await this.db.query.transactions.findFirst({
      where: and(
        eq(transactions.id, id),
        eq(transactions.projectId, project.id),
      ),
    });
    if (!t) throw new NotFoundException('Transaksi tidak ditemukan.');
    return t;
  }

  async get(id: string): Promise<TransactionRow | undefined> {
    return this.db.query.transactions.findFirst({
      where: eq(transactions.id, id),
    });
  }

  async cancel(project: Project, id: string): Promise<TransactionRow> {
    const [row] = await this.db
      .update(transactions)
      .set({ status: 'CANCELLED', cancelledAt: new Date() })
      .where(
        and(
          eq(transactions.id, id),
          eq(transactions.projectId, project.id),
          eq(transactions.status, 'PENDING'),
        ),
      )
      .returning();
    if (!row) {
      const t = await this.getForProject(project, id);
      throw new ConflictException(
        `Transaksi berstatus ${t.status}, hanya PENDING yang bisa dibatalkan.`,
      );
    }
    this.events.emit({ transactionId: row.id, status: row.status });
    return row;
  }

  /** Mengubah transaksi PENDING yang lewat batas waktu menjadi EXPIRED. */
  async expireDue(): Promise<number> {
    const expired = await this.db.transaction(async (tx) => {
      const rows = await tx
        .update(transactions)
        .set({ status: 'EXPIRED' })
        .where(
          and(
            eq(transactions.status, 'PENDING'),
            lt(transactions.expiresAt, new Date()),
          ),
        )
        .returning();
      for (const r of rows)
        await this.webhooks.enqueue(tx, 'transaction.expired', r);
      return rows;
    });
    for (const r of expired)
      this.events.emit({ transactionId: r.id, status: r.status });
    return expired.length;
  }

  /** Konfirmasi manual oleh owner, mis. pembeli salah nominal tapi uang sudah masuk. */
  async confirmManually(id: string, reason: string): Promise<TransactionRow> {
    const row = await this.db.transaction(async (tx) => {
      const [t] = await tx
        .update(transactions)
        .set({ status: 'PAID', paidAt: new Date(), manualNote: reason })
        .where(
          and(
            eq(transactions.id, id),
            inArray(transactions.status, ['PENDING', 'EXPIRED', 'CANCELLED']),
          ),
        )
        .returning();
      if (!t) return null;
      await this.webhooks.enqueue(tx, 'transaction.paid', t);
      await this.audit.log(
        'transaction.confirm_manual',
        t.id,
        { reason, amount: t.finalAmount },
        undefined,
        tx,
      );
      return t;
    });
    if (!row) {
      const t = await this.get(id);
      if (!t) throw new NotFoundException('Transaksi tidak ditemukan.');
      throw new ConflictException(`Transaksi sudah berstatus ${t.status}.`);
    }
    this.events.emit({ transactionId: row.id, status: row.status });
    return row;
  }

  private findByIdempotency(projectId: string, key: string) {
    return this.db.query.transactions.findFirst({
      where: and(
        eq(transactions.projectId, projectId),
        eq(transactions.idempotencyKey, key),
      ),
    });
  }

  private async onlyActiveSource(): Promise<string> {
    const active = await this.db
      .select({ id: qrisSources.id })
      .from(qrisSources)
      .where(eq(qrisSources.isActive, true));
    if (active.length === 1) return active[0].id;
    throw new UnprocessableEntityException(
      active.length === 0
        ? 'Belum ada QRIS aktif. Tambahkan QRIS statis lewat admin.'
        : 'Ada lebih dari satu QRIS aktif: kirim qris_source_id atau setel QRIS default proyek.',
    );
  }
}
