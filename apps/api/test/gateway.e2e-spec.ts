import { INestApplication } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import type { App } from 'supertest/types';
import { randomToken } from '../src/common/crypto';
import { DB, type Db } from '../src/db/db.module';
import {
  paymentEvents,
  transactions,
  webhookDeliveries,
} from '../src/db/schema';
import { signDeviceRequest } from '../src/devices/device-signature.guard';
import { parseQris } from '../src/qris/core';
import { buildStaticQris } from '../src/qris/core/fixtures';
import { TransactionsService } from '../src/transactions/transactions.service';
import { WebhooksService, signWebhook } from '../src/webhooks/webhooks.service';
import { createTestApp, resetDb } from './helpers';
import { E2E_ADMIN_TOKEN } from './setup-env';

const DANA_PKG = 'test.dana.bisnis';
const GOPAY_PKG = 'test.gopay.merchant';

interface Received {
  headers: IncomingHttpHeaders;
  body: string;
}

describe('Gateway (e2e)', () => {
  let app: INestApplication<App>;
  let db: Db;
  let hook: Server;
  let hookUrl: string;
  let hookStatus = 200;
  const received: Received[] = [];

  // Disiapkan di beforeAll lewat API admin, seperti yang dilakukan owner.
  let danaId: string;
  let gopayId: string;
  let projectId: string;
  let webhookSecret: string;
  let apiKey: string;
  let device: { id: string; secret: string };

  const http = () => request(app.getHttpServer());
  const admin = (method: 'get' | 'post' | 'patch', path: string) =>
    http()[method](path).set('Authorization', `Bearer ${E2E_ADMIN_TOKEN}`);
  const api = (method: 'get' | 'post', path: string, key = apiKey) =>
    http()[method](path).set('Authorization', `Bearer ${key}`);

  function deviceCall(
    method: 'get' | 'post',
    path: string,
    body?: unknown,
    opts: { secret?: string; timestamp?: number; nonce?: string } = {},
  ) {
    const raw = body === undefined ? '' : JSON.stringify(body);
    const ts = String(opts.timestamp ?? Date.now());
    const nonce = opts.nonce ?? randomToken(12);
    const sig = signDeviceRequest(opts.secret ?? device.secret, ts, nonce, raw);
    const req = http()
      [method](path)
      .set('X-Device-Id', device.id)
      .set('X-Timestamp', ts)
      .set('X-Nonce', nonce)
      .set('X-Signature', sig);
    return body === undefined
      ? req
      : req.set('Content-Type', 'application/json').send(raw);
  }

  let seq = 0;
  function notif(
    pkg: string,
    title: string,
    text: string,
    extra: Record<string, unknown> = {},
  ) {
    seq++;
    return {
      package: pkg,
      title,
      text,
      posted_at: Date.now(),
      notification_key: `0|${pkg}|${seq}|null|10001`,
      hash: `client-hash-${seq}`,
      ...extra,
    };
  }
  const danaPaid = (amount: number, extra = {}) =>
    notif(
      DANA_PKG,
      'Pembayaran Masuk',
      `Rp${amount.toLocaleString('id-ID')} diterima DANA Bisnis.`,
      extra,
    );
  const gopayPaid = (amount: number) =>
    notif(
      GOPAY_PKG,
      'Pembayaran QRIS statis diterima',
      `Rp ${amount.toLocaleString('id-ID')} di TOKO CONTOH, JAKARTA.`,
    );

  async function createTx(body: Record<string, unknown>, key = apiKey) {
    const res = await api('post', '/v1/transactions', key)
      .send(body)
      .expect(201);
    return res.body as {
      id: string;
      final_amount: number;
      unique_code: number;
      status: string;
      qris_payload: string;
    };
  }

  async function statusOf(id: string) {
    const t = await db.query.transactions.findFirst({
      where: eq(transactions.id, id),
    });
    return t?.status;
  }

  beforeAll(async () => {
    hook = createServer((req, res) => {
      let body = '';
      req.on('data', (c: Buffer) => (body += c.toString()));
      req.on('end', () => {
        received.push({ headers: req.headers, body });
        res.statusCode = hookStatus;
        res.end('ok');
      });
    });
    await new Promise<void>((r) => hook.listen(0, '127.0.0.1', r));
    hookUrl = `http://127.0.0.1:${(hook.address() as AddressInfo).port}/webhook`;

    app = await createTestApp();
    db = app.get<Db>(DB);
    await resetDb(app);

    const dana = await admin('post', '/admin/qris-sources')
      .send({
        label: 'DANA Bisnis',
        payload: buildStaticQris({ withTip: true }),
        source_package: DANA_PKG,
      })
      .expect(201);
    danaId = (dana.body as { id: string }).id;
    const gopay = await admin('post', '/admin/qris-sources')
      .send({
        label: 'GoPay Merchant',
        payload: buildStaticQris(),
        source_package: GOPAY_PKG,
      })
      .expect(201);
    gopayId = (gopay.body as { id: string }).id;

    const project = await admin('post', '/admin/projects')
      .send({
        name: 'KursusKu',
        webhook_url: hookUrl,
        default_qris_source_id: danaId,
        default_return_url: 'https://kursusku.test/selesai',
      })
      .expect(201);
    projectId = (project.body as { id: string }).id;
    webhookSecret = (project.body as { webhook_secret: string }).webhook_secret;
    expect(webhookSecret).toMatch(/^whsec_/);

    const key = await admin(
      'post',
      `/admin/projects/${projectId}/api-keys`,
    ).expect(201);
    apiKey = (key.body as { api_key: string }).api_key;
    expect(apiKey).toMatch(/^qm_live_/);

    const pairing = await admin('post', '/admin/devices/pairing-tokens')
      .send({ device_name: 'Redmi Note 7' })
      .expect(201);
    const reg = await http()
      .post('/device/register')
      .send({ token: (pairing.body as { token: string }).token })
      .expect(201);
    const r = reg.body as { device_id: string; secret: string };
    device = { id: r.device_id, secret: r.secret };
  });

  afterAll(async () => {
    await app.close();
    await new Promise((r) => hook.close(r));
  });

  beforeEach(() => {
    received.length = 0;
    hookStatus = 200;
  });

  describe('admin', () => {
    it('menolak tanpa token admin', () =>
      http().get('/admin/projects').expect(401));

    it('menolak QRIS yang sudah dinamis', async () => {
      const dynamic = (await createTx({ amount: 1000, merchant_ref: 'X' }))
        .qris_payload;
      const res = await admin('post', '/admin/qris-sources').send({
        label: 'x',
        payload: dynamic,
      });
      expect(res.status).toBe(422);
    });

    it('menolak package yang sudah dipakai QRIS lain', () =>
      admin('post', '/admin/qris-sources')
        .send({
          label: 'dobel',
          payload: buildStaticQris(),
          source_package: DANA_PKG,
        })
        .expect(409));

    it('token pairing hanya bisa dipakai sekali', async () => {
      const pairing = await admin('post', '/admin/devices/pairing-tokens')
        .send({ device_name: 'HP lain' })
        .expect(201);
      const token = (pairing.body as { token: string }).token;
      await http().post('/device/register').send({ token }).expect(201);
      await http().post('/device/register').send({ token }).expect(410);
    });
  });

  describe('POST /v1/transactions', () => {
    it('membuat tagihan dengan nominal unik dan QRIS dinamis', async () => {
      const res = await api('post', '/v1/transactions')
        .send({
          amount: 50000,
          merchant_ref: 'ORDER-1',
          metadata: { user_id: 88 },
        })
        .expect(201);
      const t = res.body as Record<string, unknown> & {
        final_amount: number;
        unique_code: number;
        qris_payload: string;
      };
      expect(t).toMatchObject({
        merchant_ref: 'ORDER-1',
        status: 'PENDING',
        amount: 50000,
        qris_source_id: danaId,
        return_url: 'https://kursusku.test/selesai',
        metadata: { user_id: 88 },
        checkout_url: `http://web.test/pay/${t.id as string}`,
        qr_image_url: `http://api.test/public/checkout/${t.id as string}/qr.png`,
      });
      expect(t.unique_code).toBeGreaterThanOrEqual(1);
      expect(t.unique_code).toBeLessThanOrEqual(999);
      expect(t.final_amount).toBe(50000 + t.unique_code);
      expect(parseQris(t.qris_payload).info).toMatchObject({
        pointOfInitiation: 'dynamic',
        amount: t.final_amount,
      });
    });

    it('nominal akhir tidak pernah sama untuk QRIS yang sama', async () => {
      const amounts = new Set<number>();
      for (let i = 0; i < 20; i++) {
        amounts.add(
          (await createTx({ amount: 25000, merchant_ref: `U-${i}` }))
            .final_amount,
        );
      }
      expect(amounts.size).toBe(20);
    });

    it('Idempotency-Key mengembalikan transaksi yang sama', async () => {
      const first = await api('post', '/v1/transactions')
        .set('Idempotency-Key', 'order-77')
        .send({ amount: 15000, merchant_ref: 'ORDER-77' })
        .expect(201);
      const again = await api('post', '/v1/transactions')
        .set('Idempotency-Key', 'order-77')
        .send({ amount: 15000, merchant_ref: 'ORDER-77' })
        .expect(200);
      expect(again.headers['idempotent-replayed']).toBe('true');
      expect((again.body as { id: string }).id).toBe(
        (first.body as { id: string }).id,
      );
    });

    it('memvalidasi input', async () => {
      await api('post', '/v1/transactions')
        .send({ amount: 10.5, merchant_ref: 'A' })
        .expect(400);
      await api('post', '/v1/transactions').send({ amount: 1000 }).expect(400);
      await api('post', '/v1/transactions')
        .send({ amount: 10_000_000, merchant_ref: 'A' })
        .expect(400);
      await api('post', '/v1/transactions')
        .send({
          amount: 1000,
          merchant_ref: 'A',
          qris_source_id: 'qrs_tidak_ada',
        })
        .expect(422);
    });

    it('menolak API key yang salah', () =>
      api('post', '/v1/transactions', 'qm_live_salah')
        .send({ amount: 1000, merchant_ref: 'A' })
        .expect(401));

    it('proyek lain tidak bisa melihat transaksi ini', async () => {
      const t = await createTx({ amount: 1000, merchant_ref: 'PRIVAT' });
      const other = await admin('post', '/admin/projects')
        .send({ name: 'Proyek lain', default_qris_source_id: danaId })
        .expect(201);
      const key = await admin(
        'post',
        `/admin/projects/${(other.body as { id: string }).id}/api-keys`,
      ).expect(201);
      await api(
        'get',
        `/v1/transactions/${t.id}`,
        (key.body as { api_key: string }).api_key,
      ).expect(404);
      await api('get', `/v1/transactions/${t.id}`).expect(200);
    });
  });

  describe('API device', () => {
    it('config berisi package dari semua QRIS aktif', async () => {
      const res = await deviceCall('get', '/device/config').expect(200);
      expect((res.body as { packages: string[] }).packages.sort()).toEqual(
        [DANA_PKG, GOPAY_PKG].sort(),
      );
    });

    it('menolak tanda tangan salah, nonce bekas, dan jam yang meleset', async () => {
      await deviceCall('get', '/device/config', undefined, {
        secret: 'secret-salah',
      }).expect(401);
      const nonce = randomToken(12);
      await deviceCall('get', '/device/config', undefined, { nonce }).expect(
        200,
      );
      await deviceCall('get', '/device/config', undefined, { nonce }).expect(
        401,
      );
      await deviceCall('get', '/device/config', undefined, {
        timestamp: Date.now() - 10 * 60_000,
      }).expect(401);
      await http().get('/device/config').expect(401);
    });

    it('body yang diubah setelah ditandatangani ditolak', async () => {
      const raw = JSON.stringify({ listener_ok: true });
      const ts = String(Date.now());
      const nonce = randomToken(12);
      await http()
        .post('/device/heartbeat')
        .set('X-Device-Id', device.id)
        .set('X-Timestamp', ts)
        .set('X-Nonce', nonce)
        .set('X-Signature', signDeviceRequest(device.secret, ts, nonce, raw))
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({ listener_ok: false }))
        .expect(401);
    });

    it('token pairing disertai link untuk QR', async () => {
      const res = await admin('post', '/admin/devices/pairing-tokens')
        .send({ device_name: 'QR' })
        .expect(201);
      const body = res.body as { token: string; pairing_uri: string };
      const uri = new URL(body.pairing_uri);
      expect(uri.protocol).toBe('qrismuz:');
      expect(uri.searchParams.get('server')).toBe('http://api.test');
      expect(uri.searchParams.get('token')).toBe(body.token);
    });

    it('perintah dari admin diambil sekali lewat heartbeat', async () => {
      await admin('post', `/admin/devices/${device.id}/commands`)
        .send({ command: 'rescan' })
        .expect(200);
      await admin('post', `/admin/devices/${device.id}/commands`)
        .send({ command: 'refresh_config' })
        .expect(200);
      await admin('post', `/admin/devices/${device.id}/commands`)
        .send({ command: 'hapus_semua' })
        .expect(400);
      const first = await deviceCall('post', '/device/heartbeat', {
        listener_ok: true,
        app_version: '1.0.0',
        last_crash: 'java.lang.IllegalStateException: contoh',
      }).expect(200);
      expect((first.body as { commands: string[] }).commands).toEqual([
        'rescan',
        'refresh_config',
      ]);
      const second = await deviceCall('post', '/device/heartbeat', {
        listener_ok: true,
      }).expect(200);
      expect((second.body as { commands: string[] }).commands).toEqual([]);
    });

    it('heartbeat membuat status listener online', async () => {
      const hb = await deviceCall('post', '/device/heartbeat', {
        listener_ok: true,
        battery: 100,
        charging: true,
        queued: 0,
      }).expect(200);
      expect(hb.body).toMatchObject({ next_heartbeat_sec: 60, commands: [] });
      const st = await api('get', '/v1/status').expect(200);
      expect(st.body).toMatchObject({
        listener_online: true,
        confirmation: 'realtime',
      });
    });
  });

  describe('pembayaran masuk', () => {
    it('notifikasi DANA melunasi transaksi dan mengirim webhook bertanda tangan', async () => {
      const t = await createTx({
        amount: 50000,
        merchant_ref: 'ORDER-PAY',
        metadata: { kelas: 'python' },
      });
      const res = await deviceCall('post', '/device/events', {
        events: [danaPaid(t.final_amount)],
      }).expect(200);
      expect(res.body).toMatchObject({ duplicates: 0 });
      expect(await statusOf(t.id)).toBe('PAID');

      expect(
        await app.get(WebhooksService).dispatchDue(),
      ).toBeGreaterThanOrEqual(1);
      const hit = received.find(
        (r) =>
          (JSON.parse(r.body) as { data: { id: string } }).data.id === t.id,
      );
      expect(hit).toBeDefined();
      const ts = hit!.headers['x-timestamp'] as string;
      expect(hit!.headers['x-signature']).toBe(
        signWebhook(webhookSecret, ts, hit!.body),
      );
      expect(hit!.headers['x-event-id']).toMatch(/^whe_/);
      const payload = JSON.parse(hit!.body) as {
        type: string;
        data: Record<string, unknown>;
      };
      expect(payload.type).toBe('transaction.paid');
      expect(payload.data).toMatchObject({
        status: 'PAID',
        final_amount: t.final_amount,
        metadata: { kelas: 'python' },
        qris_payload: null,
      });

      const delivery = await db.query.webhookDeliveries.findFirst({
        where: eq(webhookDeliveries.transactionId, t.id),
      });
      expect(delivery).toMatchObject({ status: 'DELIVERED', attempt: 1 });
    });

    it('notifikasi yang sama dua kali hanya tercatat sekali', async () => {
      const t = await createTx({ amount: 30000, merchant_ref: 'DUP' });
      const n = danaPaid(t.final_amount);
      await deviceCall('post', '/device/events', { events: [n] }).expect(200);
      const again = await deviceCall('post', '/device/events', {
        events: [n],
      }).expect(200);
      expect(again.body).toMatchObject({ accepted: [n.hash], duplicates: 1 });
      const rows = await db.query.paymentEvents.findMany({
        where: eq(paymentEvents.transactionId, t.id),
      });
      expect(rows).toHaveLength(1);
    });

    it('dua pembayaran bernominal sama dari notifikasi berbeda tercatat dua kali', async () => {
      const before = (await db.query.paymentEvents.findMany()).length;
      const t = await createTx({ amount: 20000, merchant_ref: 'DOUBLE' });
      await deviceCall('post', '/device/events', {
        events: [danaPaid(t.final_amount), danaPaid(t.final_amount)],
      }).expect(200);
      const after = await db.query.paymentEvents.findMany();
      expect(after.length - before).toBe(2);
      // Yang kedua tidak menemukan transaksi PENDING lagi: dicatat UNMATCHED untuk ditinjau owner.
      expect(
        after
          .filter((e) => e.parsedAmount === t.final_amount)
          .map((e) => e.matchStatus)
          .sort(),
      ).toEqual(['MATCHED', 'UNMATCHED']);
    });

    it('multi-QRIS: notifikasi DANA tidak melunasi tagihan QRIS GoPay', async () => {
      const t = await createTx({
        amount: 40000,
        merchant_ref: 'GOPAY-1',
        qris_source_id: gopayId,
      });
      await deviceCall('post', '/device/events', {
        events: [danaPaid(t.final_amount)],
      }).expect(200);
      expect(await statusOf(t.id)).toBe('PENDING');
      await deviceCall('post', '/device/events', {
        events: [gopayPaid(t.final_amount)],
      }).expect(200);
      expect(await statusOf(t.id)).toBe('PAID');
    });

    it('pembayaran setelah kedaluwarsa menjadi LATE_PAID dengan webhook khusus', async () => {
      const t = await createTx({ amount: 60000, merchant_ref: 'TELAT' });
      await db
        .update(transactions)
        .set({ expiresAt: new Date(Date.now() - 1000) })
        .where(eq(transactions.id, t.id));
      expect(
        await app.get(TransactionsService).expireDue(),
      ).toBeGreaterThanOrEqual(1);
      expect(await statusOf(t.id)).toBe('EXPIRED');

      await deviceCall('post', '/device/events', {
        events: [danaPaid(t.final_amount)],
      }).expect(200);
      expect(await statusOf(t.id)).toBe('LATE_PAID');
      const types = (
        await db.query.webhookDeliveries.findMany({
          where: eq(webhookDeliveries.transactionId, t.id),
        })
      ).map((d) => d.eventType);
      expect(types.sort()).toEqual([
        'transaction.expired',
        'transaction.late_paid',
      ]);
    });

    it('nominal unik yang masih masa tenggang tidak dipakai transaksi baru', async () => {
      const t = await createTx({ amount: 70000, merchant_ref: 'TENGGANG' });
      await db
        .update(transactions)
        .set({ status: 'EXPIRED' })
        .where(eq(transactions.id, t.id));
      for (let i = 0; i < 30; i++) {
        expect(
          (await createTx({ amount: 70000, merchant_ref: `BARU-${i}` }))
            .final_amount,
        ).not.toBe(t.final_amount);
      }
    });

    it('notifikasi yang tidak terbaca tetap disimpan untuk ditinjau', async () => {
      await deviceCall('post', '/device/events', {
        events: [notif(DANA_PKG, 'Info', 'Akun kamu sudah diverifikasi')],
      }).expect(200);
      const res = await admin(
        'get',
        '/admin/events?parse_status=UNPARSED',
      ).expect(200);
      expect(
        (res.body as { text: string }[]).some(
          (e) => e.text === 'Akun kamu sudah diverifikasi',
        ),
      ).toBe(true);
    });

    it('notifikasi uji tidak pernah melunasi transaksi', async () => {
      const t = await createTx({ amount: 11000, merchant_ref: 'UJI' });
      await deviceCall('post', '/device/events', {
        events: [danaPaid(t.final_amount, { is_test: true })],
      }).expect(200);
      expect(await statusOf(t.id)).toBe('PENDING');
    });
  });

  describe('webhook gagal', () => {
    it('dijadwalkan ulang dengan jeda bertahap', async () => {
      hookStatus = 500;
      const t = await createTx({ amount: 12000, merchant_ref: 'HOOK-500' });
      await deviceCall('post', '/device/events', {
        events: [danaPaid(t.final_amount)],
      }).expect(200);
      await app.get(WebhooksService).dispatchDue();
      const d = await db.query.webhookDeliveries.findFirst({
        where: eq(webhookDeliveries.transactionId, t.id),
      });
      expect(d).toMatchObject({
        status: 'PENDING',
        attempt: 1,
        lastStatusCode: 500,
      });
      expect(d!.nextRetryAt.getTime()).toBeGreaterThan(Date.now() + 30_000);
    });
  });

  describe('pembatalan dan konfirmasi manual', () => {
    it('membatalkan transaksi PENDING, lalu menolak pembatalan kedua', async () => {
      const t = await createTx({ amount: 13000, merchant_ref: 'BATAL' });
      await api('post', `/v1/transactions/${t.id}/cancel`).expect(200);
      await api('post', `/v1/transactions/${t.id}/cancel`).expect(409);
    });

    it('owner bisa menandai lunas secara manual, tercatat di audit log', async () => {
      const t = await createTx({ amount: 14000, merchant_ref: 'MANUAL' });
      const res = await admin('post', `/admin/transactions/${t.id}/confirm`)
        .send({ reason: 'Pembeli salah transfer nominal' })
        .expect(200);
      expect((res.body as { status: string }).status).toBe('PAID');
      await admin('post', `/admin/transactions/${t.id}/confirm`)
        .send({ reason: 'lagi' })
        .expect(409);
      const log = await db.query.auditLogs.findMany();
      expect(
        log.some(
          (l) => l.action === 'transaction.confirm_manual' && l.target === t.id,
        ),
      ).toBe(true);
    });
  });

  describe('halaman checkout publik', () => {
    it('menampilkan QR selama PENDING, dan menyembunyikannya setelah lunas', async () => {
      const t = await createTx({ amount: 16000, merchant_ref: 'CHECKOUT' });
      const page = await http().get(`/public/checkout/${t.id}`).expect(200);
      expect(page.body).toMatchObject({
        project_name: 'KursusKu',
        merchant_name: 'TOKO CONTOH',
        status: 'PENDING',
        qris_payload: t.qris_payload,
      });
      const png = await http()
        .get(`/public/checkout/${t.id}/qr.png`)
        .expect(200);
      expect(png.headers['content-type']).toContain('image/png');

      await deviceCall('post', '/device/events', {
        events: [danaPaid(t.final_amount)],
      }).expect(200);
      const after = await http().get(`/public/checkout/${t.id}`).expect(200);
      expect(after.body).toMatchObject({ status: 'PAID', qris_payload: null });
      await http().get(`/public/checkout/${t.id}/qr.png`).expect(410);
    });

    it('404 untuk ID yang tidak ada', () =>
      http().get('/public/checkout/01HTIDAKADA').expect(404));
  });

  describe('endpoint dashboard', () => {
    it('ringkasan berisi angka nyata dari database', async () => {
      const res = await admin('get', '/admin/dashboard').expect(200);
      const d = res.body as {
        summary: Record<
          string,
          {
            income: number;
            paid: number;
            created: number;
            created_paid: number;
          }
        >;
        pending: { total: number };
        status_counts: { status: string; count: number }[];
        recent_payments: { id: string; amount: number; project_name: string }[];
        monthly_revenue: { month: string; label: string; amount: number }[];
        listener: {
          listener_online: boolean;
          devices: { battery: number | null }[];
        };
        unparsed_events: number;
      };
      const paidRows = await db.query.transactions.findMany({
        where: inArray(transactions.status, ['PAID', 'LATE_PAID']),
      });
      const income = paidRows.reduce((s, t) => s + t.finalAmount, 0);
      expect(d.summary.day.paid).toBe(paidRows.length);
      expect(d.summary.day.income).toBe(income);
      expect(d.summary.month.income).toBe(income);
      expect(d.summary.week.created).toBeGreaterThanOrEqual(
        d.summary.week.created_paid,
      );
      expect(d.pending.total).toBe(
        (
          await db.query.transactions.findMany({
            where: eq(transactions.status, 'PENDING'),
          })
        ).length,
      );
      expect(d.status_counts.map((s) => s.status)).toEqual([
        'PENDING',
        'PAID',
        'EXPIRED',
        'LATE_PAID',
      ]);
      expect(d.recent_payments.length).toBeGreaterThan(0);
      expect(d.recent_payments[0].project_name).toBe('KursusKu');
      expect(d.monthly_revenue).toHaveLength(12);
      expect(d.monthly_revenue.at(-1)!.amount).toBe(income);
      expect(d.listener.listener_online).toBe(true);
      expect(d.unparsed_events).toBeGreaterThanOrEqual(1);
    });

    it('daftar transaksi bisa difilter, dicari, dan dibagi halaman', async () => {
      const all = await admin('get', '/admin/transactions?per_page=5').expect(
        200,
      );
      const body = all.body as {
        items: { status: string }[];
        total: number;
        counts: Record<string, number>;
        sums: Record<string, number>;
      };
      expect(body.items).toHaveLength(5);
      expect(body.total).toBe(body.counts.ALL);

      const paid = await admin(
        'get',
        '/admin/transactions?status=PAID&per_page=100',
      ).expect(200);
      const paidBody = paid.body as {
        items: { status: string }[];
        total: number;
      };
      expect(paidBody.items.every((t) => t.status === 'PAID')).toBe(true);
      expect(paidBody.total).toBe(body.counts.PAID);

      const byRef = await admin(
        'get',
        '/admin/transactions?q=order-pay',
      ).expect(200);
      expect(
        (byRef.body as { items: { merchant_ref: string }[] }).items.map(
          (t) => t.merchant_ref,
        ),
      ).toEqual(['ORDER-PAY']);

      const t = await createTx({ amount: 31000, merchant_ref: 'CARI-NOMINAL' });
      const byAmount = await admin(
        'get',
        `/admin/transactions?q=${t.final_amount.toLocaleString('id-ID')}`,
      ).expect(200);
      expect(
        (byAmount.body as { items: { id: string }[] }).items.map((x) => x.id),
      ).toContain(t.id);

      const page2 = await admin(
        'get',
        '/admin/transactions?per_page=5&page=2',
      ).expect(200);
      expect((page2.body as { page: number }).page).toBe(2);

      await admin('get', '/admin/transactions?status=SALAH').expect(400);
      await http().get('/admin/transactions').expect(401);
    });

    it('tombol transaksi uji membuat tagihan untuk proyek pertama', async () => {
      const res = await admin('post', '/admin/transactions/test')
        .send({ amount: 1000 })
        .expect(201);
      const t = res.body as {
        id: string;
        status: string;
        merchant_ref: string;
        final_amount: number;
        metadata: Record<string, unknown>;
      };
      expect(t).toMatchObject({ status: 'PENDING', metadata: { test: true } });
      expect(t.merchant_ref).toMatch(/^TEST-\d+$/);
      expect(t.final_amount).toBeGreaterThan(1000);
      await http().get(`/public/checkout/${t.id}`).expect(200);
      await admin('post', '/admin/transactions/test')
        .send({ amount: 0 })
        .expect(400);
    });
  });

  describe('halaman pengelolaan dashboard', () => {
    it('daftar API key hanya menampilkan prefix, dan key yang dicabut tidak bisa dipakai', async () => {
      const created = await admin(
        'post',
        `/admin/projects/${projectId}/api-keys`,
      ).expect(201);
      const k = created.body as { id: string; api_key: string; prefix: string };
      const list = await admin(
        'get',
        `/admin/projects/${projectId}/api-keys`,
      ).expect(200);
      const rows = list.body as Record<string, unknown>[];
      expect(rows.length).toBeGreaterThanOrEqual(2);
      expect(JSON.stringify(rows)).not.toContain(k.api_key);
      expect(rows.find((r) => r.id === k.id)).toMatchObject({
        prefix: k.prefix,
        revoked_at: null,
      });
      await admin('post', `/admin/api-keys/${k.id}/revoke`).expect(204);
      await api('get', '/v1/status', k.api_key).expect(401);
      const after = await admin('get', `/admin/projects/${projectId}/api-keys`);
      expect(
        (after.body as { id: string; revoked_at: string | null }[]).find(
          (r) => r.id === k.id,
        )?.revoked_at,
      ).toEqual(expect.any(String));
      await admin('get', '/admin/projects/prj_tidakada/api-keys').expect(404);
    });

    it('daftar device memakai snake_case dan tidak membocorkan secret', async () => {
      const res = await admin('get', '/admin/devices').expect(200);
      const body = res.body as {
        status: { listener_online: boolean };
        devices: Record<string, unknown>[];
      };
      const d = body.devices.find((x) => x.id === device.id)!;
      expect(d).toMatchObject({ id: device.id, revoked_at: null });
      expect(d).toHaveProperty('last_heartbeat_at');
      expect(d).toHaveProperty('pending_commands');
      expect(JSON.stringify(body)).not.toMatch(/secret/i);
    });

    it('parser bisa dibuat, diuji, diubah, dan pola rusak ditolak', async () => {
      await admin('post', '/admin/parsers').send({ pattern: '([' }).expect(400);
      await admin('post', '/admin/parsers')
        .send({ pattern: 'Rp\\s?[\\d.]+' })
        .expect(400);

      const uji = await admin('post', '/admin/parsers/test')
        .send({
          pattern: 'masuk\\s+Rp\\s?([\\d.]+)',
          text: 'Dana masuk Rp 12.345 dari QRIS',
        })
        .expect(200);
      expect(uji.body).toMatchObject({ matched: true, amount: 12345 });

      const created = await admin('post', '/admin/parsers')
        .send({
          package_name: 'test.bank.baru',
          pattern: 'masuk\\s+Rp\\s?([\\d.]+)',
          priority: 5,
          auto_match: false,
        })
        .expect(201);
      const p = created.body as { id: string };
      expect(created.body).toMatchObject({
        package_name: 'test.bank.baru',
        auto_match: false,
        is_active: true,
      });

      const viaAll = await admin('post', '/admin/parsers/test')
        .send({ package_name: 'test.bank.baru', text: 'Dana masuk Rp 9.000' })
        .expect(200);
      expect(viaAll.body).toMatchObject({
        matched: true,
        amount: 9000,
        parser_id: p.id,
        auto_match: false,
      });

      await admin('patch', `/admin/parsers/${p.id}`)
        .send({ is_active: false })
        .expect(200);
      const list = await admin('get', '/admin/parsers').expect(200);
      expect(
        (list.body as { id: string; is_active: boolean }[]).find(
          (r) => r.id === p.id,
        )?.is_active,
      ).toBe(false);
      await admin('patch', '/admin/parsers/psr_tidakada')
        .send({ priority: 1 })
        .expect(404);
    });

    it('log webhook dan mutasi masuk bisa difilter dan dibagi halaman', async () => {
      const hooks = await admin(
        'get',
        '/admin/webhook-deliveries?per_page=2',
      ).expect(200);
      const h = hooks.body as {
        items: { id: string; project_name: string; status: string }[];
        total: number;
        per_page: number;
        counts: Record<string, number>;
      };
      expect(h.per_page).toBe(2);
      expect(h.items.length).toBeLessThanOrEqual(2);
      expect(h.total).toBe(h.counts.ALL);
      expect(h.items[0]).toHaveProperty('project_name');
      const delivered = await admin(
        'get',
        '/admin/webhook-deliveries?status=DELIVERED',
      ).expect(200);
      expect(
        (delivered.body as { items: { status: string }[] }).items.every(
          (i) => i.status === 'DELIVERED',
        ),
      ).toBe(true);
      await admin('get', '/admin/webhook-deliveries?status=SALAH').expect(400);
      await admin(
        'post',
        '/admin/webhook-deliveries/whd_tidakada/retry',
      ).expect(404);

      const ev = await admin(
        'get',
        '/admin/payment-events?match_status=MATCHED',
      ).expect(200);
      const e = ev.body as {
        items: { match_status: string; merchant_ref: string | null }[];
        counts: Record<string, number>;
      };
      expect(e.items.length).toBeGreaterThan(0);
      expect(e.items.every((i) => i.match_status === 'MATCHED')).toBe(true);
      expect(e.items.every((i) => i.merchant_ref)).toBe(true);
      expect(e.counts.ALL).toBeGreaterThanOrEqual(e.items.length);
      const unparsed = await admin(
        'get',
        '/admin/payment-events?parse_status=UNPARSED',
      ).expect(200);
      expect((unparsed.body as { total: number }).total).toBe(
        (unparsed.body as { counts: { UNPARSED: number } }).counts.UNPARSED,
      );
    });
  });

  it('memproses ulang event setelah package QRIS diperbaiki', async () => {
    const t = await createTx({ amount: 17000, merchant_ref: 'REPROSES' });
    // Package belum didaftarkan: notifikasi disimpan tapi diabaikan.
    await deviceCall('post', '/device/events', {
      events: [
        notif(
          'test.dana.versi.baru',
          'Pembayaran Masuk',
          `Rp${t.final_amount.toLocaleString('id-ID')} diterima DANA Bisnis.`,
        ),
      ],
    }).expect(200);
    expect(await statusOf(t.id)).toBe('PENDING');
    await admin('patch', `/admin/qris-sources/${danaId}`)
      .send({ source_package: 'test.dana.versi.baru' })
      .expect(200);
    const r = await admin('post', '/admin/events/reprocess').expect(200);
    expect((r.body as { matched: number }).matched).toBeGreaterThanOrEqual(1);
    expect(await statusOf(t.id)).toBe('PAID');
    await admin('patch', `/admin/qris-sources/${danaId}`)
      .send({ source_package: DANA_PKG })
      .expect(200);
  });
});
