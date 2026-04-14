import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request } from 'express';
import { ApiResponse } from '../interfaces/api-response.interface';

/**
 * TRANSFORM INTERCEPTOR
 *
 * Wraps ALL successful responses in a consistent format.
 *
 * WHY NEEDED:
 * - Your error filter formats errors consistently
 * - This formats success responses consistently
 * - Frontend can rely on { success, data, meta } structure
 *
 * @example
 * RESPONSE FORMAT:
 * {
 *   "success": true,
 *   "data": { ... },
 *   "meta": {
 *     "timestamp": "2024-01-01T00:00:00Z",
 *     "path": "/api/users",
 *     "page": 1,
 *     "total": 100
 *   }
 * }
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const now = Date.now();

    return next.handle().pipe(
      map((response) => {
        // Check if response is already paginated format
        if (
          response &&
          typeof response === 'object' &&
          'data' in response &&
          'meta' in response &&
          response.meta?.page !== undefined
        ) {
          return {
            success: true,
            data: response.data,
            meta: {
              timestamp: new Date().toISOString(),
              path: request.url,
              responseTime: `${Date.now() - now}ms`,
              ...response.meta,
            },
          };
        }

        // Regular non-paginated response
        return {
          success: true,
          data: response,
          meta: {
            timestamp: new Date().toISOString(),
            path: request.url,
            responseTime: `${Date.now() - now}ms`,
          },
        };
      }),
    );
  }
}
