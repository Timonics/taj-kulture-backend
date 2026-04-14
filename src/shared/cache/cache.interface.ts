/**
 * CACHE SERVICE INTERFACE
 *
 * Defines the contract for all cache operations.
 * Implementations: RedisCacheService (production), MemoryCacheService (fallback)
 *
 * WHY SEPARATE INTERFACE:
 * - Easy to swap implementations (Redis vs Memory)
 * - Easy to mock for unit tests
 * - Clear contract for what cache should do
 */
export interface CacheOptions {
  /** Time to live in seconds (default: 900 = 15 minutes) */
  ttl?: number;

  /** Tags for batch invalidation (e.g., ['products', 'featured']) */
  tags?: string[];

  /** Key prefix for namespacing (e.g., 'auth', 'products') */
  prefix?: string;
}

export interface ICacheService {
  /**
   * Get value from cache
   * @returns The cached value or null if not found/expired
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Set value in cache
   * @param key - Cache key
   * @param value - Value to store
   * @param options - TTL, tags, prefix
   */
  set<T>(key: string, value: T, options?: CacheOptions): Promise<void>;

  /**
   * Delete a single cache key
   */
  delete(key: string): Promise<void>;

  /**
   * Delete all cache keys with a specific tag
   *
   * Used for batch invalidation (e.g., clear all product caches when product updated)
   */
  deleteByTag(tag: string): Promise<void>;

  /**
   * Delete all cache keys matching a pattern
   * @example deletePattern('products:*') - deletes all product caches
   */
  deletePattern(pattern: string): Promise<void>;

  /**
   * Get time-to-live for a key in seconds
   * @returns TTL in seconds, -1 if no TTL, -2 if key doesn't exist
   */
  getTTL(key: string): Promise<number>;

  /**
   * Increment a numeric value atomically
   *
   * Used for rate limiting counters
   * @returns New value after increment
   */
  increment(key: string, amount?: number): Promise<number>;

  /**
   * Check if a key exists in cache
   */
  exists(key: string): Promise<boolean>;

  /**
   * Set expiration for a key in seconds
   */
  expire(key: string, ttl: number): Promise<void>;

  /**
   * Clear ALL cache (use with caution!)
   */
  clear(): Promise<void>;

  /**
   * Get value or execute factory function on cache miss
   *
   * @example
   * const user = await cache.getOrSet(`user:${id}`, async () => {
   *   return await db.user.findUnique({ where: { id } });
   * }, { ttl: 3600 });
   */
  getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options?: CacheOptions,
  ): Promise<T>;
}
