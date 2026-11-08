import { SkipThrottle } from '@nestjs/throttler';
import { Controller, Get } from '@nestjs/common';

@SkipThrottle()
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok' };
  }
}
