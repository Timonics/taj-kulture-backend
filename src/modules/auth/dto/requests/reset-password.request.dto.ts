import {
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsNotEmpty,
  ValidateIf,
} from 'class-validator';

/**
 * RESET PASSWORD REQUEST DTO
 *
 * Client sends new password with reset token.
 *
 * SECURITY:
 * - Token is JWT with 1 hour expiry
 * - Token contains user ID and purpose='password-reset'
 * - Token is one-time use (invalidated after reset)
 *
 * @example
 * POST /api/auth/reset-password
 * {
 *   "token": "eyJhbGciOiJIUzI1NiIs...",
 *   "newPassword": "NewSecurePass123!",
 *   "confirmPassword": "NewSecurePass123!"
 * }
 */
export class ResetPasswordRequestDto {
  @IsString({ message: 'Token must be a string' })
  @IsNotEmpty({ message: 'Reset token is required' })
  token!: string;

  @IsString({ message: 'Password must be a string' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(32, { message: 'Password cannot exceed 32 characters' })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)/, {
    message: 'Password must contain at least one letter and one number',
  })
  @IsNotEmpty({ message: 'New password is required' })
  newPassword!: string;

  @IsString({ message: 'Confirm password must be a string' })
  @ValidateIf((o) => o.newPassword !== undefined)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)/, {
    message: 'Password must contain at least one letter and one number',
  })
  @IsNotEmpty({ message: 'Please confirm your password' })
  confirmPassword!: string;

  // Custom validation method (called by class-validator)
  validatePasswordsMatch() {
    if (this.newPassword !== this.confirmPassword) {
      throw new Error('Passwords do not match');
    }
    return true;
  }
}
