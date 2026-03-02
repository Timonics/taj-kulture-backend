import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { RedisService } from 'src/shared/redis/redis.service';

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  constructor(private redisService: RedisService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const req = context.switchToHttp().getRequest();
    const cacheKey = `cache:${req.url}`;
    const ttl = 60; // 1 minute

    // Try to get from cache
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return of(JSON.parse(cached));
    }

    // If not in cache, proceed and cache the response
    return next.handle().pipe(
      tap(async (data) => {
        await this.redisService.set(cacheKey, JSON.stringify(data), ttl);
      }),
    );
  }
}
