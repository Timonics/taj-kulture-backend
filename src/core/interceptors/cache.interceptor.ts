import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { ICacheService } from '../../shared/cache/cache.interface';

// Metadata keys for cache configuration
export const CACHE_KEY = 'cache_key';
export const CACHE_TTL = 'cache_ttl';
export const CACHE_TAGS = 'cache_tags';

/**
 * CACHE INTERCEPTOR
 *
 * Automatically caches GET request responses in Redis.
 *
 * @example
 * HOW TO USE:
 * -@Cacheable({ key: 'products:list', ttl: 300, tags: ['products'] })
 * -@Get()
 * async getProducts() { ... }
 *
 * BENEFITS:
 * - Reduces database load
 * - Speeds up repeated requests
 * - Tag-based invalidation (clear all cache with 'products' tag)
 *
 * IMPORTANT: Only use on READ endpoints, never on POST/PUT/DELETE
 */
@Injectable()
export class CacheInterceptor implements NestInterceptor {
  constructor(
    @Inject('CACHE_SERVICE') private cache: ICacheService,
    private reflector: Reflector,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    // Only cache GET requests
    const request = context.switchToHttp().getRequest();
    if (request.method !== 'GET') {
      return next.handle();
    }

    // Get cache configuration from decorator
    const key = this.reflector.get<string>(CACHE_KEY, context.getHandler());

    if (!key) {
      return next.handle();
    }

    const ttl = this.reflector.get<number>(CACHE_TTL, context.getHandler());
    const tags = this.reflector.get<string[]>(CACHE_TAGS, context.getHandler());

    // Generate cache key with request-specific params (like pagination)
    const cacheKey = this.generateCacheKey(key, request);

    // Try to get from cache
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return of(cached);
    }

    // Cache miss - execute handler and cache result
    return next.handle().pipe(
      tap(async (data) => {
        await this.cache.set(cacheKey, data, { ttl });

        // If tags provided, store mapping for invalidation
        // if (tags && tags.length) {
        //   for (const tag of tags) {
        //     await this.cache.sadd(`cache:tag:${tag}`, cacheKey);
        //   }
        // }
      }),
    );
  }

  /**
   * Generate cache key including request parameters
   *
   * Example: products:list?page=1&limit=10 -> "products:list:page=1:limit=10"
   */
  private generateCacheKey(baseKey: string, request: any): string {
    const query = request.query;
    if (Object.keys(query).length === 0) {
      return baseKey;
    }

    // Sort keys for consistent ordering
    const sortedKeys = Object.keys(query).sort();
    const queryString = sortedKeys
      .map((key) => `${key}=${query[key]}`)
      .join(':');

    return `${baseKey}:${queryString}`;
  }
}
