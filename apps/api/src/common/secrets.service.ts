import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';
import { decrypt, encrypt } from './crypto';

/** Enkripsi secret yang perlu dibaca ulang (secret device, secret webhook). */
@Injectable()
export class SecretsService {
  private readonly key: Buffer;

  constructor(config: ConfigService<Env, true>) {
    this.key = config.get('APP_ENCRYPTION_KEY', { infer: true });
  }

  seal(plain: string): string {
    return encrypt(this.key, plain);
  }

  open(sealed: string): string {
    return decrypt(this.key, sealed);
  }
}
