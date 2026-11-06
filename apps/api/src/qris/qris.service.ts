import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as QRCode from 'qrcode';
import type { Env } from '../config/env';
import { QrisError, parseQris, toDynamicQris, type QrisInfo } from './core';

export interface InspectResult {
  valid: boolean;
  info: QrisInfo | null;
  error: { code: string; message: string } | null;
}

export interface DynamicQrisResult {
  payload: string;
  amount: number;
  merchantName: string;
  nmid: string | null;
}

@Injectable()
export class QrisService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  get maxAmount(): number {
    return this.config.get('QRIS_MAX_AMOUNT', { infer: true });
  }

  /** QRIS statis dari konfigurasi; melempar bila belum disetel. */
  configuredStatic(): string {
    const payload = this.config.get('QRIS_STATIC_PAYLOAD', { infer: true });
    if (!payload) {
      throw new QrisError(
        'MISSING_TAG',
        'QRIS statis belum disetel. Isi QRIS_STATIC_PAYLOAD di .env atau kirim "payload" di request.',
      );
    }
    return payload;
  }

  /** Memeriksa payload tanpa melempar: cocok untuk layar "cek QRIS". */
  inspect(payload: string): InspectResult {
    try {
      return { valid: true, info: parseQris(payload).info, error: null };
    } catch (e) {
      if (e instanceof QrisError) {
        return {
          valid: false,
          info: null,
          error: { code: e.code, message: e.message },
        };
      }
      throw e;
    }
  }

  createDynamic(amount: number, staticPayload?: string): DynamicQrisResult {
    const source = staticPayload?.trim() || this.configuredStatic();
    const payload = toDynamicQris(source, amount, {
      maxAmount: this.maxAmount,
    });
    const { info } = parseQris(payload);
    return {
      payload,
      amount,
      merchantName: info.merchantName,
      nmid: info.nmid,
    };
  }

  toSvg(payload: string): Promise<string> {
    return QRCode.toString(payload, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 2,
    });
  }

  toPng(payload: string): Promise<Buffer> {
    return QRCode.toBuffer(payload, {
      type: 'png',
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 512,
    });
  }
}
