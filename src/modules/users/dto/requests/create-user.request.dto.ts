import { IsEmail, IsString, IsOptional, MinLength, MaxLength, Matches, IsEnum, IsBoolean, IsUrl, IsPhoneNumber } from 'class-validator';
import { UserRole } from 'generated/prisma/client';

export class CreateUserRequestDto {
  @IsEmail({}, { message: 'Please provide a valid email' })
  email!: string;

  @IsString()
  @MinLength(3, { message: 'Username must be at least 3 characters' })
  @MaxLength(20, { message: 'Username cannot exceed 20 characters' })
  @Matches(/^[a-zA-Z0-9_]+$/, { message: 'Username can only contain letters, numbers, and underscores' })
  username!: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(32, { message: 'Password cannot exceed 32 characters' })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)/, { 
    message: 'Password must contain at least one letter and one number' 
  })
  password!: string;

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

  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;

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