import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

const ts = (name: string) =>
  timestamp(name, { withTimezone: true, mode: 'date' });
const createdAt = () => ts('created_at').notNull().defaultNow();
/** Nominal rupiah. bigint agar aman untuk jumlah besar, dibaca sebagai number. */
const rupiah = (name: string) => bigint(name, { mode: 'number' });

/** Perintah jarak jauh yang dimengerti aplikasi listener. */
export const DEVICE_COMMANDS = [
  'rescan',
  'refresh_config',
  'flush_queue',
] as const;
export type DeviceCommand = (typeof DEVICE_COMMANDS)[number];

export const transactionStatus = pgEnum('transaction_status', [
  'PENDING',
  'PAID',
  'EXPIRED',
  'CANCELLED',
  'LATE_PAID',
]);

export const parseStatus = pgEnum('parse_status', [
  'PARSED',
  'UNPARSED',
  'IGNORED',
]);
export const matchStatus = pgEnum('match_status', [
  'PENDING',
  'MATCHED',
  'LATE_MATCHED',
  'UNMATCHED',
  'NOT_APPLICABLE',
]);
export const deliveryStatus = pgEnum('delivery_status', [
  'PENDING',
  'DELIVERED',
  'FAILED',
]);

/** Satu per proyek/web klien yang memakai gateway. */
export const projects = pgTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  webhookUrl: text('webhook_url'),
  /** Disimpan terenkripsi (AES-256-GCM) karena dipakai untuk menandatangani webhook. */
  webhookSecretEnc: text('webhook_secret_enc').notNull(),
  defaultExpiryMin: integer('default_expiry_min').notNull().default(15),
  defaultReturnUrl: text('default_return_url'),
  defaultQrisSourceId: text('default_qris_source_id').references(
    () => qrisSources.id,
  ),
  createdAt: createdAt(),
});

export const apiKeys = pgTable(
  'api_keys',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id),
    /** SHA-256 dari API key; key aslinya hanya ditampilkan sekali saat dibuat. */
    keyHash: text('key_hash').notNull(),
    prefix: text('prefix').notNull(),
    lastUsedAt: ts('last_used_at'),
    revokedAt: ts('revoked_at'),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('api_keys_key_hash_uq').on(t.keyHash)],
);

/** QRIS statis milik owner, satu per aplikasi merchant (DANA Bisnis, GoPay Merchant, ...). */
export const qrisSources = pgTable(
  'qris_sources',
  {
    id: text('id').primaryKey(),
    label: text('label').notNull(),
    rawPayload: text('raw_payload').notNull(),
    merchantName: text('merchant_name').notNull(),
    nmid: text('nmid'),
    /** Package aplikasi Android yang mengirim notifikasi dana masuk untuk QRIS ini. */
    sourcePackage: text('source_package'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('qris_sources_package_uq').on(t.sourcePackage)],
);

export const devices = pgTable('devices', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  /** Secret HMAC device, terenkripsi. */
  secretEnc: text('secret_enc').notNull(),
  lastHeartbeatAt: ts('last_heartbeat_at'),
  listenerOk: boolean('listener_ok'),
  battery: integer('battery'),
  charging: boolean('charging'),
  queued: integer('queued'),
  sourceAppVersions: jsonb('source_app_versions').$type<
    Record<string, string>
  >(),
  clockSkewMs: integer('clock_skew_ms'),
  appVersion: text('app_version'),
  lastCrash: text('last_crash'),
  lastCrashAt: ts('last_crash_at'),
  /** Perintah dari dashboard yang diambil listener lewat heartbeat berikutnya. */
  /** Kapan alarm offline terakhir dikirim; dikosongkan lagi saat device kembali online. */
  offlineAlertedAt: ts('offline_alerted_at'),
  pendingCommands: jsonb('pending_commands')
    .$type<DeviceCommand[]>()
    .notNull()
    .default([]),
  revokedAt: ts('revoked_at'),
  createdAt: createdAt(),
});

export const devicePairingTokens = pgTable('device_pairing_tokens', {
  id: text('id').primaryKey(),
  tokenHash: text('token_hash').notNull().unique(),
  deviceName: text('device_name').notNull(),
  expiresAt: ts('expires_at').notNull(),
  usedAt: ts('used_at'),
  createdAt: createdAt(),
});

/** Nonce request device yang sudah dipakai, untuk menolak replay. Dibersihkan berkala. */
export const deviceNonces = pgTable(
  'device_nonces',
  {
    deviceId: text('device_id')
      .notNull()
      .references(() => devices.id),
    nonce: text('nonce').notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('device_nonces_uq').on(t.deviceId, t.nonce)],
);

export const transactions = pgTable(
  'transactions',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id),
    qrisSourceId: text('qris_source_id')
      .notNull()
      .references(() => qrisSources.id),
    merchantRef: text('merchant_ref').notNull(),
    baseAmount: rupiah('base_amount').notNull(),
    uniqueCode: integer('unique_code').notNull(),
    finalAmount: rupiah('final_amount').notNull(),
    qrisPayload: text('qris_payload').notNull(),
    status: transactionStatus('status').notNull().default('PENDING'),
    idempotencyKey: text('idempotency_key'),
    returnUrl: text('return_url'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    expiresAt: ts('expires_at').notNull(),
    /** Nominal unik tidak boleh dipakai transaksi lain sampai waktu ini (masa tenggang). */
    codeLockedUntil: ts('code_locked_until').notNull(),
    paidAt: ts('paid_at'),
    cancelledAt: ts('cancelled_at'),
    matchedEventId: text('matched_event_id'),
    manualNote: text('manual_note'),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('transactions_pending_amount_uq')
      .on(t.qrisSourceId, t.finalAmount)
      .where(sql`${t.status} = 'PENDING'`),
    uniqueIndex('transactions_idempotency_uq').on(
      t.projectId,
      t.idempotencyKey,
    ),
    index('transactions_lock_idx').on(
      t.qrisSourceId,
      t.finalAmount,
      t.codeLockedUntil,
    ),
    index('transactions_expiry_idx').on(t.status, t.expiresAt),
  ],
);

export const paymentEvents = pgTable(
  'payment_events',
  {
    id: text('id').primaryKey(),
    deviceId: text('device_id').references(() => devices.id),
    packageName: text('package_name').notNull(),
    title: text('title'),
    text: text('text'),
    bigText: text('big_text'),
    subText: text('sub_text'),
    notificationKey: text('notification_key'),
    appVersion: text('app_version'),
    postedAt: ts('posted_at').notNull(),
    capturedAt: ts('captured_at'),
    hash: text('hash').notNull(),
    isTest: boolean('is_test').notNull().default(false),
    parseStatus: parseStatus('parse_status').notNull(),
    parsedAmount: rupiah('parsed_amount'),
    parserId: text('parser_id'),
    qrisSourceId: text('qris_source_id').references(() => qrisSources.id),
    matchStatus: matchStatus('match_status').notNull(),
    transactionId: text('transaction_id').references(() => transactions.id),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('payment_events_hash_uq').on(t.hash)],
);

export const parsers = pgTable('parsers', {
  id: text('id').primaryKey(),
  /** Null = parser umum untuk semua package. */
  packageName: text('package_name'),
  /** Regex dengan satu grup tangkap berisi nominal, mis. "Rp\\s?([\\d.]+)\\s+diterima". */
  pattern: text('pattern').notNull(),
  priority: integer('priority').notNull().default(100),
  /**
   * false = nominal hasil parser ini tidak dicocokkan otomatis, hanya dicatat untuk ditinjau owner.
   * Dipakai untuk pola umum yang bisa salah tangkap (mis. notifikasi penarikan dana).
   */
  autoMatch: boolean('auto_match').notNull().default(true),
  isActive: boolean('is_active').notNull().default(true),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

export const webhookDeliveries = pgTable(
  'webhook_deliveries',
  {
    id: text('id').primaryKey(),
    /** Dikirim sebagai X-Event-Id; tetap sama di setiap percobaan ulang. */
    eventId: text('event_id').notNull(),
    eventType: text('event_type').notNull(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id),
    transactionId: text('transaction_id')
      .notNull()
      .references(() => transactions.id),
    payload: jsonb('payload').notNull(),
    status: deliveryStatus('status').notNull().default('PENDING'),
    attempt: integer('attempt').notNull().default(0),
    lastStatusCode: integer('last_status_code'),
    lastError: text('last_error'),
    nextRetryAt: ts('next_retry_at').notNull().defaultNow(),
    deliveredAt: ts('delivered_at'),
    createdAt: createdAt(),
  },
  (t) => [index('webhook_deliveries_due_idx').on(t.status, t.nextRetryAt)],
);

export const auditLogs = pgTable('audit_logs', {
  id: text('id').primaryKey(),
  actor: text('actor').notNull(),
  action: text('action').notNull(),
  target: text('target'),
  detail: jsonb('detail'),
  createdAt: createdAt(),
});

/** Akun owner dashboard. Password argon2id; secret TOTP terenkripsi. */
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  /** Secret TOTP aktif (terenkripsi). Null = 2FA belum aktif. */
  totpSecretEnc: text('totp_secret_enc'),
  /** Secret yang sedang didaftarkan, menunggu kode pertama. */
  totpPendingEnc: text('totp_pending_enc'),
  totpEnabledAt: ts('totp_enabled_at'),
  /** Langkah waktu TOTP terakhir yang dipakai, agar kode tidak bisa dipakai dua kali. */
  totpLastStep: bigint('totp_last_step', { mode: 'number' }),
  failedLogins: integer('failed_logins').notNull().default(0),
  lockedUntil: ts('locked_until'),
  createdAt: createdAt(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

export const ownerSessions = pgTable(
  'owner_sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    tokenHash: text('token_hash').notNull().unique(),
    ip: text('ip'),
    userAgent: text('user_agent'),
    createdAt: createdAt(),
    lastSeenAt: ts('last_seen_at').notNull().defaultNow(),
    expiresAt: ts('expires_at').notNull(),
    revokedAt: ts('revoked_at'),
  },
  (t) => [index('owner_sessions_user_idx').on(t.userId)],
);

/** Pengaturan yang bisa diubah dari dashboard (mis. Telegram). */
export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

export const notificationStatus = pgEnum('notification_status', [
  'PENDING',
  'SENT',
  'FAILED',
]);

/** Antrian pesan Telegram ke owner, dengan percobaan ulang. */
export const notifications = pgTable(
  'notifications',
  {
    id: text('id').primaryKey(),
    category: text('category').notNull(),
    text: text('text').notNull(),
    status: notificationStatus('status').notNull().default('PENDING'),
    attempt: integer('attempt').notNull().default(0),
    lastError: text('last_error'),
    nextRetryAt: ts('next_retry_at').notNull().defaultNow(),
    sentAt: ts('sent_at'),
    createdAt: createdAt(),
  },
  (t) => [index('notifications_due_idx').on(t.status, t.nextRetryAt)],
);

/** Catatan dari skrip backup/uji restore di server, untuk dashboard dan alarm. */
export const backupRuns = pgTable('backup_runs', {
  id: text('id').primaryKey(),
  /** 'backup' atau 'restore_test'. */
  kind: text('kind').notNull(),
  ok: boolean('ok').notNull(),
  file: text('file'),
  sizeBytes: bigint('size_bytes', { mode: 'number' }),
  detail: text('detail'),
  startedAt: ts('started_at'),
  finishedAt: ts('finished_at').notNull().defaultNow(),
});
