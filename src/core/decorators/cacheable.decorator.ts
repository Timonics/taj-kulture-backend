import { SetMetadata, UseInterceptors, applyDecorators } from '@nestjs/common';
import { CacheInterceptor, CACHE_KEY, CACHE_TTL, CACHE_TAGS } from '../interceptors/cache.interceptor';

/**
 * Cache decorator for GET endpoints
 * 
 * @example
 * -@Cacheable({ key: 'products:list', ttl: 300, tags: ['products'] })
 * -@Get()
 * -async getProducts() { ... }
 * 
 * @example
 * // Invalidate cache when data changes
 * -@Post()
 * -async createProduct() {
 *   await this.cache.invalidateByTag('products');
 * }
 */
export function Cacheable(options: { 
  key: string; 
  ttl?: number;  // Time to live in seconds (default: 300)
  tags?: string[]; // For batch invalidation
}) {
  return applyDecorators(
    SetMetadata(CACHE_KEY, options.key),
    SetMetadata(CACHE_TTL, options.ttl || 300),
    SetMetadata(CACHE_TAGS, options.tags || []),
    UseInterceptors(CacheInterceptor),
  );
}