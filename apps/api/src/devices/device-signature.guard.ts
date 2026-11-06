import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { hmacSha256Hex, safeEqualHex } from '../common/crypto';
import type { Env } from '../config/env';
import { DevicesService, type Device } from './devices.service';

export type DeviceRequest = Request & {
  device?: Device;
  deviceTimestamp?: number;
  rawBody?: Buffer;
};

/**
 * Tanda tangan request device:
 *   X-Signature = hex(HMAC-SHA256(secret, `${X-Timestamp}.${X-Nonce}.${body mentah}`))
 * X-Timestamp dalam milidetik Unix. Request ditolak bila jamnya terlalu jauh dari server
 * atau nonce-nya sudah pernah dipakai.
 */
export function signDeviceRequest(
  secret: string,
  timestamp: string,
  nonce: string,
  body: string,
): string {
  return hmacSha256Hex(secret, `${timestamp}.${nonce}.${body}`);
}

@Injectable()
export class DeviceSignatureGuard implements CanActivate {
  constructor(
    private readonly devices: DevicesService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<DeviceRequest>();
    const header = (name: string) => {
      const v = req.headers[name];
      return typeof v === 'string' ? v : '';
    };
    const deviceId = header('x-device-id');
    const timestamp = header('x-timestamp');
    const nonce = header('x-nonce');
    const signature = header('x-signature').toLowerCase();
    if (
      !deviceId ||
      !/^\d{10,16}$/.test(timestamp) ||
      !/^[A-Za-z0-9_-]{8,64}$/.test(nonce) ||
      !/^[0-9a-f]{64}$/.test(signature)
    ) {
      throw new UnauthorizedException(
        'Header X-Device-Id, X-Timestamp, X-Nonce, dan X-Signature wajib dan harus valid.',
      );
    }

    const toleranceMs =
      this.config.get('DEVICE_CLOCK_TOLERANCE_SEC', { infer: true }) * 1000;
    const ts = Number(timestamp);
    if (Math.abs(Date.now() - ts) > toleranceMs) {
      throw new UnauthorizedException(
        'Jam device terlalu jauh dari jam server. Sinkronkan jam HP.',
      );
    }

    const device = await this.devices.findActive(deviceId);
    if (!device)
      throw new UnauthorizedException(
        'Device tidak dikenal atau sudah dicabut.',
      );

    const body = req.rawBody?.toString('utf8') ?? '';
    const expected = signDeviceRequest(
      this.devices.secretOf(device),
      timestamp,
      nonce,
      body,
    );
    if (!safeEqualHex(expected, signature))
      throw new UnauthorizedException('Tanda tangan tidak valid.');

    // Nonce dicatat setelah tanda tangan sah, agar orang lain tidak bisa "menghabiskan" nonce.
    if (!(await this.devices.useNonce(device.id, nonce))) {
      throw new UnauthorizedException('Nonce sudah pernah dipakai.');
    }

    req.device = device;
    req.deviceTimestamp = ts;
    return true;
  }
}

export const CurrentDevice = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<DeviceRequest>();
    if (!req.device) throw new UnauthorizedException();
    return { device: req.device, timestamp: req.deviceTimestamp ?? Date.now() };
  },
);
