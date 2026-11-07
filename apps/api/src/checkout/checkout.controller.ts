import {
  Controller,
  Get,
  GoneException,
  Header,
  MessageEvent,
  NotFoundException,
  Param,
  Sse,
  StreamableFile,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { Inject } from '@nestjs/common';
import { Observable, concat, interval, map, merge, of, takeWhile } from 'rxjs';
import { TransactionEvents } from '../common/events.service';
import { DB, type Db } from '../db/db.module';
import { projects, qrisSources, transactions } from '../db/schema';
import { QrisService } from '../qris/qris.service';

const FINAL = new Set(['PAID', 'LATE_PAID', 'EXPIRED', 'CANCELLED']);

/**
 * Data untuk halaman bayar pembeli (/pay/:id di web app). Tanpa autentikasi:
 * keamanan bergantung pada ID transaksi yang acak, dan hanya data seperlunya yang dibuka.
 */
@Controller('public/checkout')
export class CheckoutController {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly qris: QrisService,
    private readonly events: TransactionEvents,
  ) {}

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  async get(@Param('id') id: string) {
    const [row] = await this.db
      .select({
        t: transactions,
        projectName: projects.name,
        merchantName: qrisSources.merchantName,
        nmid: qrisSources.nmid,
      })
      .from(transactions)
      .innerJoin(projects, eq(projects.id, transactions.projectId))
      .innerJoin(qrisSources, eq(qrisSources.id, transactions.qrisSourceId))
      .where(eq(transactions.id, id))
      .limit(1);
    if (!row) throw new NotFoundException('Tagihan tidak ditemukan.');
    const { t } = row;
    const payable =
      t.status === 'PENDING' && t.expiresAt.getTime() > Date.now();
    return {
      id: t.id,
      project_name: row.projectName,
      merchant_ref: t.merchantRef,
      merchant_name: row.merchantName,
      nmid: row.nmid,
      final_amount: t.finalAmount,
      unique_code: t.uniqueCode,
      status: t.status,
      qris_payload: payable ? t.qrisPayload : null,
      expires_at: t.expiresAt.toISOString(),
      paid_at: t.paidAt?.toISOString() ?? null,
      return_url: t.returnUrl,
      server_time: new Date().toISOString(),
    };
  }

  /** Gambar QR, hanya selama tagihan masih bisa dibayar. */
  @Get(':id/qr.png')
  @Header('Content-Type', 'image/png')
  @Header('Cache-Control', 'no-store')
  async qr(@Param('id') id: string): Promise<StreamableFile> {
    const t = await this.db.query.transactions.findFirst({
      where: eq(transactions.id, id),
    });
    if (!t) throw new NotFoundException('Tagihan tidak ditemukan.');
    if (t.status !== 'PENDING' || t.expiresAt.getTime() <= Date.now()) {
      throw new GoneException('Tagihan sudah tidak bisa dibayar.');
    }
    return new StreamableFile(await this.qris.toPng(t.qrisPayload));
  }

  /** Server-Sent Events: status terbaru dikirim begitu berubah, berhenti saat final. */
  @Sse(':id/events')
  async stream(@Param('id') id: string): Promise<Observable<MessageEvent>> {
    const t = await this.db.query.transactions.findFirst({
      where: eq(transactions.id, id),
      columns: { id: true, status: true },
    });
    if (!t) throw new NotFoundException('Tagihan tidak ditemukan.');
    const changes = this.events.watch(id).pipe(map((c) => c.status));
    // Ping berkala agar koneksi tidak diputus proxy saat sepi.
    const pings = interval(25_000).pipe(map(() => 'ping'));
    const statuses = concat(of(t.status), merge(changes, pings)).pipe(
      takeWhile((s) => !FINAL.has(s), true),
    );
    return statuses.pipe(
      map((s): MessageEvent =>
        s === 'ping'
          ? { type: 'ping', data: '' }
          : { type: 'status', data: { status: s } },
      ),
    );
  }
}
