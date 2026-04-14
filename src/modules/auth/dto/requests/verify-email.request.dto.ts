import { IsString, IsNotEmpty } from 'class-validator';

/**
 * VERIFY EMAIL REQUEST DTO
 *
 * Client sends verification token from email link.
 *
 * WHY QUERY PARAMETER:
 * - User clicks link in email: /auth/verify-email?token=xxx
 * - GET request with query parameter is more user-friendly
 * - No body needed for simple token verification
 *
 * @example
 * GET /api/auth/verify-email?token=eyJhbGciOiJIUzI1NiIs...
 */
export class VerifyEmailRequestDto {
  @IsString({ message: 'Verification token must be a string' })
  @IsNotEmpty({ message: 'Verification token is required' })
  token!: string;
}
