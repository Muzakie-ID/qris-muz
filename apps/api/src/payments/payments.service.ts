import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, desc, eq, gte, inArray, or } from 'drizzle-orm';
import { sha256Hex } from '../common/crypto';
import { TransactionEvents } from '../common/events.service';
import { newId } from '../common/ids';
import { DB, type Db, type DbOrTx } from '../db/db.module';
import { parsers, paymentEvents, transactions } from '../db/schema';
import { QrisSourcesService } from '../qris/qris-sources.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { parseNotification, type ParserRule } from './parser';

export interface IncomingNotification {
  package: string;
  title?: string | null;
  text?: string | null;
  big_text?: string | null;
  sub_text?: string | null;
  posted_at: number;
  notification_key?: string | null;
  app_version?: string | null;
  captured_at?: number | null;
  hash: string;
  is_test?: boolean;
}

type EventRow = typeof paymentEvents.$inferSelect;

/** Pembayaran boleh tercatat sedikit sebelum transaksi dibuat (selisih jam HP/server). */
const CLOCK_SLACK_MS = 2 * 60_000;

/** Hash dedup dihitung ulang di server dari isi notifikasi, tidak mempercayai klien. */
export function eventHash(n: IncomingNotification): string {
  return sha256Hex(
    [
      n.package,
      n.notification_key ?? '',
      String(n.posted_at),
      n.title ?? '',
      n.text ?? '',
      n.big_text ?? '',
    ].join('\u001f'),
  );
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly qrisSources: QrisSourcesService,
    private readonly webhooks: WebhooksService,
    private readonly events: TransactionEvents,
  ) {}

  /**
   * Menyimpan notifikasi dari device, lalu membaca nominal dan mencocokkannya.
   * Notifikasi yang sudah pernah diterima diabaikan (tetap dianggap diterima agar device membuangnya).
   */
  async ingest(
    deviceId: string,
    items: IncomingNotification[],
  ): Promise<{ accepted: string[]; duplicates: number }> {
    const rules = await this.loadRules();
    const allowed = new Set(await this.qrisSources.activePackages());
    let duplicates = 0;
    for (const n of items) {
      const inserted = await this.ingestOne(deviceId, n, rules, allowed);
      if (!inserted) duplicates++;
    }
    return { accepted: items.map((n) => n.hash), duplicates };
  }

  /** Memproses ulang event yang belum terbaca/belum cocok, mis. setelah parser diperbarui. */
  async reprocess(): Promise<{ processed: number; matched: number }> {
    const rules = await this.loadRules();
    const allowed = new Set(await this.qrisSources.activePackages());
    const pending = await this.db.query.paymentEvents.findMany({
      where: and(
        eq(paymentEvents.isTest, false),
        or(
          eq(paymentEvents.parseStatus, 'UNPARSED'),
          eq(paymentEvents.parseStatus, 'IGNORED'),
          eq(paymentEvents.matchStatus, 'UNMATCHED'),
        ),
      ),
      limit: 500,
    });
    let matched = 0;
    for (const e of pending) {
      const changed = await this.db.transaction(async (tx) =>
        this.parseAndMatch(tx, e, rules, allowed),
      );
      if (changed) {
        matched++;
        this.events.emit(changed);
      }
    }
    return { processed: pending.length, matched };
  }

  listEvents(
    filter: {
      parseStatus?: EventRow['parseStatus'];
      matchStatus?: EventRow['matchStatus'];
    },
    limit = 100,
  ) {
    return this.db.query.paymentEvents.findMany({
      where: and(
        filter.parseStatus
          ? eq(paymentEvents.parseStatus, filter.parseStatus)
          : undefined,
        filter.matchStatus
          ? eq(paymentEvents.matchStatus, filter.matchStatus)
          : undefined,
      ),
      orderBy: [desc(paymentEvents.createdAt)],
      limit,
    });
  }

  private async ingestOne(
    deviceId: string,
    n: IncomingNotification,
    rules: ParserRule[],
    allowed: Set<string>,
  ): Promise<boolean> {
    const result = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(paymentEvents)
        .values({
          id: newId.event(),
          deviceId,
          packageName: n.package,
          title: n.title ?? null,
          text: n.text ?? null,
          bigText: n.big_text ?? null,
          subText: n.sub_text ?? null,
          notificationKey: n.notification_key ?? null,
          appVersion: n.app_version ?? null,
          postedAt: new Date(n.posted_at),
          capturedAt: n.captured_at ? new Date(n.captured_at) : null,
          hash: eventHash(n),
          isTest: n.is_test ?? false,
          parseStatus: 'UNPARSED',
          matchStatus: 'PENDING',
        })
        .onConflictDoNothing({ target: paymentEvents.hash })
        .returning();
      if (!row) return { inserted: false, changed: null };
      const changed = await this.parseAndMatch(tx, row, rules, allowed);
      return { inserted: true, changed };
    });
    if (result.changed) this.events.emit(result.changed);
    return result.inserted;
  }

  /** Mengisi hasil baca dan pencocokan satu event. Mengembalikan transaksi yang berubah status. */
  private async parseAndMatch(
    tx: DbOrTx,
    e: EventRow,
    rules: ParserRule[],
    allowed: Set<string>,
  ): Promise<{ transactionId: string; status: string } | null> {
    const setEvent = (v: Partial<EventRow>) =>
      tx.update(paymentEvents).set(v).where(eq(paymentEvents.id, e.id));

    if (e.isTest) {
      await setEvent({ parseStatus: 'IGNORED', matchStatus: 'NOT_APPLICABLE' });
      return null;
    }
    if (!allowed.has(e.packageName)) {
      // Tetap disimpan mentah: bila package belum didaftarkan, owner masih bisa memprosesnya nanti.
      await setEvent({ parseStatus: 'IGNORED', matchStatus: 'NOT_APPLICABLE' });
      return null;
    }

    const parsed = parseNotification(
      {
        packageName: e.packageName,
        title: e.title,
        text: e.text,
        bigText: e.bigText,
        subText: e.subText,
      },
      rules,
    );
    if (!parsed) {
      await setEvent({
        parseStatus: 'UNPARSED',
        matchStatus: 'PENDING',
        parsedAmount: null,
        parserId: null,
      });
      this.logger.warn(
        `Notifikasi ${e.id} dari ${e.packageName} tidak terbaca parser.`,
      );
      return null;
    }

    const source = await this.qrisSources.findByPackage(e.packageName);
    const base = {
      parseStatus: 'PARSED' as const,
      parsedAmount: parsed.amount,
      parserId: parsed.parserId,
      qrisSourceId: source?.id ?? null,
    };
    if (!parsed.autoMatch || !source) {
      await setEvent({ ...base, matchStatus: 'UNMATCHED' });
      return null;
    }

    const [candidate] = await tx
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.qrisSourceId, source.id),
          eq(transactions.finalAmount, parsed.amount),
          inArray(transactions.status, ['PENDING', 'EXPIRED', 'CANCELLED']),
          gte(transactions.codeLockedUntil, e.postedAt),
        ),
      )
      .orderBy(desc(transactions.createdAt))
      .limit(1)
      .for('update');

    const createdOk =
      candidate &&
      e.postedAt.getTime() >= candidate.createdAt.getTime() - CLOCK_SLACK_MS;
    if (!candidate || !createdOk) {
      await setEvent({ ...base, matchStatus: 'UNMATCHED' });
      this.logger.warn(
        `Pembayaran ${parsed.amount} (${e.id}) tidak cocok dengan transaksi mana pun.`,
      );
      return null;
    }

    const late = candidate.status !== 'PENDING';
    const [updated] = await tx
      .update(transactions)
      .set({
        status: late ? 'LATE_PAID' : 'PAID',
        paidAt: e.postedAt,
        matchedEventId: e.id,
      })
      .where(eq(transactions.id, candidate.id))
      .returning();
    await setEvent({
      ...base,
      matchStatus: late ? 'LATE_MATCHED' : 'MATCHED',
      transactionId: candidate.id,
    });
    await this.webhooks.enqueue(
      tx,
      late ? 'transaction.late_paid' : 'transaction.paid',
      updated,
    );
    return { transactionId: updated.id, status: updated.status };
  }

  private async loadRules(): Promise<ParserRule[]> {
    const rows = await this.db.query.parsers.findMany({
      where: eq(parsers.isActive, true),
    });
    return rows.map((r) => ({
      id: r.id,
      packageName: r.packageName,
      pattern: r.pattern,
      priority: r.priority,
      autoMatch: r.autoMatch,
    }));
  }
}
