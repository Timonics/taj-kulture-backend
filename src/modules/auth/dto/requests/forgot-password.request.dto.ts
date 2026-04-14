import { IsEmail, IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * FORGOT PASSWORD REQUEST DTO
 * 
 * Client sends email to receive password reset link.
 * 
 * @example
 * POST /api/auth/forgot-password
 * {
 *   "email": "user@example.com"
 * }
 */
export class ForgotPasswordRequestDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;
}