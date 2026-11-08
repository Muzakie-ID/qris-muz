import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

export class LoginDto {
  @IsEmail() @MaxLength(200) email!: string;
  @IsString() @IsNotEmpty() @MaxLength(200) password!: string;
}

export class LoginTotpDto {
  @IsString() @IsNotEmpty() @MaxLength(2000) challenge!: string;
  @IsString() @Length(6, 8) code!: string;
}

export class ChangePasswordDto {
  @IsString() @IsNotEmpty() @MaxLength(200) current_password!: string;
  @IsString() @IsNotEmpty() @MaxLength(200) new_password!: string;
}

export class TotpCodeDto {
  @IsString() @Length(6, 8) code!: string;
}

export class TotpDisableDto {
  @IsString() @IsNotEmpty() @MaxLength(200) password!: string;
  @IsString() @Length(6, 8) code!: string;
}
