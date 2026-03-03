// src/shared/cache/redis-cache.service.ts
import { Inject, Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { ICacheService, CacheOptions } from './cache.interface';

@Injectable()
export class RedisCacheService implements ICacheService {
  private readonly logger = new Logger(RedisCacheService.name);
  private readonly DEFAULT_TTL = 60 * 15; // 15 minutes

  constructor(@Inject('REDIS_CLIENT') private readonly redis: RedisService) {}

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);
      return value as T;
    } catch (error) {
      this.logger.error(`Failed to get cache key ${key}: ${error.message}`);
      return null;
    }
  }

  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    try {
      const ttl = options?.ttl || this.DEFAULT_TTL;
      const finalKey = options?.prefix ? `${options.prefix}:${key}` : key;

      await this.redis.set(finalKey, value, ttl);

      // Store tag mappings if provided
      if (options?.tags?.length) {
        await this.storeTagMappings(finalKey, options.tags, ttl);
      }
    } catch (error) {
      this.logger.error(`Failed to set cache key ${key}: ${error.message}`);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.redis.delete(key);

      // Also clean up tag mappings (could be done asynchronously)
      await this.cleanupTagMappings(key);
    } catch (error) {
      this.logger.error(`Failed to delete cache key ${key}: ${error.message}`);
    }
  }

  async deleteByTag(tag: string): Promise<void> {
    try {
      // Get all keys with this tag
      const keys = await this.redis.smembers(`tag:${tag}`);

      if (keys.length > 0) {
        // Delete all keys
        for (const key of keys) {
          await this.redis.delete(key);
        }

        // Delete the tag set
        await this.redis.delete(`tag:${tag}`);

        this.logger.debug(`Deleted ${keys.length} keys with tag: ${tag}`);
      }
    } catch (error) {
      this.logger.error(`Failed to delete by tag ${tag}: ${error.message}`);
    }
  }

  async deletePattern(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(pattern);

      if (keys.length > 0) {
        for (const key of keys) {
          await this.redis.delete(key);
        }

        this.logger.debug(
          `Deleted ${keys.length} keys matching pattern: ${pattern}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to delete pattern ${pattern}: ${error.message}`,
      );
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      return await this.redis.exists(key);
    } catch (error) {
      this.logger.error(
        `Failed to check existence for key ${key}: ${error.message}`,
      );
      return false;
    }
  }

  async clear(): Promise<void> {
    try {
      await this.redis.flushAll();
      this.logger.log('Cache cleared');
    } catch (error) {
      this.logger.error(`Failed to clear cache: ${error.message}`);
    }
  }

  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options?: CacheOptions,
  ): Promise<T> {
    const cached = await this.get<T>(key);

    if (cached !== null) {
      return cached;
    }

    const value = await factory();

    if (value !== null && value !== undefined) {
      await this.set(key, value, options);
    }

    return value;
  }

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

  private async cleanupTagMappings(key: string): Promise<void> {
    // Find all tags containing this key and remove it
    const tagKeys = await this.redis.keys('tag:*');

    for (const tagKey of tagKeys) {
      await this.redis.srem(tagKey, key);
    }
  }
}
