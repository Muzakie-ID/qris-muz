import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class InspectQrisDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  payload!: string;
}

export class CreateDynamicQrisDto {
  @Type(() => Number)
  @IsInt({ message: 'amount harus bilangan bulat rupiah' })
  @Min(1)
  amount!: number;

  /** QRIS statis sumber. Kosongkan untuk memakai QRIS_STATIC_PAYLOAD dari konfigurasi. */
  @IsOptional()
  @IsString()
  @MaxLength(1024)
  payload?: string;
}

export class DynamicQrisImageQuery {
  @Type(() => Number)
  @IsInt({ message: 'amount harus bilangan bulat rupiah' })
  @Min(1)
  amount!: number;
}
