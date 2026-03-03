import { FactoryProvider, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export type RedisClient = Redis;

export const REDIS_CLIENT = 'REDIS_CLIENT';

export const redisClientFactory: FactoryProvider<Promise<RedisClient>> = {
  provide: REDIS_CLIENT,
  useFactory: async (configService: ConfigService) => {
    const logger = new Logger('RedisClient');

    const host = configService.get('REDIS_HOST', 'localhost');
    const port = configService.get('REDIS_PORT', 6379);
    const password = configService.get('REDIS_PASSWORD', '');
    const db = configService.get('REDIS_DB', 0);

    logger.log(`Initializing Redis connection to ${host}:${port} DB:${db}`);

    const client = new Redis({
      host,
      port,
      password,
      db,
      retryStrategy: (times) => {
        const delay = Math.min(times * 100, 3000);
        logger.warn(`Redis reconnecting in ${delay}ms... (attempt ${times})`);
        return delay;
      },
      maxRetriesPerRequest: 3,
      lazyConnect: false,
      enableReadyCheck: true,
    });

    client.on('connect', () => {
      logger.log('✅ Redis connected');
    });

    client.on('ready', () => {
      logger.log('✅ Redis ready');
    });

    client.on('error', (error) => {
      logger.error(`❌ Redis error: ${error.message}`);
    });

    client.on('close', () => {
      logger.warn('Redis connection closed');
    });

    // Test connection
    try {
      await client.ping();
      logger.log('✅ Redis ping successful');
    } catch (error) {
      logger.error(`❌ Redis ping failed: ${error.message}`);
      throw error;
    }

    return client;
  },
  inject: [ConfigService],
};
