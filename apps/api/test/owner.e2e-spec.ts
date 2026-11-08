import { INestApplication } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { createServer, type Server } from 'node:http';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AlertsService } from '../src/alerts/alerts.service';
import { NotifierService } from '../src/alerts/notifier.service';
import { hashPassword } from '../src/auth/auth.service';
import { hotp, totpStep } from '../src/auth/totp';
import { TransactionEvents } from '../src/common/events.service';
import { DB, type Db } from '../src/db/db.module';
import {
  auditLogs,
  backupRuns,
  devices,
  notifications,
  projects,
  qrisSources,
  transactions,
  users,
} from '../src/db/schema';
import { createTestApp, resetDb } from './helpers';
import {
  E2E_ADMIN_TOKEN,
  E2E_STATIC_QRIS,
  E2E_TELEGRAM_PORT,
} from './setup-env';

const EMAIL = 'owner@contoh.id';
const PASSWORD = 'password-owner-yang-panjang';
const BOT_TOKEN = '123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw0';

describe('Owner, 2FA, dan notifikasi (e2e)', () => {
  let app: INestApplication<App>;
  let db: Db;
  let telegram: Server;
  const sent: { path: string; body: { chat_id: string; text: string } }[] = [];
  let telegramStatus = 200;

  const http = () => request(app.getHttpServer());
  const as = (token: string, method: 'get' | 'post' | 'put', path: string) =>
    http()[method](path).set('Authorization', `Bearer ${token}`);
  const login = (password = PASSWORD) =>
    http().post('/auth/login').send({ email: EMAIL, password });

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get<Db>(DB);
    await resetDb(app);
    await db.insert(users).values({
      id: 'usr_test',
      email: EMAIL,
      passwordHash: await hashPassword(PASSWORD),
    });
    telegram = createServer((req, res) => {
      let raw = '';
      req.on('data', (c: Buffer) => (raw += c.toString()));
      req.on('end', () => {
        sent.push({
          path: req.url ?? '',
          body: JSON.parse(raw || '{}') as { chat_id: string; text: string },
        });
        res.writeHead(telegramStatus, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify(
            telegramStatus === 200
              ? { ok: true }
              : { ok: false, description: 'Bad Request: chat not found' },
          ),
        );
      });
    });
    await new Promise<void>((r) =>
      telegram.listen(E2E_TELEGRAM_PORT, '127.0.0.1', r),
    );
  });

  afterAll(async () => {
    await app.close();
    await new Promise((r) => telegram.close(r));
  });

  describe('login owner', () => {
    it('menolak password salah dengan pesan yang sama seperti email tak dikenal', async () => {
      const a = await login('salah-salah-salah').expect(401);
      const b = await http()
        .post('/auth/login')
        .send({ email: 'x@contoh.id', password: PASSWORD })
        .expect(401);
      expect((a.body as { message: string }).message).toBe(
        (b.body as { message: string }).message,
      );
    });

    it('sesi owner bisa membuka rute admin; tanpa sesi ditolak', async () => {
      const r = await login().expect(200);
      expect(r.body).toMatchObject({
        status: 'ok',
        token: expect.stringMatching(/^qms_/) as unknown,
      });
      const token = (r.body as { token: string }).token;
      await as(token, 'get', '/admin/projects').expect(200);
      await http().get('/admin/projects').expect(401);
      await as('qms_palsu', 'get', '/admin/projects').expect(401);
      const me = await as(token, 'get', '/admin/account').expect(200);
      expect(me.body).toMatchObject({ email: EMAIL, totp_enabled: false });
      // ADMIN_TOKEN tetap untuk otomasi, tapi bukan untuk rute akun.
      await as(E2E_ADMIN_TOKEN, 'get', '/admin/projects').expect(200);
      await as(E2E_ADMIN_TOKEN, 'get', '/admin/account').expect(403);
    });

    it('audit log mencatat email owner sebagai pelaku', async () => {
      const token = ((await login()).body as { token: string }).token;
      await as(token, 'post', '/admin/projects')
        .send({ name: 'Proyek Audit' })
        .expect(201);
      const [log] = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.action, 'project.created'))
        .orderBy(desc(auditLogs.createdAt))
        .limit(1);
      expect(log.actor).toBe(EMAIL);
    });

    it('logout mencabut sesi', async () => {
      const token = ((await login()).body as { token: string }).token;
      await as(token, 'post', '/admin/account/logout').expect(204);
      await as(token, 'get', '/admin/projects').expect(401);
    });

    it('ganti password mengeluarkan sesi lain', async () => {
      const a = ((await login()).body as { token: string }).token;
      const b = ((await login()).body as { token: string }).token;
      await as(a, 'post', '/admin/account/password')
        .send({
          current_password: 'salah-salah-salah',
          new_password: 'password-baru-panjang',
        })
        .expect(400);
      await as(a, 'post', '/admin/account/password')
        .send({ current_password: PASSWORD, new_password: 'pendek' })
        .expect(400);
      await as(a, 'post', '/admin/account/password')
        .send({
          current_password: PASSWORD,
          new_password: 'password-baru-panjang',
        })
        .expect(204);
      await as(a, 'get', '/admin/account').expect(200);
      await as(b, 'get', '/admin/account').expect(401);
      await login().expect(401);
      await as(a, 'post', '/admin/account/password')
        .send({
          current_password: 'password-baru-panjang',
          new_password: PASSWORD,
        })
        .expect(204);
    });
  });

  describe('2FA (TOTP)', () => {
    let token: string;
    let secret: string;

    it('aktif setelah kode pertama benar', async () => {
      token = ((await login()).body as { token: string }).token;
      const other = ((await login()).body as { token: string }).token;
      await as(token, 'post', '/admin/account/totp/enable')
        .send({ code: '123456' })
        .expect(400);
      const setup = await as(token, 'post', '/admin/account/totp/setup').expect(
        200,
      );
      secret = (setup.body as { secret: string }).secret;
      expect((setup.body as { otpauth_uri: string }).otpauth_uri).toContain(
        'otpauth://totp/qrismuz',
      );
      await as(token, 'post', '/admin/account/totp/enable')
        .send({ code: '000000' })
        .expect(400);
      await as(token, 'post', '/admin/account/totp/enable')
        .send({ code: hotp(secret, totpStep()) })
        .expect(204);
      const me = await as(token, 'get', '/admin/account').expect(200);
      expect((me.body as { totp_enabled: boolean }).totp_enabled).toBe(true);
      // Sesi lain dibuat sebelum 2FA aktif: dikeluarkan.
      await as(other, 'get', '/admin/account').expect(401);
    });

    it('login butuh kode 2FA; kode yang sama tidak bisa dipakai dua kali', async () => {
      const first = await login().expect(200);
      expect(first.body).toMatchObject({ status: 'totp_required' });
      const challenge = (first.body as { challenge: string }).challenge;
      await http()
        .post('/auth/login/totp')
        .send({ challenge, code: '000000' })
        .expect(401);
      await http()
        .post('/auth/login/totp')
        .send({ challenge: 'rusak', code: '000000' })
        .expect(401);
      // Kode langkah berikutnya: langkah sekarang sudah dipakai saat mengaktifkan 2FA.
      const code = hotp(secret, totpStep() + 1);
      const ok = await http()
        .post('/auth/login/totp')
        .send({ challenge, code })
        .expect(200);
      expect(ok.body).toMatchObject({
        status: 'ok',
        token: expect.stringMatching(/^qms_/) as unknown,
      });
      await http()
        .post('/auth/login/totp')
        .send({ challenge, code })
        .expect(401);
    });

    it('mematikan 2FA butuh password dan kode', async () => {
      await as(token, 'post', '/admin/account/totp/disable')
        .send({ password: PASSWORD, code: '000000' })
        .expect(400);
      // Langkah sekarang dan +1 sudah terpakai; tunggu tidak mungkin di test, jadi pakai DB.
      await db
        .update(users)
        .set({ totpLastStep: null })
        .where(eq(users.email, EMAIL));
      await as(token, 'post', '/admin/account/totp/disable')
        .send({ password: PASSWORD, code: hotp(secret, totpStep()) })
        .expect(204);
      expect((await login().expect(200)).body).toMatchObject({ status: 'ok' });
    });
  });

  it('akun dikunci 15 menit setelah 5 kali salah, walau password benar', async () => {
    for (let i = 0; i < 5; i++) await login('salah-salah-salah').expect(401);
    const r = await login().expect(429);
    expect((r.body as { message: string }).message).toMatch(
      /Coba lagi dalam 15 menit/,
    );
    await db
      .update(users)
      .set({ lockedUntil: null, failedLogins: 0 })
      .where(eq(users.email, EMAIL));
  });

  describe('notifikasi Telegram', () => {
    let token: string;
    const notifier = () => app.get(NotifierService);
    const alerts = () => app.get(AlertsService);
    const flush = async () => {
      await notifier().dispatchDue();
      return sent.splice(0);
    };

    beforeAll(async () => {
      token = ((await login()).body as { token: string }).token;
      await db.delete(notifications);
      sent.splice(0);
    });

    it('token tidak pernah dikembalikan; menyalakan tanpa token ditolak', async () => {
      await as(token, 'put', '/admin/settings/telegram')
        .send({ enabled: true })
        .expect(400);
      await as(token, 'put', '/admin/settings/telegram')
        .send({ bot_token: 'bukan-token' })
        .expect(400);
      const r = await as(token, 'put', '/admin/settings/telegram')
        .send({
          bot_token: BOT_TOKEN,
          chat_id: '987654321',
          enabled: true,
          categories: { app_version: false, palsu: true },
        })
        .expect(200);
      expect(r.body).toMatchObject({
        enabled: true,
        configured: true,
        bot_token_hint: '…saw0',
        chat_id: '987654321',
      });
      expect(JSON.stringify(r.body)).not.toContain(BOT_TOKEN);
      expect(
        (r.body as { categories: Record<string, boolean> }).categories,
      ).toMatchObject({ app_version: false, payment: true });
      expect(
        (r.body as { categories: Record<string, boolean> }).categories,
      ).not.toHaveProperty('palsu');
    });

    it('pesan uji langsung terkirim, dan error Telegram diteruskan ke owner', async () => {
      await as(token, 'post', '/admin/settings/telegram/test').expect(204);
      expect(sent.splice(0)).toEqual([
        expect.objectContaining({
          path: `/bot${BOT_TOKEN}/sendMessage`,
          body: expect.objectContaining({ chat_id: '987654321' }) as unknown,
        }),
      ]);
      telegramStatus = 400;
      const r = await as(token, 'post', '/admin/settings/telegram/test').expect(
        400,
      );
      expect((r.body as { message: string }).message).toContain(
        'chat not found',
      );
      telegramStatus = 200;
    });

    it('pembayaran lunas dikirim ke Telegram; kegagalan dicoba ulang', async () => {
      const [q] = await db
        .insert(qrisSources)
        .values({
          id: 'qrs_t',
          label: 'DANA',
          rawPayload: E2E_STATIC_QRIS,
          merchantName: 'TOKO',
          sourcePackage: 'pkg',
        })
        .returning();
      const [p] = await db
        .insert(projects)
        .values({ id: 'prj_t', name: 'KursusKu', webhookSecretEnc: 'x' })
        .returning();
      const now = new Date();
      await db.insert(transactions).values({
        id: 'TXTEST',
        projectId: p.id,
        qrisSourceId: q.id,
        merchantRef: 'ORDER-77',
        baseAmount: 50000,
        uniqueCode: 87,
        finalAmount: 50087,
        status: 'PAID',
        qrisPayload: 'x',
        expiresAt: now,
        codeLockedUntil: now,
        paidAt: now,
      });
      telegramStatus = 500;
      app
        .get(TransactionEvents)
        .emit({ transactionId: 'TXTEST', status: 'PAID' });
      await new Promise((r) => setTimeout(r, 100));
      await flush();
      const [n] = await db
        .select()
        .from(notifications)
        .where(eq(notifications.category, 'payment'));
      expect(n).toMatchObject({ status: 'PENDING', attempt: 1 });
      telegramStatus = 200;
      await db
        .update(notifications)
        .set({ nextRetryAt: new Date() })
        .where(eq(notifications.id, n.id));
      const msgs = await flush();
      expect(msgs[0].body.text).toContain('Rp50.087');
      expect(msgs[0].body.text).toContain('ORDER-77');
      const [after] = await db
        .select()
        .from(notifications)
        .where(eq(notifications.id, n.id));
      expect(after.status).toBe('SENT');
    });

    it('listener offline memicu satu alarm, lalu satu kabar saat kembali online', async () => {
      const old = new Date(Date.now() - 10 * 60_000);
      await db.insert(devices).values({
        id: 'dev_t',
        name: 'Redmi Note 7',
        secretEnc: 'x',
        lastHeartbeatAt: old,
        listenerOk: true,
        createdAt: old,
      });
      await alerts().checkListeners();
      await alerts().checkListeners();
      let msgs = await flush();
      expect(msgs).toHaveLength(1);
      expect(msgs[0].body.text).toContain('Listener offline');
      await db
        .update(devices)
        .set({ lastHeartbeatAt: new Date() })
        .where(eq(devices.id, 'dev_t'));
      await alerts().checkListeners();
      msgs = await flush();
      expect(msgs.map((m) => m.body.text)).toEqual([
        expect.stringContaining('kembali online'),
      ]);
    });

    it('backup gagal dan backup terlambat memicu alarm', async () => {
      await alerts().checkBackups();
      expect(await flush()).toHaveLength(0); // belum pernah backup: belum dipantau
      await db.insert(backupRuns).values({
        id: 'bk1',
        kind: 'backup',
        ok: false,
        detail: 'rclone: token kedaluwarsa',
        finishedAt: new Date(),
      });
      await alerts().checkBackups();
      await alerts().checkBackups();
      const texts = (await flush()).map((m) => m.body.text);
      expect(texts).toEqual([
        expect.stringContaining('rclone: token kedaluwarsa'),
        expect.stringContaining('Belum ada backup yang sukses'),
      ]);
      const list = await as(token, 'get', '/admin/backups').expect(200);
      expect(list.body).toMatchObject({
        last_ok_at: null,
        runs: [expect.objectContaining({ id: 'bk1', ok: false })],
      });
    });

    it('kategori yang dimatikan tidak dikirim; log notifikasi tersedia', async () => {
      await app.get(NotifierService).notify('app_version', 'versi berubah');
      expect(await flush()).toHaveLength(0);
      const log = await as(token, 'get', '/admin/notifications').expect(200);
      expect((log.body as { total: number }).total).toBeGreaterThanOrEqual(4);
    });
  });
});

describe('Rate limiting (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp({
      RATE_LIMIT_ENABLED: 'true',
      RATE_LIMIT_PER_MIN: '5',
    });
  });
  afterAll(() => app.close());

  it('login dibatasi per IP', async () => {
    const codes: number[] = [];
    for (let i = 0; i < 11; i++) {
      const r = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'x@contoh.id', password: 'salah-salah-salah' });
      codes.push(r.status);
    }
    expect(codes.slice(0, 10).every((c) => c === 401)).toBe(true);
    expect(codes[10]).toBe(429);
  });

  it('endpoint publik memakai batas umum; device dan health tidak dibatasi', async () => {
    const codes: number[] = [];
    for (let i = 0; i < 6; i++)
      codes.push(
        (await request(app.getHttpServer()).get('/public/checkout/TIDAKADA'))
          .status,
      );
    expect(codes.slice(0, 5)).toEqual([404, 404, 404, 404, 404]);
    expect(codes[5]).toBe(429);
    for (let i = 0; i < 8; i++)
      await request(app.getHttpServer()).get('/health').expect(200);
  });
});
