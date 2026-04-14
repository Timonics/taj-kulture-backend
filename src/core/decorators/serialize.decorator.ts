import { UseInterceptors } from '@nestjs/common';
import { SerializeInterceptor } from '../interceptors/serialize.interceptor';

/**
 * Serialize decorator - excludes sensitive fields from response
 * 
 * @example
 * -class UserResponseDto {
 *   -@Expose()
 *   id: string;
 *   
 *   -@Expose() 
 *   email: string;
 *   
 *   -@Exclude()
 *   password: string; // Won't be sent to client
 * }
 * 
 * -@Serialize(UserResponseDto)
 * -@Get('profile')
 * -getProfile() { ... }
 */
export function Serialize(dto: any) {
  return UseInterceptors(new SerializeInterceptor(dto));
}