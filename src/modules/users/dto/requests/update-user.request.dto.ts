import { PartialType, OmitType } from '@nestjs/mapped-types';
import {
  IsString,
  IsOptional,
  MinLength,
  IsUrl,
  IsPhoneNumber,
  MaxLength,
  IsBoolean,
} from 'class-validator';
import { CreateUserRequestDto } from './create-user.request.dto';

export class UpdateUserRequestDto extends PartialType(
  OmitType(CreateUserRequestDto, [
    'email',
    'username',
    'password',
    'role',
  ] as const),
) {
  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(50)
  firstName?: string;

  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(50)
  lastName?: string;

  @IsUrl()
  @IsOptional()
  avatar?: string;

  @IsPhoneNumber()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  bio?: string;

  @IsString()
  @IsOptional()
  location?: string;

  @IsUrl()
  @IsOptional()
  website?: string;

  @IsBoolean()
  @IsOptional()
  isEmailVerified?: boolean;
}
