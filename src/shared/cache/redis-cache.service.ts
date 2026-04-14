import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { ICacheService, CacheOptions } from './cache.interface';
import { ILogger } from '../logger/logger.interface';

/**
 * REDIS CACHE SERVICE
 *
 * - Tag-based invalidation
 * - Automatic fallback on errors
 * - Proper error logging
 * - SCAN instead of KEYS (production-safe)
 * - KEYS blocks Redis for large datasets (DANGER in production)
 * - SCAN iterates safely without blocking
 * - Required for deletePattern() to work safely
 */
@Injectable()
export class RedisCacheService implements ICacheService {
  private readonly logger: ILogger;
  private readonly DEFAULT_TTL = 60 * 15; // 15 minutes

  constructor(
    private readonly redis: RedisService,
    logger: ILogger,
  ) {
    this.logger = logger.child(RedisCacheService.name);
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);
      return value as T;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get cache key ${key}: ${errorMessage}`);
      return null; // Fail open - return null so we execute real logic
    }
  }

  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    try {
      const ttl = options?.ttl ?? this.DEFAULT_TTL;
      const finalKey = options?.prefix ? `${options.prefix}:${key}` : key;

      await this.redis.set(finalKey, value, ttl);

      // Store tag mappings for batch invalidation
      if (options?.tags?.length) {
        await this.storeTagMappings(finalKey, options.tags, ttl);
      }

      this.logger.debug(`Cache set: ${finalKey} (TTL: ${ttl}s)`);
    } catch (error) {
      // Log but don't throw - cache failure shouldn't break the app
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to set cache key ${key}: ${errorMessage}`);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.redis.delete(key);
      await this.cleanupTagMappings(key);
      this.logger.debug(`Cache deleted: ${key}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to delete cache key ${key}: ${errorMessage}`);
    }
  }

  async deleteByTag(tag: string): Promise<void> {
    try {
      // Get all keys with this tag from Redis Set
      const keys = await this.redis.smembers(`tag:${tag}`);

      if (keys.length > 0) {
        // Delete all keys in a pipeline (faster)
        const pipeline = (this.redis as any).pipeline?.();
        if (pipeline) {
          for (const key of keys) {
            pipeline.del(key);
          }
          pipeline.del(`tag:${tag}`);
          await pipeline.exec();
        } else {
          // Fallback if pipeline not available
          for (const key of keys) {
            await this.redis.delete(key);
          }
          await this.redis.delete(`tag:${tag}`);
        }

        this.logger.debug(`Deleted ${keys.length} keys with tag: ${tag}`);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to delete by tag ${tag}: ${errorMessage}`);
    }
  }

  /**
   * Delete keys matching a pattern using SCAN (production-safe)
   *
   * WHY SCAN: KEYS * blocks Redis. SCAN iterates safely.
   *
   * @example deletePattern('products:*') - deletes all product caches
   */
  async deletePattern(pattern: string): Promise<void> {
    try {
      let cursor = '0';
      let deletedCount = 0;
      const redis = (this.redis as any).getClient?.() || this.redis;

      // Use SCAN to iterate safely
      do {
        const reply = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = reply[0];
        const keys = reply[1];

        if (keys.length > 0) {
          await this.redis.deleteMultiple(keys);
          deletedCount += keys.length;
        }
      } while (cursor !== '0');

      this.logger.debug(
        `Deleted ${deletedCount} keys matching pattern: ${pattern}`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to delete pattern ${pattern}: ${errorMessage}`);
    }
  }

  async increment(key: string, amount: number = 1): Promise<number> {
    try {
      return await this.redis.incrBy(key, amount);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to increment key ${key}: ${errorMessage}`);
      return 1; // Safe fallback
    }
  }

  async getTTL(key: string): Promise<number> {
    try {
      return await this.redis.ttl(key);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get TTL for key ${key}: ${errorMessage}`);
      return -2; // -2 means key doesn't exist
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      return await this.redis.exists(key);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to check existence for key ${key}: ${errorMessage}`,
      );
      return false;
    }
  }

  async expire(key: string, ttl: number): Promise<void> {
    try {
      await this.redis.expire(key, ttl);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to set expiration for key ${key}: ${errorMessage}`,
      );
    }
  }

  async clear(): Promise<void> {
    try {
      await this.redis.flushAll();
      this.logger.info('Cache cleared');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to clear cache: ${errorMessage}`);
    }
  }

  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options?: CacheOptions,
  ): Promise<T> {
    const cached = await this.get<T>(key);

    if (cached !== null) {
      this.logger.debug(`Cache hit: ${key}`);
      return cached;
    }

    this.logger.debug(`Cache miss: ${key}, executing factory`);
    const value = await factory();

    if (value !== null && value !== undefined) {
      await this.set(key, value, options);
    }

    return value;
  }

  // ============================================================
  // PRIVATE HELPERS
  // ============================================================

  /**
   * Store tag-to-key mappings for batch invalidation
   *
   * Example: When you cache a product with tag 'products'
   *   sadd('tag:products', 'product:123')
   * Later: deleteByTag('products') finds all product keys and deletes them
   */
  private async storeTagMappings(
    key: string,
    tags: string[],
    ttl: number,
  ): Promise<void> {
    for (const tag of tags) {
      await this.redis.sadd(`tag:${tag}`, key);
      await this.redis.expire(`tag:${tag}`, ttl);
    }
  }

  /**
   * Remove key from all tag sets when the key is deleted
   * Prevents orphaned references
   */
  private async cleanupTagMappings(key: string): Promise<void> {
    try {
      // Find all tags that contain this key using SCAN
      let cursor = '0';
      const redis = (this.redis as any).getClient?.() || this.redis;

      do {
        const reply = await redis.scan(cursor, 'MATCH', 'tag:*', 'COUNT', 100);
        cursor = reply[0];
        const tagKeys = reply[1];

        for (const tagKey of tagKeys) {
          await this.redis.srem(tagKey, key);
        }
      } while (cursor !== '0');
    } catch (error) {
      // Non-critical - don't log as error
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.debug(
        `Failed to cleanup tag mappings for ${key}: ${errorMessage}`,
      );
    }
  }
}
