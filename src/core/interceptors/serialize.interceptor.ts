
import {
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Injectable,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { plainToInstance } from 'class-transformer';

/**
 * SERIALIZE INTERCEPTOR
 * 
 * Automatically transforms response data using class-transformer.
 * 
 * WHY NEEDED:
 * - Excludes sensitive fields (passwords, tokens)
 * - Transforms dates to ISO strings
 * - Renames fields if needed
 * - Applies -@Expose() and -@Exclude() decorators
 * 
 * @example
 * -@Serialize(UserResponseDto)
 * -@Get(':id')
 * -async getUser() { ... }
 * 
 * // UserResponseDto has -@Exclude() on password field
 * // Response will NOT include password
 */
@Injectable()
export class SerializeInterceptor implements NestInterceptor {
  constructor(private dto: any) {}

  intercept(_: ExecutionContext, handler: CallHandler): Observable<any> {
    return handler.handle().pipe(
      map((data: any) => {
        // Handle paginated responses (data might be wrapped)
        if (data && data.data && Array.isArray(data.data)) {
          return {
            ...data,
            data: plainToInstance(this.dto, data.data, {
              excludeExtraneousValues: true, // Only include @Expose() fields
            }),
          };
        }
        
        // Handle single object response
        return plainToInstance(this.dto, data, {
          excludeExtraneousValues: true,
        });
      }),
    );
  }
}