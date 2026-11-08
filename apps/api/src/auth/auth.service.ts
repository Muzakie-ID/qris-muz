import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { esc, NotifierService } from '../alerts/notifier.service';
import { AuditService } from '../common/audit.service';
import { randomToken, sha256Hex } from '../common/crypto';
import { newId } from '../common/ids';
import { setActor } from '../common/request-context';
import { SecretsService } from '../common/secrets.service';
import { DB, type Db } from '../db/db.module';
import { ownerSessions, users } from '../db/schema';
import { generateTotpSecret, otpauthUri, verifyTotp } from './totp';

export type User = typeof users.$inferSelect;
export type OwnerSession = typeof ownerSessions.$inferSelect;

/** Sesi berakhir bila tidak dipakai 12 jam, dan paling lama 30 hari sejak login. */
export const SESSION_IDLE_MS = 12 * 3600_000;
export const SESSION_MAX_MS = 30 * 24 * 3600_000;
const CHALLENGE_TTL_MS = 5 * 60_000;
const MAX_FAILED = 5;
const LOCK_MS = 15 * 60_000;
export const MIN_PASSWORD = 10;
export const SESSION_PREFIX = 'qms_';

/** Opsi argon2id sesuai rekomendasi OWASP (19 MiB, 2 iterasi). */
const ARGON = {
  type: argon2.argon2id as 2,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON);
}

export function assertPasswordStrength(password: string): void {
  if (password.length < MIN_PASSWORD)
    throw new BadRequestException(`Password minimal ${MIN_PASSWORD} karakter.`);
  if (password.length > 200)
    throw new BadRequestException('Password terlalu panjang.');
}

export interface ClientInfo {
  ip?: string | null;
  userAgent?: string | null;
}

export type LoginResult =
  | { status: 'ok'; token: string; expires_at: string }
  | { status: 'totp_required'; challenge: string };

const WRONG = 'Email atau password salah.';

@Injectable()
export class AuthService {
  /** Hash palsu agar waktu proses email tak terdaftar sama dengan password salah. */
  private dummyHash?: Promise<string>;

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly secrets: SecretsService,
    private readonly audit: AuditService,
    private readonly notifier: NotifierService,
  ) {}

  // --- Login ---

  async login(
    email: string,
    password: string,
    client: ClientInfo,
  ): Promise<LoginResult> {
    const user = await this.db.query.users.findFirst({
      where: eq(users.email, email.trim().toLowerCase()),
    });
    if (!user) {
      this.dummyHash ??= hashPassword(randomToken(16));
      await argon2.verify(await this.dummyHash, password).catch(() => false);
      throw new UnauthorizedException(WRONG);
    }
    this.assertNotLocked(user);
    if (
      !(await argon2.verify(user.passwordHash, password).catch(() => false))
    ) {
      await this.recordFailure(user, client, 'password');
      throw new UnauthorizedException(WRONG);
    }
    if (user.totpSecretEnc) {
      // Password benar; percobaan gagal belum direset sampai kode 2FA juga benar.
      const challenge = this.secrets.seal(
        JSON.stringify({
          p: 'totp',
          uid: user.id,
          exp: Date.now() + CHALLENGE_TTL_MS,
        }),
      );
      return { status: 'totp_required', challenge };
    }
    return this.finishLogin(user, client, false);
  }

  async loginTotp(
    challenge: string,
    code: string,
    client: ClientInfo,
  ): Promise<LoginResult> {
    let uid: string;
    try {
      const c = JSON.parse(this.secrets.open(challenge)) as {
        p: string;
        uid: string;
        exp: number;
      };
      if (c.p !== 'totp' || c.exp < Date.now()) throw new Error();
      uid = c.uid;
    } catch {
      throw new UnauthorizedException(
        'Sesi login kedaluwarsa. Masukkan password lagi.',
      );
    }
    const user = await this.db.query.users.findFirst({
      where: eq(users.id, uid),
    });
    if (!user?.totpSecretEnc)
      throw new UnauthorizedException(
        'Sesi login kedaluwarsa. Masukkan password lagi.',
      );
    this.assertNotLocked(user);
    const step = verifyTotp(
      this.secrets.open(user.totpSecretEnc),
      code,
      user.totpLastStep,
    );
    if (step === null) {
      await this.recordFailure(user, client, 'totp');
      throw new UnauthorizedException('Kode 2FA salah atau sudah dipakai.');
    }
    await this.db
      .update(users)
      .set({ totpLastStep: step })
      .where(eq(users.id, user.id));
    return this.finishLogin(user, client, true);
  }

  private assertNotLocked(user: User) {
    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      const min = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
      throw new HttpException(
        `Terlalu banyak percobaan gagal. Coba lagi dalam ${min} menit.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async recordFailure(
    user: User,
    client: ClientInfo,
    stage: 'password' | 'totp',
  ) {
    const failed = user.failedLogins + 1;
    const lock = failed >= MAX_FAILED;
    await this.db
      .update(users)
      .set({
        failedLogins: lock ? 0 : failed,
        lockedUntil: lock ? new Date(Date.now() + LOCK_MS) : user.lockedUntil,
      })
      .where(eq(users.id, user.id));
    await this.audit.log(
      lock ? 'auth.locked' : 'auth.login_failed',
      user.id,
      { stage, ip: client.ip },
      user.email,
    );
    if (lock)
      await this.notifier.notify(
        'security',
        `🔐 <b>Login dikunci 15 menit</b> setelah ${MAX_FAILED} percobaan gagal (${stage === 'totp' ? 'kode 2FA' : 'password'}).\nIP: ${esc(client.ip)}\nBila bukan Anda, segera ganti password.`,
      );
  }

  private async finishLogin(
    user: User,
    client: ClientInfo,
    withTotp: boolean,
  ): Promise<LoginResult> {
    await this.db
      .update(users)
      .set({ failedLogins: 0, lockedUntil: null })
      .where(eq(users.id, user.id));
    const { token, session } = await this.createSession(user, client);
    await this.audit.log(
      'auth.login',
      session.id,
      { ip: client.ip, totp: withTotp },
      user.email,
    );
    await this.notifier.notify(
      'security',
      `🔐 <b>Login dashboard</b> ${esc(user.email)}\nIP: ${esc(client.ip)}${withTotp ? '' : '\n2FA belum aktif; nyalakan di Pengaturan.'}`,
    );
    return { status: 'ok', token, expires_at: session.expiresAt.toISOString() };
  }

  private async createSession(user: User, client: ClientInfo) {
    const token = SESSION_PREFIX + randomToken(32);
    const [session] = await this.db
      .insert(ownerSessions)
      .values({
        id: newId.session(),
        userId: user.id,
        tokenHash: sha256Hex(token),
        ip: client.ip?.slice(0, 100) ?? null,
        userAgent: client.userAgent?.slice(0, 300) ?? null,
        expiresAt: new Date(Date.now() + SESSION_IDLE_MS),
      })
      .returning();
    return { token, session };
  }

  // --- Sesi ---

  /** Memeriksa token sesi; memperpanjang masa berlaku bila masih dipakai. */
  async authenticate(
    token: string,
  ): Promise<{ user: User; session: OwnerSession } | null> {
    const now = Date.now();
    const row = await this.db
      .select({ session: ownerSessions, user: users })
      .from(ownerSessions)
      .innerJoin(users, eq(users.id, ownerSessions.userId))
      .where(
        and(
          eq(ownerSessions.tokenHash, sha256Hex(token)),
          isNull(ownerSessions.revokedAt),
          gt(ownerSessions.expiresAt, new Date(now)),
        ),
      )
      .limit(1);
    if (!row[0]) return null;
    const { session, user } = row[0];
    // Tulis ke database paling sering sekali per menit.
    if (now - session.lastSeenAt.getTime() > 60_000) {
      const cap = session.createdAt.getTime() + SESSION_MAX_MS;
      await this.db
        .update(ownerSessions)
        .set({
          lastSeenAt: new Date(now),
          expiresAt: new Date(Math.min(now + SESSION_IDLE_MS, cap)),
        })
        .where(eq(ownerSessions.id, session.id));
    }
    setActor(user.email);
    return { user, session };
  }

  async logout(sessionId: string) {
    await this.db
      .update(ownerSessions)
      .set({ revokedAt: new Date() })
      .where(eq(ownerSessions.id, sessionId));
    await this.audit.log('auth.logout', sessionId);
  }

  listSessions(userId: string) {
    return this.db.query.ownerSessions.findMany({
      where: and(
        eq(ownerSessions.userId, userId),
        isNull(ownerSessions.revokedAt),
        gt(ownerSessions.expiresAt, new Date()),
      ),
      orderBy: [desc(ownerSessions.lastSeenAt)],
    });
  }

  async revokeSession(userId: string, sessionId: string) {
    const rows = await this.db
      .update(ownerSessions)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(ownerSessions.id, sessionId),
          eq(ownerSessions.userId, userId),
          isNull(ownerSessions.revokedAt),
        ),
      )
      .returning({ id: ownerSessions.id });
    if (!rows.length) throw new NotFoundException('Sesi tidak ditemukan.');
    await this.audit.log('auth.session_revoked', sessionId);
  }

  private async revokeOthers(userId: string, keepSessionId: string | null) {
    const sessions = await this.listSessions(userId);
    for (const s of sessions) {
      if (s.id !== keepSessionId)
        await this.db
          .update(ownerSessions)
          .set({ revokedAt: new Date() })
          .where(eq(ownerSessions.id, s.id));
    }
  }

  // --- Akun ---

  async changePassword(
    user: User,
    current: string,
    next: string,
    keepSessionId: string,
  ) {
    if (!(await argon2.verify(user.passwordHash, current).catch(() => false)))
      throw new BadRequestException('Password saat ini salah.');
    assertPasswordStrength(next);
    await this.db
      .update(users)
      .set({ passwordHash: await hashPassword(next), updatedAt: new Date() })
      .where(eq(users.id, user.id));
    await this.revokeOthers(user.id, keepSessionId);
    await this.audit.log('auth.password_changed', user.id);
  }

  async totpSetup(user: User) {
    if (user.totpSecretEnc)
      throw new BadRequestException(
        '2FA sudah aktif. Matikan dulu untuk mengganti HP.',
      );
    const secret = generateTotpSecret();
    await this.db
      .update(users)
      .set({ totpPendingEnc: this.secrets.seal(secret) })
      .where(eq(users.id, user.id));
    return { secret, otpauth_uri: otpauthUri(secret, user.email) };
  }

  async totpEnable(user: User, code: string, keepSessionId: string) {
    if (user.totpSecretEnc) throw new BadRequestException('2FA sudah aktif.');
    if (!user.totpPendingEnc)
      throw new BadRequestException('Mulai pengaturan 2FA dulu.');
    const secret = this.secrets.open(user.totpPendingEnc);
    const step = verifyTotp(secret, code);
    if (step === null)
      throw new BadRequestException(
        'Kode salah. Pastikan jam HP sudah benar lalu coba kode berikutnya.',
      );
    await this.db
      .update(users)
      .set({
        totpSecretEnc: user.totpPendingEnc,
        totpPendingEnc: null,
        totpEnabledAt: new Date(),
        totpLastStep: step,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));
    // Sesi lain dibuat tanpa 2FA; keluarkan semuanya.
    await this.revokeOthers(user.id, keepSessionId);
    await this.audit.log('auth.totp_enabled', user.id);
  }

  async totpDisable(user: User, password: string, code: string) {
    if (!user.totpSecretEnc) throw new BadRequestException('2FA belum aktif.');
    if (!(await argon2.verify(user.passwordHash, password).catch(() => false)))
      throw new BadRequestException('Password salah.');
    const step = verifyTotp(
      this.secrets.open(user.totpSecretEnc),
      code,
      user.totpLastStep,
    );
    if (step === null)
      throw new BadRequestException('Kode 2FA salah atau sudah dipakai.');
    await this.db
      .update(users)
      .set({
        totpSecretEnc: null,
        totpPendingEnc: null,
        totpEnabledAt: null,
        totpLastStep: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));
    await this.audit.log('auth.totp_disabled', user.id);
  }
}
