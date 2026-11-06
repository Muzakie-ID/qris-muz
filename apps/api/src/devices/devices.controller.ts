import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { PaymentsService } from '../payments/payments.service';
import { CurrentDevice, DeviceSignatureGuard } from './device-signature.guard';
import { EventsBatchDto, HeartbeatDto, RegisterDeviceDto } from './devices.dto';
import { DevicesService, type Device } from './devices.service';

type Ctx = { device: Device; timestamp: number };

/** API untuk HP listener. Semua kecuali register wajib ditandatangani HMAC. */
@Controller('device')
export class DevicesController {
  constructor(
    private readonly devices: DevicesService,
    private readonly payments: PaymentsService,
  ) {}

  @Post('register')
  register(@Body() dto: RegisterDeviceDto) {
    return this.devices.register(dto.token);
  }

  @Post('events')
  @HttpCode(200)
  @UseGuards(DeviceSignatureGuard)
  events(@CurrentDevice() { device }: Ctx, @Body() dto: EventsBatchDto) {
    return this.payments.ingest(device.id, dto.events);
  }

  @Post('heartbeat')
  @HttpCode(200)
  @UseGuards(DeviceSignatureGuard)
  heartbeat(
    @CurrentDevice() { device, timestamp }: Ctx,
    @Body() dto: HeartbeatDto,
  ) {
    return this.devices.heartbeat(device, dto, timestamp);
  }

  @Get('config')
  @UseGuards(DeviceSignatureGuard)
  config() {
    return this.devices.configFor();
  }
}
