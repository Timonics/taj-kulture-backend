import { Global, Module } from '@nestjs/common';
import { RedisConfigLoader } from './redis.config';
import { redisClientFactory } from './redis-client.factory';
import { RedisService } from './redis.service';

/**
 * REDIS MODULE
 *
 * Assembles all Redis components:
 * - ConfigLoader for configuration
 * - ClientFactory for connection management
 * - RedisService for operations
 *
 * @Global() - Makes RedisService available everywhere
 */
@Global()
@Module({
  providers: [RedisConfigLoader, redisClientFactory, RedisService],
  exports: [RedisService],
})
export class RedisModule {}
