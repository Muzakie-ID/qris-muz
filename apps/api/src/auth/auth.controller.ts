import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { Owner, OwnerGuard, type OwnerContext } from '../admin/admin.guard';
import { AuthService, type ClientInfo } from './auth.service';
import {
  ChangePasswordDto,
  LoginDto,
  LoginTotpDto,
  TotpCodeDto,
  TotpDisableDto,
} from './auth.dto';

function client(req: Request): ClientInfo {
  return { ip: req.ip ?? null, userAgent: req.headers['user-agent'] ?? null };
}

/** Login owner. Dipanggil server web (server action), bukan langsung dari browser. */
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto.email, dto.password, client(req));
  }

  @Post('login/totp')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  loginTotp(@Body() dto: LoginTotpDto, @Req() req: Request) {
    return this.auth.loginTotp(dto.challenge, dto.code, client(req));
  }
}

/** Akun owner yang sedang login: password, 2FA, dan sesi. */
@SkipThrottle()
@Controller('admin/account')
@UseGuards(OwnerGuard)
export class AccountController {
  constructor(private readonly auth: AuthService) {}

  @Get()
  async me(@Owner() o: OwnerContext) {
    const sessions = await this.auth.listSessions(o.user.id);
    return {
      id: o.user.id,
      email: o.user.email,
      totp_enabled: !!o.user.totpSecretEnc,
      totp_enabled_at: o.user.totpEnabledAt?.toISOString() ?? null,
      session_id: o.session.id,
      sessions: sessions.map((s) => ({
        id: s.id,
        current: s.id === o.session.id,
        ip: s.ip,
        user_agent: s.userAgent,
        created_at: s.createdAt.toISOString(),
        last_seen_at: s.lastSeenAt.toISOString(),
        expires_at: s.expiresAt.toISOString(),
      })),
    };
  }

  @Post('logout')
  @HttpCode(204)
  logout(@Owner() o: OwnerContext) {
    return this.auth.logout(o.session.id);
  }

  @Post('password')
  @HttpCode(204)
  changePassword(@Owner() o: OwnerContext, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(
      o.user,
      dto.current_password,
      dto.new_password,
      o.session.id,
    );
  }

  @Post('totp/setup')
  @HttpCode(200)
  totpSetup(@Owner() o: OwnerContext) {
    return this.auth.totpSetup(o.user);
  }

  @Post('totp/enable')
  @HttpCode(204)
  totpEnable(@Owner() o: OwnerContext, @Body() dto: TotpCodeDto) {
    return this.auth.totpEnable(o.user, dto.code, o.session.id);
  }

  @Post('totp/disable')
  @HttpCode(204)
  totpDisable(@Owner() o: OwnerContext, @Body() dto: TotpDisableDto) {
    return this.auth.totpDisable(o.user, dto.password, dto.code);
  }

  @Post('sessions/:id/revoke')
  @HttpCode(204)
  revokeSession(@Owner() o: OwnerContext, @Param('id') id: string) {
    return this.auth.revokeSession(o.user.id, id);
  }
}
