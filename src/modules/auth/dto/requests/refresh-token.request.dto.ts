import { IsString, IsNotEmpty } from 'class-validator';

/**
 * REFRESH TOKEN REQUEST DTO
 * 
 * Client sends refresh token to get new access token.
 * 
 * @example
 * POST /api/auth/refresh
 * {
 *   "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
 * }
 */
export class RefreshTokenRequestDto {
  @IsString({ message: 'Refresh token must be a string' })
  @IsNotEmpty({ message: 'Refresh token is required' })
  refreshToken!: string;
}