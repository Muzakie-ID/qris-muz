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
