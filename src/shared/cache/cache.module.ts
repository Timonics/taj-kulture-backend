import { Module, Global, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisCacheService } from './redis-cache.service';
import { MemoryCacheService } from './memory-cache.service';
import { RedisModule } from '../redis/redis.module';
import { RedisService } from '../redis/redis.service';

@Global()
@Module({
  imports: [RedisModule],
  providers: [
    {
      provide: 'CACHE_SERVICE',
      useFactory: (configService: ConfigService, redisService: any) => {
        const useRedis = configService.get('REDIS_ENABLED', true);
        if (useRedis) {
          return new RedisCacheService(redisService);
        }
        return new MemoryCacheService();
      },
      inject: [ConfigService, { token: RedisService, optional: true }],
    },
  ],
  exports: ['CACHE_SERVICE'],
})
export class CacheModule implements OnModuleDestroy {
  onModuleDestroy() {
    // Clean up any pending operations
  }
}
