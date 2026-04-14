import { Expose } from 'class-transformer';


/**
 * LOGOUT RESPONSE DTO
 * 
 * Returned after successful logout.
 * 
 * @example
 * {
 *   "success": true,
 *   "message": "Logged out successfully"
 * }
 */
export class LogoutResponseDto {
  @Expose()
  success: boolean = true;

  @Expose()
  message: string = 'Logged out successfully';
}