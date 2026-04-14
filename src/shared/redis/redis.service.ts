import { Injectable, Logger, OnModuleDestroy, Inject } from '@nestjs/common';
import { REDIS_CLIENT, RedisClient, RedisHealthCheck } from './redis.interface';

/**
 * Redis configuration interface
 */
interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  keyPrefix: string;
  retryAttempts: number;
  retryDelay: number;
}

/**
 * REDIS SERVICE - Production Grade Redis Client
 *
 * WHAT IT DOES:
 * - Manages Redis connections for caching, queues, and rate limiting
 * - Provides a clean, typed API for all Redis operations
 * - Handles connection pooling, reconnection, and error recovery
 *
 * WHY SEPARATE SERVICE:
 * - Single source of truth for Redis operations
 * - Easy to mock for testing
 * - Centralized error handling and logging
 * - Can swap Redis libraries without changing app code
 *
 * USED BY:
 * - Cache Module (for storing cached responses)
 * - Queue Module (Bull/BullMQ for background jobs)
 * - Rate Limiting (login attempts, API throttling)
 * - Session Management (if needed)
 *
 * CONNECTION STRATEGY:
 * - Single client for most operations (efficient)
 * - Separate subscriber client for Pub/Sub (if needed)
 * - Automatic reconnection with exponential backoff
 * - Connection pool for high throughput scenarios
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly client: RedisClient) {}

  /**
   * Gracefully close Redis connections on app shutdown
   *
   * WHY ON_MODULE_DESTROY: Prevents data loss and connection leaks
   * Quit waits for all commands to finish before closing
   */
  async onModuleDestroy(): Promise<void> {
    this.logger.log('Closing Redis connection...');
    await this.client.quit();
    this.logger.log('Redis connection closed');
  }

  /**
   * Check if Redis is connected
   * Used for health checks and graceful degradation
   */
  isReady(): boolean {
    return this.client?.status === 'ready';
  }

  // ============================================================
  // STRING OPERATIONS - Most common Redis operations
  // ============================================================

  /**
   * Get value by key
   * @returns Parsed JSON value or null if not found
   */
  async get<T = any>(key: string): Promise<T | null> {
    if (!this.client) return null;

    try {
      const value = await this.client.get(key);
      if (!value) return null;

      // Attempt to parse JSON, fallback to string
      try {
        return JSON.parse(value) as T;
      } catch {
        return value as T;
      }
    } catch (error) {
      this.logger.error(
        `Failed to get key ${key}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  /**
   * Set key-value pair with optional TTL
   *
   * @param key - Cache key
   * @param value - Value to store (automatically JSON stringified)
   * @param ttl - Time to live in seconds (optional)
   */
  async set(key: string, value: any, ttl?: number): Promise<void> {
    if (!this.client) return;

    try {
      const serialized =
        typeof value === 'string' ? value : JSON.stringify(value);

      if (ttl) {
        await this.client.set(key, serialized, 'EX', ttl);
      } else {
        await this.client.set(key, serialized);
      }
    } catch (error) {
      this.logger.error(
        `Failed to set key ${key}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Delete one or more keys
   * @returns Number of keys deleted
   */
  async delete(key: string): Promise<number>;
  async delete(keys: string[]): Promise<number>;
  async delete(keys: string | string[]): Promise<number> {
    if (!this.client) return 0;

    try {
      const keyArray = Array.isArray(keys) ? keys : [keys];
      if (keyArray.length === 0) return 0;

      return await this.client.del(...keyArray);
    } catch (error) {
      this.logger.error(
        `Failed to delete key: ${error instanceof Error ? error.message : String(error)}`,
      );

      return 0;
    }
  }

  /**
   * Delete multiple keys in a single command (alias for delete with array)
   */
  async deleteMultiple(keys: string[]): Promise<number> {
    return this.delete(keys);
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    if (!this.client) return false;

    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      this.logger.error(
        `Failed to check existence for ${key}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  /**
   * Get time-to-live for a key in seconds
   * @returns -1 if no TTL, -2 if key doesn't exist
   */
  async ttl(key: string): Promise<number> {
    if (!this.client) return -2;

    try {
      return await this.client.ttl(key);
    } catch (error) {
      this.logger.error(
        `Failed to get key ${key}: ${error instanceof Error ? error.message : String(error)}`,
      );

      return -2;
    }
  }

  /**
   * Set expiration on existing key
   * @returns true if successful
   */
  async expire(key: string, seconds: number): Promise<boolean> {
    if (!this.client) return false;

    try {
      const result = await this.client.expire(key, seconds);
      return result === 1;
    } catch (error) {
      this.logger.error(
        `Failed to get key ${key}: ${error instanceof Error ? error.message : String(error)}`,
      );

      return false;
    }
  }

  /**
   * Increment a numeric value by 1
   * Used for counters, rate limiting, etc.
   */
  async incr(key: string): Promise<number> {
    if (!this.client) return 1;

    try {
      return await this.client.incr(key);
    } catch (error) {
      this.logger.error(
        `Failed to get key ${key}: ${error instanceof Error ? error.message : String(error)}`,
      );

      return 1;
    }
  }

  /**
   * Increment a numeric value by a specific amount
   */
  async incrBy(key: string, increment: number): Promise<number> {
    if (!this.client) return increment;

    try {
      return await this.client.incrby(key, increment);
    } catch (error) {
      this.logger.error(
        `Failed to increment ${key} by ${increment}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return increment;
    }
  }

  // ============================================================
  // SET OPERATIONS - For tag management and uniqueness
  // ============================================================

  /**
   * Add members to a set (creates set if doesn't exist)
   * @returns Number of members added (excluding existing)
   */
  async sadd(key: string, ...members: string[]): Promise<number> {
    if (!this.client) return members.length;

    try {
      return await this.client.sadd(key, ...members);
    } catch (error) {
      this.logger.error(
        `Failed to get key ${key}: ${error instanceof Error ? error.message : String(error)}`,
      );

      return 0;
    }
  }

  /**
   * Remove members from a set
   * @returns Number of members removed
   */
  async srem(key: string, ...members: string[]): Promise<number> {
    if (!this.client) return members.length;

    try {
      return await this.client.srem(key, ...members);
    } catch (error) {
      this.logger.error(
        `Failed to get key ${key}: ${error instanceof Error ? error.message : String(error)}`,
      );

      return 0;
    }
  }

  /**
   * Get all members of a set
   */
  async smembers(key: string): Promise<string[]> {
    if (!this.client) return [];

    try {
      return await this.client.smembers(key);
    } catch (error) {
      this.logger.error(
        `Failed to get set members for ${key}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }

  // ============================================================
  // KEY MANAGEMENT - For scanning and batch operations
  // ============================================================

  /**
   * Find keys matching a pattern using SCAN (production-safe)
   *
   * WHY SCAN INSTEAD OF KEYS:
   * - KEYS blocks Redis - DANGER in production
   * - SCAN iterates safely without blocking
   * - Use for admin operations only, not in hot paths
   *
   * @param pattern - Pattern like 'user:*' or 'session:*'
   * @param count - Number of keys to scan per iteration (default 100)
   * @returns Array of matching keys
   */
  async keys(pattern: string, count: number = 100): Promise<string[]> {
    if (!this.client) return [];

    const keys: string[] = [];
    let cursor = '0';

    try {
      do {
        const result = await this.client.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          count,
        );
        cursor = result[0];
        keys.push(...result[1]);
      } while (cursor !== '0');

      return keys;
    } catch (error) {
      this.logger.error(
        `Failed to scan keys with pattern ${pattern}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }

  /**
   * Delete all keys matching a pattern
   *
   * WARNING: Use with caution - can delete many keys at once
   *
   * @example deleteByPattern('session:*') - Clears all sessions
   */
  async deleteByPattern(pattern: string): Promise<number> {
    const keys = await this.keys(pattern);
    if (keys.length === 0) return 0;

    return this.delete(keys);
  }

  /**
   * Clear ALL keys in the current Redis database
   *
   * WARNING: Destructive operation - only use in tests!
   */
  async flushAll(): Promise<void> {
    if (!this.client) return;

    try {
      await this.client.flushall();
      this.logger.warn('Redis database flushed (all keys deleted)');
    } catch (error) {
      this.logger.error(
        `Failed to flush all keys: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // ============================================================
  // PIPELINE OPERATIONS - For batch operations (performance)
  // ============================================================

  /**
   * Create a Redis pipeline for batch operations
   *
   * WHY USE PIPELINE:
   * - Reduces network round trips
   * - Executes multiple commands atomically
   * - Much faster for bulk operations
   *
   * @example
   * const pipeline = redis.pipeline();
   * pipeline.set('key1', 'value1');
   * pipeline.set('key2', 'value2');
   * pipeline.incr('counter');
   * await pipeline.exec();
   */
  pipeline(): any {
    if (!this.client) {
      // Return mock pipeline for fallback
      return {
        set: () => this.pipeline(),
        del: () => this.pipeline(),
        incr: () => this.pipeline(),
        exec: async () => [],
      };
    }

    return this.client.pipeline();
  }

  // ============================================================
  // HEALTH CHECK - For monitoring
  // ============================================================

  /**
   * Perform health check on Redis connection
   * Used by /health endpoint and monitoring systems
   */
  async healthCheck(): Promise<RedisHealthCheck> {
    if (!this.isReady()) {
      return { status: 'down', error: 'Redis client not ready' };
    }

    const start = Date.now();
    try {
      await this.client.ping();
      return { status: 'up', latency: Date.now() - start };
    } catch (error) {
      return {
        status: 'down',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get Redis server info (version, memory usage, etc.)
   * Used for monitoring dashboards
   */
  async getInfo(): Promise<Record<string, any>> {
    try {
      const info = await (this.client as any).info?.();
      if (!info) return {};

      const lines = info.split('\r\n');
      const result: Record<string, any> = {};

      for (const line of lines) {
        if (line && !line.startsWith('#')) {
          const [key, value] = line.split(':');
          if (key && value) {
            result[key] = value;
          }
        }
      }

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to get info: ${error instanceof Error ? error.message : String(error)}`,
      );

      return {};
    }
  }
}
