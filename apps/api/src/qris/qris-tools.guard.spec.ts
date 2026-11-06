import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';
import { QrisToolsGuard } from './qris-tools.guard';

function guard(enabled: boolean) {
  const config = { get: () => enabled } as unknown as ConfigService<Env, true>;
  return new QrisToolsGuard(config);
}

describe('QrisToolsGuard', () => {
  it('mengizinkan saat QRIS_TOOLS_ENABLED=true', () => {
    expect(guard(true).canActivate()).toBe(true);
  });

  it('membalas 404 saat dimatikan', () => {
    expect(() => guard(false).canActivate()).toThrow(NotFoundException);
  });
});
