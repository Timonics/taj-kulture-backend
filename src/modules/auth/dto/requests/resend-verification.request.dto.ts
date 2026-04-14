import { IsEmail, IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * RESEND VERIFICATION EMAIL REQUEST DTO
 *
 * Client requests new verification email.

 * - Token expires after 24 hours
 *
 * RATE LIMITING:
 * - Limit to 3 requests per hour per email
 * - Prevents abuse/spam
 *
 * @example
 * POST /api/auth/resend-verification
 * {
 *   "email": "user@example.com"
 * }
 */
export class ResendVerificationRequestDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;
}
