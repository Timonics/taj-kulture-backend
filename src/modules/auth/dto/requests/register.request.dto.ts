import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsOptional,
  IsNotEmpty,
} from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * REGISTER REQUEST DTO
 * 
 * Validates and transforms incoming registration data from clients.
 * 
 * @example
 * POST /api/auth/register
 * {
 *   "email": "user@example.com",
 *   "username": "cooluser",
 *   "password": "SecurePass123!",
 *   "firstName": "John",
 *   "lastName": "Doe"
 * }
 */
export class RegisterRequestDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;

  @IsString({ message: 'Username must be a string' })
  @MinLength(3, { message: 'Username must be at least 3 characters long' })
  @MaxLength(20, { message: 'Username cannot exceed 20 characters' })
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Username can only contain letters, numbers, and underscores',
  })
  @Transform(({ value }) => value?.toLowerCase().trim())
  @IsNotEmpty({ message: 'Username is required' })
  username!: string;

  @IsString({ message: 'Password must be a string' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(32, { message: 'Password cannot exceed 32 characters' })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])?[A-Za-z\d@$!%*?&]+$/, {
    message: 'Password must contain at least 1 letter, 1 number, and optionally 1 special character',
  })
  @IsNotEmpty({ message: 'Password is required' })
  password!: string;

  @IsString({ message: 'First name must be a string' })
  @MinLength(2, { message: 'First name must be at least 2 characters' })
  @MaxLength(50, { message: 'First name cannot exceed 50 characters' })
  @IsOptional()
  firstName?: string;

  @IsString({ message: 'Last name must be a string' })
  @MinLength(2, { message: 'Last name must be at least 2 characters' })
  @MaxLength(50, { message: 'Last name cannot exceed 50 characters' })
  @IsOptional()
  lastName?: string;
}