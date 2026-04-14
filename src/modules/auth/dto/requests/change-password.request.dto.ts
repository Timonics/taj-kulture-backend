import {
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsNotEmpty,
  ValidateIf,
} from 'class-validator';

/**
 * CHANGE PASSWORD REQUEST DTO
 *
 * Authenticated user changes their password.
 *
 * @example
 * POST /api/auth/change-password
 * {
 *   "currentPassword": "OldPass123!",
 *   "newPassword": "NewPass456!",
 *   "confirmPassword": "NewPass456!"
 * }
 */
export class ChangePasswordRequestDto {
  @IsString({ message: 'Current password must be a string' })
  @IsNotEmpty({ message: 'Current password is required' })
  currentPassword!: string;

  @IsString({ message: 'New password must be a string' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(32, { message: 'Password cannot exceed 32 characters' })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)/, {
    message: 'Password must contain at least one letter and one number',
  })
  @IsNotEmpty({ message: 'New password is required' })
  newPassword!: string;

  @IsString({ message: 'Confirm password must be a string' })
  @ValidateIf((o) => o.newPassword !== undefined)
  @IsNotEmpty({ message: 'Please confirm your new password' })
  confirmPassword!: string;
}
