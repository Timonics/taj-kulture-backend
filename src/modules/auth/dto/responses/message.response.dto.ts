import { Expose } from 'class-transformer';

/**
 * MESSAGE RESPONSE DTO
 * 
 * Simple message response for operations that don't return data.
 * 
 * @example
 * {
 *   "message": "Verification email sent successfully",
 *   "success": true
 * }
 */
export class MessageResponseDto {
  @Expose()
  message!: string;

  @Expose()
  success: boolean = true;
}