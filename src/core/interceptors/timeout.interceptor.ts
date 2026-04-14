import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  RequestTimeoutException,
} from '@nestjs/common';
import { Observable, throwError, TimeoutError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { EnvironmentService } from 'src/config/env/env.service';

/**
 * TIMEOUT INTERCEPTOR
 *
 * Prevents requests from hanging indefinitely.
 *
 * WHY NEEDED:
 * - Database queries might hang
 * - External API calls might timeout
 * - Prevents resource exhaustion
 *
 * DEFAULT: 30 seconds timeout
 * Can be configured via REQUEST_TIMEOUT env variable
 */
@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  constructor(private env: EnvironmentService) {}

  intercept(_: ExecutionContext, next: CallHandler): Observable<any> {
    // Get timeout from env or default to 30 seconds
    const timeoutMs = this.env.get('REQUEST_TIMEOUT') ?? 30000;

    return next.handle().pipe(
      timeout({ each: timeoutMs }),
      catchError((err) => {
        if (err instanceof TimeoutError) {
          return throwError(
            () =>
              new RequestTimeoutException(
                `Request timeout after ${timeoutMs}ms`,
              ),
          );
        }
        return throwError(() => err);
      }),
    );
  }
}
