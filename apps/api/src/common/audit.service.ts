import { Inject, Injectable } from '@nestjs/common';
import { DB, type DbOrTx } from '../db/db.module';
import { auditLogs } from '../db/schema';
import { newId } from './ids';
import { currentActor } from './request-context';

/** Jejak setiap aksi owner/admin yang mengubah data. Pelaku diambil dari konteks request. */
@Injectable()
export class AuditService {
  constructor(@Inject(DB) private readonly db: DbOrTx) {}

  async log(
    action: string,
    target: string | null,
    detail: Record<string, unknown> = {},
    actor = currentActor(),
    tx: DbOrTx = this.db,
  ): Promise<void> {
    await tx
      .insert(auditLogs)
      .values({ id: newId.audit(), actor, action, target, detail });
  }
}
