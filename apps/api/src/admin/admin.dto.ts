import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

const URL_OPTS = {
  require_tld: false,
  protocols: ['http', 'https'],
  require_protocol: true,
};

export class CreateProjectDto {
  @IsString() @IsNotEmpty() @MaxLength(100) name!: string;
  @IsOptional() @IsUrl(URL_OPTS) webhook_url?: string;
  @IsOptional() @IsUrl(URL_OPTS) default_return_url?: string;
  @IsOptional() @IsString() default_qris_source_id?: string;
  @IsOptional() @IsInt() @Min(1) @Max(1440) default_expiry_min?: number;
}

export class UpdateProjectDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(100) name?: string;
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUrl(URL_OPTS)
  webhook_url?: string | null;
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUrl(URL_OPTS)
  default_return_url?: string | null;
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  default_qris_source_id?: string | null;
  @IsOptional() @IsInt() @Min(1) @Max(1440) default_expiry_min?: number;
}

export class CreateQrisSourceDto {
  @IsString() @IsNotEmpty() @MaxLength(100) label!: string;
  @IsString() @IsNotEmpty() @MaxLength(1024) payload!: string;
  @IsOptional() @IsString() @MaxLength(200) source_package?: string;
}

export class UpdateQrisSourceDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(100) label?: string;
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(200)
  source_package?: string | null;
  @IsOptional() @IsBoolean() is_active?: boolean;
}

export class ListEventsQuery {
  @IsOptional() @IsIn(['PARSED', 'UNPARSED', 'IGNORED']) parse_status?:
    'PARSED' | 'UNPARSED' | 'IGNORED';
  @IsOptional()
  @IsIn(['PENDING', 'MATCHED', 'LATE_MATCHED', 'UNMATCHED', 'NOT_APPLICABLE'])
  match_status?:
    'PENDING' | 'MATCHED' | 'LATE_MATCHED' | 'UNMATCHED' | 'NOT_APPLICABLE';
}

export class ListTransactionsQueryDto {
  @IsOptional()
  @IsIn(['PENDING', 'PAID', 'EXPIRED', 'CANCELLED', 'LATE_PAID'])
  status?: 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED' | 'LATE_PAID';

  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @IsOptional() @IsString() project_id?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  per_page?: number;
}

export class TestTransactionDto {
  @IsInt() @Min(1) @Max(1_000_000) amount!: number;
  @IsOptional() @IsString() project_id?: string;
}

export class PageQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  per_page?: number;
}

export class ListPaymentEventsQueryDto extends PageQueryDto {
  @IsOptional() @IsIn(['PARSED', 'UNPARSED', 'IGNORED']) parse_status?:
    'PARSED' | 'UNPARSED' | 'IGNORED';
  @IsOptional()
  @IsIn(['PENDING', 'MATCHED', 'LATE_MATCHED', 'UNMATCHED', 'NOT_APPLICABLE'])
  match_status?:
    'PENDING' | 'MATCHED' | 'LATE_MATCHED' | 'UNMATCHED' | 'NOT_APPLICABLE';
}

export class ListWebhookDeliveriesQueryDto extends PageQueryDto {
  @IsOptional() @IsIn(['PENDING', 'DELIVERED', 'FAILED']) status?:
    'PENDING' | 'DELIVERED' | 'FAILED';
}

export class CreateParserDto {
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(200)
  package_name?: string | null;
  @IsString() @IsNotEmpty() @MaxLength(500) pattern!: string;
  @IsOptional() @IsInt() @Min(0) @Max(10_000) priority?: number;
  @IsOptional() @IsBoolean() auto_match?: boolean;
  @IsOptional() @IsBoolean() is_active?: boolean;
}

export class UpdateParserDto {
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(200)
  package_name?: string | null;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(500) pattern?: string;
  @IsOptional() @IsInt() @Min(0) @Max(10_000) priority?: number;
  @IsOptional() @IsBoolean() auto_match?: boolean;
  @IsOptional() @IsBoolean() is_active?: boolean;
}

export class TestParserDto {
  @IsOptional() @IsString() @MaxLength(200) package_name?: string;
  @IsOptional() @IsString() @MaxLength(500) title?: string;
  @IsString() @IsNotEmpty() @MaxLength(2000) text!: string;
  @IsOptional() @IsString() @MaxLength(500) pattern?: string;
}
