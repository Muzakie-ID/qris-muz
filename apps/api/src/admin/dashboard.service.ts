import { Inject, Injectable } from '@nestjs/common';
import {
  and,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  lt,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import { DB, type Db } from '../db/db.module';
import {
  paymentEvents,
  projects,
  qrisSources,
  transactions,
} from '../db/schema';
import { DevicesService } from '../devices/devices.service';

type Status = (typeof transactions.$inferSelect)['status'];
const STATUSES: Status[] = [
  'PENDING',
  'PAID',
  'EXPIRED',
  'CANCELLED',
  'LATE_PAID',
];
const PAID_STATUSES: Status[] = ['PAID', 'LATE_PAID'];
const PERIODS = { day: 1, week: 7, month: 30 } as const;
const DAY_MS = 24 * 3600_000;
const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

export interface PeriodSummary {
  /** Uang masuk (PAID + LATE_PAID) berdasarkan waktu bayar, dan periode sebelumnya. */
  income: number;
  income_prev: number;
  paid: number;
  paid_prev: number;
  manual: number;
  /** Tagihan dibuat dalam periode, dan berapa yang lunas. */
  created: number;
  created_paid: number;
  created_prev: number;
  created_paid_prev: number;
}

export interface ListTransactionsQuery {
  status?: Status;
  q?: string;
  projectId?: string;
  page: number;
  perPage: number;
}

/** Angka untuk dashboard owner. Semua dihitung langsung dari database. */
@Injectable()
export class DashboardService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly devices: DevicesService,
  ) {}

  async overview() {
    const now = new Date();
    const summary = {} as Record<keyof typeof PERIODS, PeriodSummary>;
    for (const [key, days] of Object.entries(PERIODS) as [
      keyof typeof PERIODS,
      number,
    ][]) {
      const start = new Date(now.getTime() - days * DAY_MS);
      const prevStart = new Date(start.getTime() - days * DAY_MS);
      const [cur, prev, created, createdPrev] = await Promise.all([
        this.paidBetween(start, now),
        this.paidBetween(prevStart, start),
        this.createdBetween(start, now),
        this.createdBetween(prevStart, start),
      ]);
      summary[key] = {
        income: cur.income,
        income_prev: prev.income,
        paid: cur.paid,
        paid_prev: prev.paid,
        manual: cur.manual,
        created: created.total,
        created_paid: created.paid,
        created_prev: createdPrev.total,
        created_paid_prev: createdPrev.paid,
      };
    }

    const [pending] = await this.db
      .select({
        total: count(),
        expiringSoon:
          sql<number>`count(*) filter (where ${transactions.expiresAt} < now() + interval '15 minutes')`.mapWith(
            Number,
          ),
      })
      .from(transactions)
      .where(eq(transactions.status, 'PENDING'));

    const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
    const statusRows = await this.db
      .select({ status: transactions.status, n: count() })
      .from(transactions)
      .where(gte(transactions.createdAt, weekAgo))
      .groupBy(transactions.status);
    const byStatus = new Map(statusRows.map((r) => [r.status, r.n]));

    const recent = await this.db
      .select({
        id: transactions.id,
        projectName: projects.name,
        amount: transactions.finalAmount,
        status: transactions.status,
        paidAt: transactions.paidAt,
        manualNote: transactions.manualNote,
      })
      .from(transactions)
      .innerJoin(projects, eq(projects.id, transactions.projectId))
      .where(
        and(
          inArray(transactions.status, PAID_STATUSES),
          isNotNull(transactions.paidAt),
        ),
      )
      .orderBy(desc(transactions.paidAt))
      .limit(5);

    const [events] = await this.db
      .select({
        unparsed:
          sql<number>`count(*) filter (where ${paymentEvents.parseStatus} = 'UNPARSED')`.mapWith(
            Number,
          ),
        unmatched:
          sql<number>`count(*) filter (where ${paymentEvents.matchStatus} = 'UNMATCHED')`.mapWith(
            Number,
          ),
      })
      .from(paymentEvents)
      .where(eq(paymentEvents.isTest, false));

    return {
      summary,
      pending: { total: pending.total, expiring_soon: pending.expiringSoon },
      status_counts: STATUSES.filter((s) => s !== 'CANCELLED').map((s) => ({
        status: s,
        count: byStatus.get(s) ?? 0,
      })),
      recent_payments: recent.map((r) => ({
        id: r.id,
        project_name: r.projectName,
        amount: r.amount,
        status: r.status,
        paid_at: r.paidAt!.toISOString(),
        manual: r.manualNote !== null,
      })),
      monthly_revenue: await this.monthlyRevenue(now),
      listener: await this.devices.listenerStatus(),
      unparsed_events: events?.unparsed ?? 0,
      unmatched_events: events?.unmatched ?? 0,
      server_time: now.toISOString(),
    };
  }

  /** Daftar transaksi semua proyek, untuk halaman Transaksi. */
  async listTransactions(q: ListTransactionsQuery) {
    const filters: SQL[] = [];
    if (q.projectId) filters.push(eq(transactions.projectId, q.projectId));
    const term = q.q?.trim();
    if (term) {
      const digits = term.replace(/[^\d]/g, '');
      const options: SQL[] = [
        ilike(
          transactions.merchantRef,
          `%${term.replace(/[%_\\]/g, (c) => `\\${c}`)}%`,
        ),
        eq(transactions.id, term.toUpperCase()),
      ];
      if (digits && digits.length <= 15)
        options.push(eq(transactions.finalAmount, Number(digits)));
      filters.push(or(...options)!);
    }
    const base = filters.length ? and(...filters) : undefined;
    const where = q.status
      ? and(base, eq(transactions.status, q.status))
      : base;

    const [items, [{ total }], grouped] = await Promise.all([
      this.db
        .select({
          t: transactions,
          projectName: projects.name,
          qrisLabel: qrisSources.label,
        })
        .from(transactions)
        .innerJoin(projects, eq(projects.id, transactions.projectId))
        .innerJoin(qrisSources, eq(qrisSources.id, transactions.qrisSourceId))
        .where(where)
        .orderBy(desc(transactions.createdAt))
        .limit(q.perPage)
        .offset((q.page - 1) * q.perPage),
      this.db.select({ total: count() }).from(transactions).where(where),
      this.db
        .select({
          status: transactions.status,
          n: count(),
          sum: sql<number>`coalesce(sum(${transactions.finalAmount}), 0)`.mapWith(
            Number,
          ),
        })
        .from(transactions)
        .where(base)
        .groupBy(transactions.status),
    ]);

    const counts = { ALL: 0 } as Record<'ALL' | Status, number>;
    const sums = {} as Record<Status, number>;
    for (const s of STATUSES) {
      counts[s] = 0;
      sums[s] = 0;
    }
    for (const g of grouped) {
      counts[g.status] = g.n;
      sums[g.status] = g.sum;
      counts.ALL += g.n;
    }

    return {
      items: items.map(({ t, projectName, qrisLabel }) => ({
        id: t.id,
        project_id: t.projectId,
        project_name: projectName,
        merchant_ref: t.merchantRef,
        amount: t.baseAmount,
        unique_code: t.uniqueCode,
        final_amount: t.finalAmount,
        status: t.status,
        qris_label: qrisLabel,
        created_at: t.createdAt.toISOString(),
        paid_at: t.paidAt?.toISOString() ?? null,
        manual_note: t.manualNote,
      })),
      total,
      page: q.page,
      per_page: q.perPage,
      counts,
      sums,
    };
  }

  private async paidBetween(from: Date, to: Date) {
    const [row] = await this.db
      .select({
        income:
          sql<number>`coalesce(sum(${transactions.finalAmount}), 0)`.mapWith(
            Number,
          ),
        paid: count(),
        manual:
          sql<number>`count(*) filter (where ${transactions.manualNote} is not null)`.mapWith(
            Number,
          ),
      })
      .from(transactions)
      .where(
        and(
          inArray(transactions.status, PAID_STATUSES),
          gte(transactions.paidAt, from),
          lt(transactions.paidAt, to),
        ),
      );
    return row;
  }

  private async createdBetween(from: Date, to: Date) {
    const [row] = await this.db
      .select({
        total: count(),
        paid: sql<number>`count(*) filter (where ${transactions.status} in ('PAID', 'LATE_PAID'))`.mapWith(
          Number,
        ),
      })
      .from(transactions)
      .where(
        and(gte(transactions.createdAt, from), lt(transactions.createdAt, to)),
      );
    return row;
  }

  /** Pendapatan 12 bulan terakhir per bulan kalender WIB, termasuk bulan yang kosong. */
  private async monthlyRevenue(now: Date) {
    const month = sql<string>`to_char(date_trunc('month', ${transactions.paidAt} at time zone 'Asia/Jakarta'), 'YYYY-MM')`;
    const rows = await this.db
      .select({
        month,
        amount:
          sql<number>`coalesce(sum(${transactions.finalAmount}), 0)`.mapWith(
            Number,
          ),
      })
      .from(transactions)
      .where(
        and(
          inArray(transactions.status, PAID_STATUSES),
          gte(transactions.paidAt, new Date(now.getTime() - 400 * DAY_MS)),
        ),
      )
      .groupBy(month);
    const byMonth = new Map(rows.map((r) => [r.month, r.amount]));

    // Bulan berjalan menurut WIB (UTC+7).
    const wib = new Date(now.getTime() + 7 * 3600_000);
    const out: { month: string; label: string; amount: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(
        Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth() - i, 1),
      );
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      out.push({
        month: key,
        label: MONTH_LABELS[d.getUTCMonth()],
        amount: byMonth.get(key) ?? 0,
      });
    }
    return out;
  }
}
