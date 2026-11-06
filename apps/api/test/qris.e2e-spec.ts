import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { crc16Ccitt, parseQris } from '../src/qris/core';
import { buildStaticQris } from '../src/qris/core/fixtures';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/setup';
import { E2E_STATIC_QRIS as STATIC } from './setup-env';

describe('QRIS tools (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health', () =>
    request(app.getHttpServer()).get('/health').expect(200, { status: 'ok' }));

  describe('POST /v1/qris/inspect', () => {
    it('mengembalikan isi QRIS yang valid', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/qris/inspect')
        .send({ payload: STATIC })
        .expect(200);
      expect(res.body).toMatchObject({
        valid: true,
        error: null,
        info: {
          merchantName: 'TOKO CONTOH',
          nmid: 'ID1020000000001',
          pointOfInitiation: 'static',
          hasTipPrompt: true,
        },
      });
    });

    it('melaporkan CRC salah tanpa error server', async () => {
      const broken = STATIC.slice(0, -4) + '0000';
      const res = await request(app.getHttpServer())
        .post('/v1/qris/inspect')
        .send({ payload: broken })
        .expect(200);
      expect(res.body).toMatchObject({
        valid: false,
        info: null,
        error: { code: 'CRC_MISMATCH' },
      });
    });

    it('menolak body tanpa payload', () =>
      request(app.getHttpServer())
        .post('/v1/qris/inspect')
        .send({})
        .expect(400));
  });

  describe('POST /v1/qris/dynamic', () => {
    it('membuat QRIS dinamis dari QRIS statis yang disetel', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/qris/dynamic')
        .send({ amount: 50087 })
        .expect(200);
      const body = res.body as {
        payload: string;
        amount: number;
        merchantName: string;
        svg: string;
      };
      expect(body.amount).toBe(50087);
      expect(body.merchantName).toBe('TOKO CONTOH');
      expect(body.svg).toContain('<svg');
      const { info } = parseQris(body.payload);
      expect(info).toMatchObject({
        pointOfInitiation: 'dynamic',
        amount: 50087,
        hasTipPrompt: false,
      });
      expect(body.payload.slice(-4)).toBe(
        crc16Ccitt(body.payload.slice(0, -4)),
      );
    });

    it('bisa memakai payload dari request', async () => {
      const other = buildStaticQris();
      const res = await request(app.getHttpServer())
        .post('/v1/qris/dynamic')
        .send({ amount: 1000, payload: other })
        .expect(200);
      expect(
        parseQris((res.body as { payload: string }).payload).info.amount,
      ).toBe(1000);
    });

    it('menolak nominal pecahan', () =>
      request(app.getHttpServer())
        .post('/v1/qris/dynamic')
        .send({ amount: 10.5 })
        .expect(400));

    it('menolak nominal di atas batas dengan kode INVALID_AMOUNT', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/qris/dynamic')
        .send({ amount: 10_000_001 })
        .expect(422);
      expect(res.body).toMatchObject({ code: 'INVALID_AMOUNT' });
    });

    it('menolak sumber yang sudah dinamis', async () => {
      const first = await request(app.getHttpServer())
        .post('/v1/qris/dynamic')
        .send({ amount: 1000 });
      const res = await request(app.getHttpServer())
        .post('/v1/qris/dynamic')
        .send({
          amount: 2000,
          payload: (first.body as { payload: string }).payload,
        })
        .expect(422);
      expect(res.body).toMatchObject({ code: 'NOT_STATIC' });
    });

    it('menolak field yang tidak dikenal', () =>
      request(app.getHttpServer())
        .post('/v1/qris/dynamic')
        .send({ amount: 1000, foo: 'bar' })
        .expect(400));
  });

  it('GET /v1/qris/dynamic.png mengembalikan gambar PNG', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/qris/dynamic.png?amount=50087')
      .expect(200);
    expect(res.headers['content-type']).toContain('image/png');
    expect((res.body as Buffer).subarray(1, 4).toString()).toBe('PNG');
  });
});
