import { FactoryProvider } from '@nestjs/common';
import Redis from 'ioredis';
import { RedisConfigLoader } from './redis.config';
import { REDIS_CLIENT, RedisClient } from './redis.interface';
import { RedisMockClient } from './redis.mock';
import { LoggerService } from '../logger/logger.service';

/**
 * REDIS CLIENT FACTORY
 *
 * Single responsibility: Create and manage Redis client connections

 * - Creates Redis client with proper configuration
 * - Sets up event handlers for monitoring
 * - Implements retry strategy
 * - Manages connection lifecycle (connect, disconnect)
 */
export const redisClientFactory: FactoryProvider<Promise<RedisClient>> = {
  provide: REDIS_CLIENT,
  useFactory: async (configLoader: RedisConfigLoader): Promise<RedisClient> => {
    const logger = new LoggerService();
    const config = configLoader.load();

    // Validate configuration
    configLoader.validate(config);

    // Use mock client if Redis is disabled
    if (!config.enabled) {
      logger.warn('Redis is disabled - using mock client');
      const mockClient = new RedisMockClient();
      await mockClient.connect();
      return mockClient;
    }

    logger.info(
      `Connecting to Redis at ${config.host}:${config.port} DB:${config.db}`,
    );

    // Create production Redis client
    const client = new Redis({
      host: config.host,
      port: config.port,
      password: config.password,
      db: config.db,
      keyPrefix: config.keyPrefix,

      // Connection settings
      retryStrategy: (times: number) => {
        if (times > config.retryAttempts) {
          logger.error(`Redis connection failed after ${times} attempts`);
          return null; // Stop retrying
        }

        const delay = Math.min(times * config.retryDelay, 30000);
        logger.warn(
          `Redis reconnecting in ${delay}ms... (attempt ${times}/${config.retryAttempts})`,
        );
        return delay;
      },

      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false, // Connect immediately
      keepAlive: 30000,

      // Performance
      enableAutoPipelining: true,
      autoResendUnfulfilledCommands: true,

      // Timeouts
      connectTimeout: 10000,
      commandTimeout: 5000,

      // TLS for production
      tls: process.env.NODE_ENV === 'production' ? {} : undefined,
    });

    // Event handlers for monitoring
    client.on('connect', () => {
      logger.info(`Redis connecting to ${config.host}:${config.port}`);
    });

    client.on('ready', () => {
      logger.info(`✅ Redis ready - connected to ${config.host}:${config.port}`);
    });

    client.on('error', (error) => {
      logger.error(`Redis error: ${error.message}`);
    });

    client.on('close', () => {
      logger.warn('Redis connection closed');
    });

    client.on('reconnecting', () => {
      logger.warn('Redis reconnecting...');
    });

    // Test connection
    try {
      await client.ping();
      logger.info('✅ Redis ping successful');
    } catch (error) {
      logger.error(`Redis ping failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }

    return client;
  },
  inject: [RedisConfigLoader],
};
