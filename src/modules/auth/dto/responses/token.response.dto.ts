import { Expose } from 'class-transformer';

/**
 * TOKEN RESPONSE DTO
 *
 * Authentication tokens returned to client.
 *
 * @example
 * {
 *   "accessToken": "eyJhbGciOiJIUzI1NiIs...",
 *   "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
 *   "expiresIn": 900
 * }
 */
export class TokenResponseDto {
  @Expose()
  accessToken!: string;

  @Expose()
  refreshToken!: string;

  @Expose()
  expiresIn!: number; // Seconds until access token expires
}
