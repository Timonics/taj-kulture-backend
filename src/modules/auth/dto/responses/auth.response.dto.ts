import { Expose, Type } from 'class-transformer';
import { UserResponseDto } from './user.response.dto';

/**
 * AUTH RESPONSE DTO
 * 
 * Returned after successful login or registration.
 * 
 * SECURITY: NO TOKENS RETURNED IN BODY
 * - Tokens are set as HttpOnly cookies automatically
 * - Client cannot access tokens via JavaScript
 * - Prevents XSS token theft
 * - Cookies have SameSite=Lax for CSRF protection
 * 
 * @example
 * // Response body (no tokens visible!)
 * {
 *   "success": true,
 *   "data": {
 *     "user": {
 *       "id": "123",
 *       "email": "user@example.com",
 *       "username": "cooluser",
 *       "role": "CUSTOMER"
 *     }
 *   },
 *   "meta": {
 *     "timestamp": "2024-04-02T10:30:00Z"
 *   }
 * }
 * 
 * // Tokens are automatically set as cookies:
 * // Set-Cookie: accessToken=...; HttpOnly; Secure; SameSite=Lax; Max-Age=900
 * // Set-Cookie: refreshToken=...; HttpOnly; Secure; SameSite=Lax; Max-Age=604800
 */

export class AuthResponseDto {
  @Expose()
  @Type(() => UserResponseDto)
  user!: UserResponseDto;

  // NO tokens field - they're set as cookies!
}