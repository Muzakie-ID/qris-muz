import {
  GoneException,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq, gt, isNull, lt } from 'drizzle-orm';
import { AuditService } from '../common/audit.service';
import { randomToken, sha256Hex } from '../common/crypto';
import { newId } from '../common/ids';
import { SecretsService } from '../common/secrets.service';
import type { Env } from '../config/env';
import { DB, type Db } from '../db/db.module';
import {
  deviceNonces,
  devicePairingTokens,
  devices,
  type DeviceCommand,
} from '../db/schema';
import { QrisSourcesService } from '../qris/qris-sources.service';

export type Device = typeof devices.$inferSelect;

const PAIRING_TTL_MS = 10 * 60_000;
export const HEARTBEAT_INTERVAL_SEC = 60;

export interface HeartbeatInput {
  listener_ok: boolean;
  battery?: number;
  charging?: boolean;
  queued?: number;
  source_app_versions?: Record<string, string>;
  app_version?: string;
  last_crash?: string;
}

@Injectable()
export class DevicesService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly config: ConfigService<Env, true>,
    private readonly secrets: SecretsService,
    private readonly qrisSources: QrisSourcesService,
    private readonly audit: AuditService,
  ) {}

  onModuleInit() {
    if (this.config.get('JOBS_ENABLED', { infer: true })) {
      this.timer = setInterval(
        () => void this.pruneNonces().catch(() => undefined),
        10 * 60_000,
      );
    }
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Token sekali pakai untuk dipindai listener; token asli hanya dikembalikan di sini. */
  async createPairingToken(deviceName: string) {
    const token = `pair_${randomToken(18)}`;
    const expiresAt = new Date(Date.now() + PAIRING_TTL_MS);
    await this.db.insert(devicePairingTokens).values({
      id: newId.pairing(),
      tokenHash: sha256Hex(token),
      deviceName,
      expiresAt,
    });
    await this.audit.log('device.pairing_token_created', null, { deviceName });
    const server = this.config.get('PUBLIC_API_URL', { infer: true });
    return {
      token,
      expires_at: expiresAt.toISOString(),
      // Isi QR pairing: listener cukup memindai ini.
      pairing_uri: `qrismuz://pair?server=${encodeURIComponent(server)}&token=${encodeURIComponent(token)}`,
    };
  }

  /** Menukar token pairing dengan device_id dan secret. Secret hanya dikirim sekali. */
  async register(token: string) {
    return this.db.transaction(async (tx) => {
      const [pairing] = await tx
        .update(devicePairingTokens)
        .set({ usedAt: new Date() })
        .where(
          and(
            eq(devicePairingTokens.tokenHash, sha256Hex(token)),
            isNull(devicePairingTokens.usedAt),
            gt(devicePairingTokens.expiresAt, new Date()),
          ),
        )
        .returning();
      if (!pairing)
        throw new GoneException(
          'Token pairing tidak valid, sudah dipakai, atau kedaluwarsa.',
        );
      const secret = randomToken(32);
      const [device] = await tx
        .insert(devices)
        .values({
          id: newId.device(),
          name: pairing.deviceName,
          secretEnc: this.secrets.seal(secret),
        })
        .returning();
      await this.audit.log(
        'device.registered',
        device.id,
        { name: device.name },
        'device',
        tx,
      );
      return {
        device_id: device.id,
        secret,
        name: device.name,
        server_time: Date.now(),
      };
    });
  }

  async findActive(id: string): Promise<Device | undefined> {
    return this.db.query.devices.findFirst({
      where: and(eq(devices.id, id), isNull(devices.revokedAt)),
    });
  }

  secretOf(device: Device): string {
    return this.secrets.open(device.secretEnc);
  }

  /** Mencatat nonce; false bila sudah pernah dipakai (replay). */
  async useNonce(deviceId: string, nonce: string): Promise<boolean> {
    const rows = await this.db
      .insert(deviceNonces)
      .values({ deviceId, nonce })
      .onConflictDoNothing()
      .returning({ nonce: deviceNonces.nonce });
    return rows.length === 1;
  }

  async heartbeat(
    device: Device,
    input: HeartbeatInput,
    deviceTimestamp: number,
  ) {
    const commands = await this.db.transaction(async (tx) => {
      const [current] = await tx
        .select({ pending: devices.pendingCommands })
        .from(devices)
        .where(eq(devices.id, device.id))
        .for('update');
      await tx
        .update(devices)
        .set({
          lastHeartbeatAt: new Date(),
          listenerOk: input.listener_ok,
          battery: input.battery ?? null,
          charging: input.charging ?? null,
          queued: input.queued ?? null,
          sourceAppVersions: input.source_app_versions ?? null,
          clockSkewMs: Date.now() - deviceTimestamp,
          appVersion: input.app_version ?? null,
          ...(input.last_crash && {
            lastCrash: input.last_crash,
            lastCrashAt: new Date(),
          }),
          pendingCommands: [],
        })
        .where(eq(devices.id, device.id));
      return current?.pending ?? [];
    });
    return {
      server_time: Date.now(),
      next_heartbeat_sec: HEARTBEAT_INTERVAL_SEC,
      commands,
    };
  }

  /** Menitipkan perintah untuk listener; dijalankan saat heartbeat berikutnya (≤ 1 menit). */
  async queueCommand(id: string, command: DeviceCommand) {
    const device = await this.findActive(id);
    if (!device)
      throw new NotFoundException('Device tidak ditemukan atau sudah dicabut.');
    const next = Array.from(new Set([...device.pendingCommands, command]));
    await this.db
      .update(devices)
      .set({ pendingCommands: next })
      .where(eq(devices.id, id));
    await this.audit.log('device.command_queued', id, { command });
    return { pending_commands: next };
  }

  async configFor() {
    return {
      packages: await this.qrisSources.activePackages(),
      heartbeat_interval_sec: HEARTBEAT_INTERVAL_SEC,
      server_time: Date.now(),
    };
  }

  async revoke(id: string) {
    const [row] = await this.db
      .update(devices)
      .set({ revokedAt: new Date() })
      .where(and(eq(devices.id, id), isNull(devices.revokedAt)))
      .returning({ id: devices.id });
    if (!row)
      throw new NotFoundException('Device tidak ditemukan atau sudah dicabut.');
    await this.audit.log('device.revoked', id);
  }

  list() {
    return this.db.query.devices.findMany({
      columns: { secretEnc: false },
      orderBy: (d, { asc }) => [asc(d.createdAt)],
    });
  }

  /** Status listener untuk proyek klien dan dashboard. */
  async listenerStatus() {
    const offlineAfterMs =
      this.config.get('LISTENER_OFFLINE_AFTER_SEC', { infer: true }) * 1000;
    const active = await this.db.query.devices.findMany({
      where: isNull(devices.revokedAt),
      columns: {
        id: true,
        name: true,
        lastHeartbeatAt: true,
        listenerOk: true,
      },
    });
    const list = active.map((d) => ({
      id: d.id,
      name: d.name,
      online:
        !!d.lastHeartbeatAt &&
        Date.now() - d.lastHeartbeatAt.getTime() < offlineAfterMs &&
        d.listenerOk === true,
      last_heartbeat_at: d.lastHeartbeatAt?.toISOString() ?? null,
    }));
    const online = list.some((d) => d.online);
    return {
      listener_online: online,
      confirmation: online ? 'realtime' : 'delayed',
      devices: list,
      server_time: new Date().toISOString(),
    };
  }

  private async pruneNonces() {
    const keepMs =
      this.config.get('DEVICE_CLOCK_TOLERANCE_SEC', { infer: true }) * 2000;
    await this.db
      .delete(deviceNonces)
      .where(lt(deviceNonces.createdAt, new Date(Date.now() - keepMs)));
  }
}
