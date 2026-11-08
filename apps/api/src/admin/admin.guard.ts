import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import {
  AuthService,
  SESSION_PREFIX,
  type OwnerSession,
  type User,
} from '../auth/auth.service';
import { safeEqualHex, sha256Hex } from '../common/crypto';
import { setActor } from '../common/request-context';
import type { Env } from '../config/env';

export interface OwnerContext {
  user: User;
  session: OwnerSession;
}

type AdminRequest = Request & { owner?: OwnerContext };

function bearer(req: Request): string {
  return /^Bearer\s+(\S+)$/i.exec(req.headers.authorization ?? '')?.[1] ?? '';
}

/**
 * Rute admin menerima dua jenis kredensial:
 * - token sesi owner (`qms_…`) dari login dashboard, atau
 * - ADMIN_TOKEN untuk otomasi/skrip (opsional; kosongkan di produksi bila tidak dipakai).
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly auth: AuthService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AdminRequest>();
    const given = bearer(req);
    if (given.startsWith(SESSION_PREFIX)) {
      const owner = await this.auth.authenticate(given);
      if (!owner)
        throw new UnauthorizedException('Sesi berakhir. Silakan masuk lagi.');
      req.owner = owner;
      return true;
    }
    const token = this.config.get('ADMIN_TOKEN', { infer: true });
    if (token && given && safeEqualHex(sha256Hex(given), sha256Hex(token))) {
      setActor('admin-token');
      return true;
    }
    throw new UnauthorizedException('Perlu login.');
  }
}

/** Untuk rute akun: hanya sesi owner, bukan ADMIN_TOKEN. */
@Injectable()
export class OwnerGuard implements CanActivate {
  constructor(private readonly admin: AdminGuard) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    await this.admin.canActivate(ctx);
    if (!ctx.switchToHttp().getRequest<AdminRequest>().owner)
      throw new ForbiddenException('Rute ini hanya untuk sesi owner.');
    return true;
  }
}

export const Owner = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): OwnerContext =>
    ctx.switchToHttp().getRequest<AdminRequest>().owner!,
);
