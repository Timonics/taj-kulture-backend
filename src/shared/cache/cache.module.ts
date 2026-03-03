import { Module, Global, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisCacheService } from './redis-cache.service';
import { MemoryCacheService } from './memory-cache.service';
import { RedisModule } from '../redis/redis.module';

@Global()
@Module({
  imports: [RedisModule],
  providers: [
    RedisCacheService,
    {
      provide: 'CACHE_SERVICE',
      useFactory: (
        configService: ConfigService,
        redisService: RedisCacheService,
      ) => {
        const useRedis = configService.get('REDIS_ENABLED', true);
        if (useRedis) {
          return redisService;
        }
        return new MemoryCacheService();
      },
      inject: [ConfigService, RedisCacheService],
    },
  ],
  exports: ['CACHE_SERVICE'],
})
export class CacheModule {}
