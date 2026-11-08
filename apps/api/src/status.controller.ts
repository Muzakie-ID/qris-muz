import { Throttle } from '@nestjs/throttler';
import { Controller, Get, UseGuards } from '@nestjs/common';
import { DevicesService } from './devices/devices.service';
import { ApiKeyGuard } from './projects/api-key.guard';

/** Status sistem untuk proyek klien: apakah konfirmasi otomatis sedang berjalan. */
@Throttle({ default: { limit: 600, ttl: 60_000 } })
@Controller('v1/status')
@UseGuards(ApiKeyGuard)
export class StatusController {
  constructor(private readonly devices: DevicesService) {}

  @Get()
  async status() {
    const s = await this.devices.listenerStatus();
    return {
      listener_online: s.listener_online,
      confirmation: s.confirmation,
      last_heartbeat_at:
        s.devices
          .map((d) => d.last_heartbeat_at)
          .filter((x): x is string => !!x)
          .sort()
          .at(-1) ?? null,
      server_time: s.server_time,
    };
  }
}
