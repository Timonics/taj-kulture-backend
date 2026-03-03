import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ICacheService } from '../../shared/cache/cache.interface';
import { Reflector } from '@nestjs/core';

export const CACHE_KEY = 'cache_key';
export const CACHE_TTL = 'cache_ttl';
export const CACHE_TAGS = 'cache_tags';

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  constructor(
    @Inject('CACHE_SERVICE') private cache: ICacheService,
    private reflector: Reflector,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const key = this.reflector.get<string>(CACHE_KEY, context.getHandler());
    
    if (!key) {
      return next.handle();
    }

    const ttl = this.reflector.get<number>(CACHE_TTL, context.getHandler());
    const tags = this.reflector.get<string[]>(CACHE_TAGS, context.getHandler());

    // Try to get from cache
    const cached = await this.cache.get(key);
    if (cached) {
      return of(cached);
    }

    // Cache miss - execute handler
    return next.handle().pipe(
      tap(async (data) => {
        await this.cache.set(key, data, { ttl, tags });
      }),
    );
  }
}

// Decorators for easy use
import { SetMetadata, UseInterceptors, applyDecorators } from '@nestjs/common';

export function Cacheable(options: { key: string; ttl?: number; tags?: string[] }) {
  return applyDecorators(
    SetMetadata(CACHE_KEY, options.key),
    SetMetadata(CACHE_TTL, options.ttl),
    SetMetadata(CACHE_TAGS, options.tags || []),
    UseInterceptors(CacheInterceptor),
  );
}