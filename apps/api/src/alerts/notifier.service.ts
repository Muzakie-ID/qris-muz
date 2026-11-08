import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, asc, count, desc, eq, inArray, lte } from 'drizzle-orm';
import { newId } from '../common/ids';
import { SecretsService } from '../common/secrets.service';
import type { Env } from '../config/env';
import { DB, type Db } from '../db/db.module';
import { notifications } from '../db/schema';
import { SettingsService } from './settings.service';

/** Jenis notifikasi yang bisa dinyalakan/dimatikan owner. */
export const NOTIFY_CATEGORIES = [
  'payment',
  'late_payment',
  'listener',
  'unparsed',
  'unmatched',
  'app_version',
  'webhook_failed',
  'backup',
  'security',
] as const;
export type NotifyCategory = (typeof NOTIFY_CATEGORIES)[number];

export interface TelegramSettings {
  enabled: boolean;
  bot_token_enc: string | null;
  chat_id: string | null;
  categories: Record<NotifyCategory, boolean>;
}

const DEFAULTS: TelegramSettings = {
  enabled: false,
  bot_token_enc: null,
  chat_id: null,
  categories: Object.fromEntries(
    NOTIFY_CATEGORIES.map((c) => [c, true]),
  ) as Record<NotifyCategory, boolean>,
};

const KEY = 'telegram';
const RETRY_DELAYS_MS = [
  30_000,
  2 * 60_000,
  10 * 60_000,
  30 * 60_000,
  3600_000,
];

/** Escape untuk parse_mode HTML Telegram. */
export function esc(s: string | number | null | undefined): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Notifikasi Telegram ke owner. Pesan dicatat di tabel notifications lalu dikirim oleh tugas
 * berkala dengan percobaan ulang, agar alarm tidak hilang saat Telegram/jaringan bermasalah.
 */
@Injectable()
export class NotifierService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotifierService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly config: ConfigService<Env, true>,
    private readonly settings: SettingsService,
    private readonly secrets: SecretsService,
  ) {}

  onModuleInit() {
    if (this.config.get('JOBS_ENABLED', { infer: true }))
      this.timer = setInterval(() => void this.dispatchDue(), 5_000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async getSettings(): Promise<TelegramSettings> {
    const s = await this.settings.get<Partial<TelegramSettings>>(KEY, {});
    return {
      ...DEFAULTS,
      ...s,
      categories: { ...DEFAULTS.categories, ...(s.categories ?? {}) },
    };
  }

  /** Tampilan untuk dashboard: token tidak pernah dikirim balik, hanya 4 karakter terakhir. */
  async view() {
    const s = await this.getSettings();
    const token = s.bot_token_enc ? this.secrets.open(s.bot_token_enc) : null;
    return {
      enabled: s.enabled,
      configured: !!token && !!s.chat_id,
      bot_token_hint: token ? `…${token.slice(-4)}` : null,
      chat_id: s.chat_id,
      categories: s.categories,
    };
  }

  async update(input: {
    enabled?: boolean;
    bot_token?: string | null;
    chat_id?: string | null;
    categories?: Partial<Record<NotifyCategory, boolean>>;
  }) {
    const s = await this.getSettings();
    if (input.bot_token !== undefined)
      s.bot_token_enc = input.bot_token
        ? this.secrets.seal(input.bot_token.trim())
        : null;
    if (input.chat_id !== undefined) s.chat_id = input.chat_id?.trim() || null;
    if (input.categories)
      for (const c of NOTIFY_CATEGORIES)
        if (typeof input.categories[c] === 'boolean')
          s.categories[c] = input.categories[c];
    if (input.enabled !== undefined) s.enabled = input.enabled;
    if (s.enabled && (!s.bot_token_enc || !s.chat_id))
      throw new BadRequestException(
        'Isi token bot dan chat ID sebelum menyalakan notifikasi.',
      );
    await this.settings.set(KEY, s);
    return this.view();
  }

  /** Memasukkan pesan ke antrian bila Telegram aktif dan kategorinya dinyalakan. */
  async notify(category: NotifyCategory, text: string): Promise<void> {
    try {
      const s = await this.getSettings();
      if (!s.enabled || !s.categories[category]) return;
      await this.db.insert(notifications).values({
        id: newId.notification(),
        category,
        text: text.slice(0, 4000),
      });
    } catch (e) {
      // Notifikasi tidak boleh menggagalkan proses utama (pembayaran, heartbeat).
      this.logger.error(`Gagal mencatat notifikasi: ${(e as Error).message}`);
    }
  }

  /** Kirim pesan uji langsung, tanpa antrian, agar owner langsung tahu salahnya di mana. */
  async sendTest(): Promise<void> {
    const s = await this.getSettings();
    if (!s.bot_token_enc || !s.chat_id)
      throw new BadRequestException('Isi token bot dan chat ID dulu.');
    const err = await this.send(
      s,
      '<b>qrismuz</b>: notifikasi Telegram tersambung. Alarm akan dikirim ke chat ini.',
    );
    if (err) throw new BadRequestException(`Telegram menolak: ${err}`);
  }

  private async send(
    s: TelegramSettings,
    text: string,
  ): Promise<string | null> {
    const base = this.config.get('TELEGRAM_API_URL', { infer: true });
    const token = this.secrets.open(s.bot_token_enc!);
    try {
      const res = await fetch(`${base}/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: s.chat_id,
          text,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) return null;
      const body = (await res.json().catch(() => ({}))) as {
        description?: string;
      };
      return body.description ?? `HTTP ${res.status}`;
    } catch (e) {
      return (e as Error).message;
    }
  }

  async dispatchDue(limit = 20): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try {
      const s = await this.getSettings();
      if (!s.bot_token_enc || !s.chat_id) return 0;
      const due = await this.db.transaction(async (tx) => {
        const rows = await tx
          .select({ id: notifications.id })
          .from(notifications)
          .where(
            and(
              eq(notifications.status, 'PENDING'),
              lte(notifications.nextRetryAt, new Date()),
            ),
          )
          .orderBy(asc(notifications.createdAt))
          .limit(limit)
          .for('update', { skipLocked: true });
        if (!rows.length) return [];
        return tx
          .update(notifications)
          .set({ nextRetryAt: new Date(Date.now() + 2 * 60_000) })
          .where(
            inArray(
              notifications.id,
              rows.map((r) => r.id),
            ),
          )
          .returning();
      });
      for (const n of due) {
        const err = await this.send(s, n.text);
        const attempt = n.attempt + 1;
        if (!err) {
          await this.db
            .update(notifications)
            .set({
              status: 'SENT',
              attempt,
              sentAt: new Date(),
              lastError: null,
            })
            .where(eq(notifications.id, n.id));
          continue;
        }
        const failed = attempt > RETRY_DELAYS_MS.length;
        await this.db
          .update(notifications)
          .set({
            status: failed ? 'FAILED' : 'PENDING',
            attempt,
            lastError: err.slice(0, 500),
            nextRetryAt: new Date(
              Date.now() +
                RETRY_DELAYS_MS[
                  Math.min(attempt - 1, RETRY_DELAYS_MS.length - 1)
                ],
            ),
          })
          .where(eq(notifications.id, n.id));
        if (failed) this.logger.warn(`Notifikasi ${n.id} gagal: ${err}`);
      }
      return due.length;
    } catch (e) {
      this.logger.error(`Gagal mengirim notifikasi: ${(e as Error).message}`);
      return 0;
    } finally {
      this.running = false;
    }
  }

  async list(page: number, perPage: number) {
    const [items, [{ total }]] = await Promise.all([
      this.db.query.notifications.findMany({
        orderBy: [desc(notifications.createdAt)],
        limit: perPage,
        offset: (page - 1) * perPage,
      }),
      this.db.select({ total: count() }).from(notifications),
    ]);
    return {
      items: items.map((n) => ({
        id: n.id,
        category: n.category,
        text: n.text,
        status: n.status,
        attempt: n.attempt,
        last_error: n.lastError,
        sent_at: n.sentAt?.toISOString() ?? null,
        created_at: n.createdAt.toISOString(),
      })),
      total,
      page,
      per_page: perPage,
    };
  }
}
