import { IsEmail, IsString, MinLength, IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * LOGIN REQUEST DTO
 * 
 * Validates user login credentials.
 * 
 * @example
 * POST /api/auth/login
 * {
 *   "email": "user@example.com",
 *   "password": "SecurePass123!"
 * }
 */
export class LoginRequestDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;

  @IsString({ message: 'Password must be a string' })
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @IsNotEmpty({ message: 'Password is required' })
  password!: string;
}