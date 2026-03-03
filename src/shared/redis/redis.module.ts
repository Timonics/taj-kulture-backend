// src/shared/redis/redis.module.ts
import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { redisClientFactory, REDIS_CLIENT } from './redis-client.provider';
import { RedisService } from './redis.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    redisClientFactory,
    RedisService,
    {
      provide: 'REDIS_CONNECTION',
      useExisting: REDIS_CLIENT,
    },
  ],
  exports: [
    RedisService,
    REDIS_CLIENT,
    'REDIS_CONNECTION',
  ],
})
export class RedisModule {}