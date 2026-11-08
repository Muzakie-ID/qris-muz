import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createTestApp, resetDb } from './helpers';
import { E2E_ADMIN_TOKEN, E2E_STATIC_QRIS } from './setup-env';

describe('Rentang kode unik per proyek (e2e)', () => {
  let app: INestApplication<App>;
  let projectId: string;
  let apiKey: string;

  const admin = (method: 'post' | 'patch', path: string) =>
    request(app.getHttpServer())
      [method](path)
      .set('Authorization', `Bearer ${E2E_ADMIN_TOKEN}`);
  const createTx = (amount: number, ref: string) =>
    request(app.getHttpServer())
      .post('/v1/transactions')
      .set('Authorization', `Bearer ${apiKey}`)
      .send({ amount, merchant_ref: ref });

  beforeAll(async () => {
    app = await createTestApp();
    await resetDb(app);
    await admin('post', '/admin/qris-sources')
      .send({
        label: 'DANA',
        payload: E2E_STATIC_QRIS,
        source_package: 'pkg.rentang',
      })
      .expect(201);
  });
  afterAll(() => app.close());

  it('menolak rentang yang tidak valid', async () => {
    for (const body of [
      { unique_code_min: 600, unique_code_max: 500 },
      { unique_code_min: 500, unique_code_max: 505 },
      { unique_code_min: 0, unique_code_max: 999 },
      { unique_code_min: 1, unique_code_max: 100_000 },
    ]) {
      await admin('post', '/admin/projects')
        .send({ name: 'Salah', ...body })
        .expect(400);
    }
  });

  it('proyek baru memakai rentang bawaan 1–999', async () => {
    const r = await admin('post', '/admin/projects')
      .send({ name: 'Bawaan' })
      .expect(201);
    expect(r.body).toMatchObject({ unique_code_min: 1, unique_code_max: 999 });
  });

  it('kode unik tagihan selalu di dalam rentang proyek', async () => {
    const r = await admin('post', '/admin/projects')
      .send({ name: 'Rentang', unique_code_min: 500, unique_code_max: 1999 })
      .expect(201);
    projectId = (r.body as { id: string }).id;
    expect(r.body).toMatchObject({
      unique_code_min: 500,
      unique_code_max: 1999,
    });
    apiKey = (
      (await admin('post', `/admin/projects/${projectId}/api-keys`).expect(201))
        .body as { api_key: string }
    ).api_key;

    const codes = new Set<number>();
    for (let i = 0; i < 30; i++) {
      const t = (await createTx(20000, `R-${i}`).expect(201)).body as {
        unique_code: number;
        final_amount: number;
      };
      expect(t.unique_code).toBeGreaterThanOrEqual(500);
      expect(t.unique_code).toBeLessThanOrEqual(1999);
      expect(t.final_amount).toBe(20000 + t.unique_code);
      codes.add(t.unique_code);
    }
    expect(codes.size).toBe(30); // tidak ada yang kembar
  });

  it('rentang bisa diubah, dan menolak bila rentang habis', async () => {
    await admin('patch', `/admin/projects/${projectId}`)
      .send({ unique_code_max: 400 })
      .expect(400); // max < min lama
    const r = await admin('patch', `/admin/projects/${projectId}`)
      .send({ unique_code_min: 10, unique_code_max: 19 })
      .expect(200);
    expect(r.body).toMatchObject({ unique_code_min: 10, unique_code_max: 19 });
    for (let i = 0; i < 10; i++) {
      const t = (await createTx(7000, `S-${i}`).expect(201)).body as {
        unique_code: number;
      };
      expect(t.unique_code).toBeGreaterThanOrEqual(10);
      expect(t.unique_code).toBeLessThanOrEqual(19);
    }
    const full = await createTx(7000, 'S-penuh').expect(409);
    expect((full.body as { message: string }).message).toContain('10–19');
  });

  it('batas nominal memperhitungkan kode unik terbesar', async () => {
    await admin('patch', `/admin/projects/${projectId}`)
      .send({ unique_code_min: 1, unique_code_max: 99_999 })
      .expect(200);
    const r = await createTx(9_950_000, 'BESAR').expect(400);
    expect((r.body as { message: string }).message).toContain('99999');
  });
});
