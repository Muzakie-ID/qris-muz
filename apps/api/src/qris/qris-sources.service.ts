import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, isNotNull } from 'drizzle-orm';
import { newId } from '../common/ids';
import { DB, type Db } from '../db/db.module';
import { qrisSources } from '../db/schema';
import { QrisError, parseQris } from './core';

export type QrisSource = typeof qrisSources.$inferSelect;

function isUniqueViolation(e: unknown): boolean {
  const err = e as { code?: string; cause?: { code?: string } };
  return err?.code === '23505' || err?.cause?.code === '23505';
}

@Injectable()
export class QrisSourcesService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** Menyimpan QRIS statis milik owner. Payload divalidasi dan harus statis. */
  async create(input: {
    label: string;
    payload: string;
    sourcePackage?: string | null;
  }) {
    const { info } = parseQris(input.payload);
    if (info.pointOfInitiation !== 'static') {
      throw new QrisError(
        'NOT_STATIC',
        'Yang disimpan harus QRIS statis asli dari merchant.',
      );
    }
    try {
      const [row] = await this.db
        .insert(qrisSources)
        .values({
          id: newId.qris(),
          label: input.label,
          rawPayload: input.payload.trim(),
          merchantName: info.merchantName,
          nmid: info.nmid,
          sourcePackage: input.sourcePackage ?? null,
        })
        .returning();
      return row;
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw new ConflictException('Package ini sudah dipakai QRIS lain.');
      }
      throw e;
    }
  }

  async update(
    id: string,
    input: {
      label?: string;
      sourcePackage?: string | null;
      isActive?: boolean;
    },
  ) {
    try {
      const [row] = await this.db
        .update(qrisSources)
        .set({
          ...(input.label !== undefined && { label: input.label }),
          ...(input.sourcePackage !== undefined && {
            sourcePackage: input.sourcePackage,
          }),
          ...(input.isActive !== undefined && { isActive: input.isActive }),
        })
        .where(eq(qrisSources.id, id))
        .returning();
      if (!row) throw new NotFoundException('QRIS tidak ditemukan.');
      return row;
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw new ConflictException('Package ini sudah dipakai QRIS lain.');
      }
      throw e;
    }
  }

  list() {
    return this.db.query.qrisSources.findMany({
      orderBy: (q, { asc }) => [asc(q.createdAt)],
    });
  }

  async get(id: string): Promise<QrisSource> {
    const row = await this.db.query.qrisSources.findFirst({
      where: eq(qrisSources.id, id),
    });
    if (!row) throw new NotFoundException('QRIS tidak ditemukan.');
    return row;
  }

  /** Package Android yang notifikasinya perlu dikirim listener. */
  async activePackages(): Promise<string[]> {
    const rows = await this.db
      .select({ pkg: qrisSources.sourcePackage })
      .from(qrisSources)
      .where(
        and(
          eq(qrisSources.isActive, true),
          isNotNull(qrisSources.sourcePackage),
        ),
      );
    return rows.map((r) => r.pkg).filter((p): p is string => !!p);
  }

  async findByPackage(pkg: string): Promise<QrisSource | undefined> {
    return this.db.query.qrisSources.findFirst({
      where: and(
        eq(qrisSources.sourcePackage, pkg),
        eq(qrisSources.isActive, true),
      ),
    });
  }
}
