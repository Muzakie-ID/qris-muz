import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DB, type Db } from '../db/db.module';
import { settings } from '../db/schema';

/** Pengaturan kunci-nilai di database (bisa diubah dari dashboard tanpa restart). */
@Injectable()
export class SettingsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async get<T>(key: string, fallback: T): Promise<T> {
    const row = await this.db.query.settings.findFirst({
      where: eq(settings.key, key),
    });
    return row ? (row.value as T) : fallback;
  }

  async set(key: string, value: unknown): Promise<void> {
    await this.db
      .insert(settings)
      .values({ key, value })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value, updatedAt: new Date() },
      });
  }
}
