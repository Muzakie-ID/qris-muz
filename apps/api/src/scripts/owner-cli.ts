/**
 * Mengelola akun owner dari server (bukan dari dashboard):
 *
 *   node dist/scripts/owner-cli.js create <email>          membuat owner pertama
 *   node dist/scripts/owner-cli.js reset-password <email>  lupa password
 *   node dist/scripts/owner-cli.js disable-2fa <email>     HP authenticator hilang
 *   node dist/scripts/owner-cli.js list
 *
 * Password ditanyakan tanpa ditampilkan, atau diambil dari OWNER_PASSWORD (untuk otomasi).
 * Reset password dan mematikan 2FA juga mengeluarkan semua sesi yang sedang login.
 */
import 'dotenv/config';
import { and, eq, isNull } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as readline from 'node:readline';
import {
  assertPasswordStrength,
  hashPassword,
  MIN_PASSWORD,
} from '../auth/auth.service';
import { newId } from '../common/ids';
import * as schema from '../db/schema';
import { ownerSessions, users } from '../db/schema';

function ask(question: string, hidden: boolean): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });
  if (hidden) {
    const r = rl as unknown as {
      _writeToOutput: (s: string) => void;
      output: NodeJS.WriteStream;
    };
    r._writeToOutput = (s: string) => {
      if (s.startsWith(question)) r.output.write(question);
    };
  }
  return new Promise((resolve) =>
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write('\n');
      resolve(answer);
    }),
  );
}

async function newPassword(): Promise<string> {
  const fromEnv = process.env.OWNER_PASSWORD;
  if (fromEnv) {
    assertPasswordStrength(fromEnv);
    return fromEnv;
  }
  if (!process.stdin.isTTY)
    throw new Error(
      'Jalankan di terminal interaktif (docker compose exec -it), atau isi OWNER_PASSWORD.',
    );
  const a = await ask(
    `Password baru (minimal ${MIN_PASSWORD} karakter): `,
    true,
  );
  assertPasswordStrength(a);
  const b = await ask('Ulangi password: ', true);
  if (a !== b) throw new Error('Password tidak sama.');
  return a;
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

async function main() {
  const [cmd, rawEmail] = process.argv.slice(2);
  const url = process.env.DATABASE_URL ?? fail('DATABASE_URL belum disetel.');
  const pool = new Pool({ connectionString: url, max: 1 });
  const db = drizzle(pool, { schema });
  const email = rawEmail?.trim().toLowerCase();
  const needEmail = () => email || fail(`Pakai: owner-cli ${cmd} <email>`);
  const revokeAll = (userId: string) =>
    db
      .update(ownerSessions)
      .set({ revokedAt: new Date() })
      .where(
        and(eq(ownerSessions.userId, userId), isNull(ownerSessions.revokedAt)),
      );

  try {
    switch (cmd) {
      case 'create': {
        const e = needEmail();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) fail('Email tidak valid.');
        const existing = await db.query.users.findFirst();
        if (existing)
          fail(
            `Owner sudah ada (${existing.email}). Pakai reset-password bila lupa password.`,
          );
        await db.insert(users).values({
          id: newId.user(),
          email: e,
          passwordHash: await hashPassword(await newPassword()),
        });
        console.log(
          `Owner ${e} dibuat. Masuk ke dashboard, lalu nyalakan 2FA di Pengaturan.`,
        );
        break;
      }
      case 'reset-password': {
        const user =
          (await db.query.users.findFirst({
            where: eq(users.email, needEmail()),
          })) ?? fail('Owner tidak ditemukan.');
        await db
          .update(users)
          .set({
            passwordHash: await hashPassword(await newPassword()),
            failedLogins: 0,
            lockedUntil: null,
            updatedAt: new Date(),
          })
          .where(eq(users.id, user.id));
        await revokeAll(user.id);
        console.log('Password diganti dan semua sesi dikeluarkan.');
        break;
      }
      case 'disable-2fa': {
        const user =
          (await db.query.users.findFirst({
            where: eq(users.email, needEmail()),
          })) ?? fail('Owner tidak ditemukan.');
        await db
          .update(users)
          .set({
            totpSecretEnc: null,
            totpPendingEnc: null,
            totpEnabledAt: null,
            totpLastStep: null,
            updatedAt: new Date(),
          })
          .where(eq(users.id, user.id));
        await revokeAll(user.id);
        console.log(
          '2FA dimatikan dan semua sesi dikeluarkan. Nyalakan lagi dari Pengaturan setelah login.',
        );
        break;
      }
      case 'list': {
        for (const u of await db.query.users.findMany())
          console.log(
            `${u.email}\t2FA ${u.totpSecretEnc ? 'aktif' : 'mati'}\tdibuat ${u.createdAt.toISOString()}`,
          );
        break;
      }
      default:
        fail(
          'Perintah: create <email> | reset-password <email> | disable-2fa <email> | list',
        );
    }
  } finally {
    await pool.end();
  }
}

main().catch((e: unknown) => fail((e as Error).message));
