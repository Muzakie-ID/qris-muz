import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { safeEqualHex, sha256Hex } from '../common/crypto';
import type { Env } from '../config/env';

/**
 * Sementara sampai login owner + 2FA dibuat (Tahap 3): header `Authorization: Bearer <ADMIN_TOKEN>`.
 * Bila ADMIN_TOKEN kosong, semua rute admin dianggap tidak ada.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly config: ConfigService<Env, true>) {}

  canActivate(ctx: ExecutionContext): boolean {
    const token = this.config.get('ADMIN_TOKEN', { infer: true });
    if (!token) throw new NotFoundException();
    const req = ctx.switchToHttp().getRequest<Request>();
    const given =
      /^Bearer\s+(\S+)$/i.exec(req.headers.authorization ?? '')?.[1] ?? '';
    if (!safeEqualHex(sha256Hex(given), sha256Hex(token))) {
      throw new UnauthorizedException('Token admin salah.');
    }
    return true;
  }
}
