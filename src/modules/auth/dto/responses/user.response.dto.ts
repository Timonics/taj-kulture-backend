import { Expose, Exclude } from 'class-transformer';

/**
 * USER RESPONSE DTO
 *
 * Controls what user data is exposed to clients.
 *
 * @example
 * {
 *   "id": "cm8xyz123",
 *   "email": "user@example.com",
 *   "username": "cooluser",
 *   "role": "CUSTOMER",
 *   "firstName": "John",
 *   "lastName": "Doe",
 *   "avatar": "https://..."
 * }
 */
export class UserResponseDto {
  @Expose()
  id!: string;

  @Expose()
  email!: string;

  @Expose()
  username!: string;

  @Expose()
  role!: string;

  @Expose()
  firstName?: string | null;

  @Expose()
  lastName?: string | null;

  @Expose()
  avatar?: string | null;

  @Expose()
  isEmailVerified!: boolean;

  @Expose()
  createdAt!: Date;

  @Expose()
  updatedAt!: Date;

  // These fields are NOT exposed to clients
  @Exclude()
  password?: string | null;

  @Exclude()
  refreshToken!: string | null;

  @Exclude()
  emailVerificationToken!: string | null;

  @Exclude()
  emailVerificationExpires!: Date | null;

  @Exclude()
  passwordResetToken!: string | null;

  @Exclude()
  passwordResetExpires!: Date | null;
}
