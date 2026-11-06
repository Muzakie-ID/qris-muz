import {
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateTransactionDto {
  @IsInt({ message: 'amount harus bilangan bulat rupiah' })
  @Min(1)
  amount!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  merchant_ref!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  expiry_min?: number;

  @IsOptional()
  @IsUrl({
    require_tld: false,
    protocols: ['http', 'https'],
    require_protocol: true,
  })
  @MaxLength(2048)
  return_url?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  qris_source_id?: string;
}

export class ConfirmTransactionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
