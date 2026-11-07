import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { DEVICE_COMMANDS, type DeviceCommand } from '../db/schema';

export class RegisterDeviceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  token!: string;
}

export class NotificationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  package!: string;

  @IsOptional() @IsString() @MaxLength(1000) title?: string;
  @IsOptional() @IsString() @MaxLength(4000) text?: string;
  @IsOptional() @IsString() @MaxLength(4000) big_text?: string;
  @IsOptional() @IsString() @MaxLength(1000) sub_text?: string;

  @IsInt()
  @Min(0)
  posted_at!: number;

  @IsOptional() @IsString() @MaxLength(500) notification_key?: string;
  @IsOptional() @IsString() @MaxLength(100) app_version?: string;
  @IsOptional() @IsInt() @Min(0) captured_at?: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  hash!: string;

  @IsOptional() @IsBoolean() is_test?: boolean;
}

export class EventsBatchDto {
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => NotificationDto)
  events!: NotificationDto[];
}

export class HeartbeatDto {
  @IsBoolean()
  listener_ok!: boolean;

  @IsOptional() @IsInt() @Min(0) @Max(100) battery?: number;
  @IsOptional() @IsBoolean() charging?: boolean;
  @IsOptional() @IsInt() @Min(0) queued?: number;
  @IsOptional() @IsObject() source_app_versions?: Record<string, string>;
  @IsOptional() @IsString() @MaxLength(50) app_version?: string;
  @IsOptional() @IsString() @MaxLength(4000) last_crash?: string;
}

export class DeviceCommandDto {
  @IsIn(DEVICE_COMMANDS)
  command!: DeviceCommand;
}

export class PairingTokenDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  device_name!: string;
}
