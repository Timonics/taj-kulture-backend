import { Injectable, Logger } from '@nestjs/common';
import { EnvironmentService } from 'src/config/env/env.service';

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  keyPrefix: string;
  retryAttempts: number;
  retryDelay: number;
  enabled: boolean;
  url?: string;
}

/**
 * REDIS CONFIGURATION
 *
 * Single responsibility: Load and validate Redis configuration from environment
 *
 * WHY SEPARATE:
 * - Configuration logic is complex (URL parsing, fallbacks, validation)
 * - Can be tested independently
 * - Reused by both client factory and service
 */
@Injectable()
export class RedisConfigLoader {
  private readonly logger = new Logger(RedisConfigLoader.name);

  constructor(private env: EnvironmentService) {}

  /**
   * Load Redis configuration from environment variables
   *
   * Priority order:
   * 1. Check if Redis is enabled (REDIS_ENABLED)
   * 2. Try REDIS_URL (most common for cloud Redis)
   * 3. Fallback to individual variables (REDIS_HOST, REDIS_PORT, etc.)
   * 4. Default to localhost if nothing specified
   */
  load(): RedisConfig {
    const enabled = this.env.get('REDIS_ENABLED');

    // If Redis is disabled, return minimal config (service will use mock)
    if (enabled === false) {
      this.logger.warn('Redis is disabled - using mock implementation');
      return {
        host: 'localhost',
        port: 6379,
        db: 0,
        keyPrefix: 'taj:',
        retryAttempts: 0,
        retryDelay: 0,
        enabled: false,
      };
    }

    // Try URL format first (most common for cloud providers)
    const url = this.env.get('REDIS_URL');
    if (url) {
      return this.parseUrlConfig(url);
    }

    // Fallback to individual variables
    return this.parseIndividualConfig();
  }

  /**
   * Parse Redis configuration from URL
   *
   * URL format: redis://:password@host:port/db
   * Example: redis://:mypassword@redis.example.com:6379/0
   */
  private parseUrlConfig(url: string): RedisConfig {
    try {
      const parsed = new URL(url);

      // Extract database number from path (e.g., "/0" -> 0)
      const db = parseInt(parsed.pathname?.slice(1) || '0');

      return {
        url,
        host: parsed.hostname,
        port: parseInt(parsed.port) || 6379,
        password: parsed.password || undefined,
        db: isNaN(db) ? 0 : db,
        keyPrefix: this.env.get('REDIS_KEY_PREFIX') || 'taj:',
        retryAttempts: this.env.get('REDIS_RETRY_ATTEMPTS') || 10,
        retryDelay: this.env.get('REDIS_RETRY_DELAY') || 3000,
        enabled: true,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to parse REDIS_URL: ${errorMessage}`);
      throw new Error(`Invalid REDIS_URL format: ${url}`);
    }
  }

  /**
   * Parse Redis configuration from individual environment variables
   */
  private parseIndividualConfig(): RedisConfig {
    return {
      host: this.env.get('REDIS_HOST') || 'localhost',
      port: this.env.get('REDIS_PORT') || 6379,
      password: this.env.get('REDIS_PASSWORD'),
      db: this.env.get('REDIS_DB') || 0,
      keyPrefix: this.env.get('REDIS_KEY_PREFIX') || 'taj:',
      retryAttempts: this.env.get('REDIS_RETRY_ATTEMPTS') || 10,
      retryDelay: this.env.get('REDIS_RETRY_DELAY') || 3000,
      enabled: true,
    };
  }

  /**
   * Validate that required configuration is present
   * Throws error if Redis is enabled but config is invalid
   */
  validate(config: RedisConfig): void {
    if (!config.enabled) return;

    if (!config.host) {
      throw new Error('Redis host is required when REDIS_ENABLED=true');
    }

    if (!config.port || config.port < 1 || config.port > 65535) {
      throw new Error('Redis port must be between 1 and 65535');
    }
  }
}
