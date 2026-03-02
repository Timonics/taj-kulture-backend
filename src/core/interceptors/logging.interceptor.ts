import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private logger = new Logger('API');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const { method, url, correlationId } = req;
    const now = Date.now();

    return next.handle().pipe(
      tap({
        next: (data) => {
          this.logger.log(
            JSON.stringify({
              correlationId,
              method,
              url,
              responseTime: `${Date.now() - now}ms`,
              success: true,
            }),
          );
        },
        error: (error) => {
          this.logger.error(
            JSON.stringify({
              correlationId,
              method,
              url,
              responseTime: `${Date.now() - now}ms`,
              error: error.message,
              status: error.status,
            }),
          );
        },
      }),
    );
  }
}
