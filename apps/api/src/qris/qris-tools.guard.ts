import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';

/**
 * Endpoint alat uji QRIS hanya aktif bila QRIS_TOOLS_ENABLED=true.
 * Saat mati, pura-pura tidak ada (404) agar tidak terlihat dari luar.
 */
@Injectable()
export class QrisToolsGuard implements CanActivate {
  constructor(private readonly config: ConfigService<Env, true>) {}

  canActivate(): boolean {
    if (!this.config.get('QRIS_TOOLS_ENABLED', { infer: true })) {
      throw new NotFoundException();
    }
    return true;
  }
}
