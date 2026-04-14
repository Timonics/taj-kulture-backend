import { Module } from '@nestjs/common';
import { CartService } from './cart.service';
import { CartController } from './cart.controller';
import { PrismaService } from '../../shared/database/prisma.service';
import { RedisService } from '../../shared/redis/redis.service';
import { CacheModule } from 'src/shared/cache/cache.module';
import { DatabaseModule } from 'src/shared/database/database.module';

@Module({
  imports: [CacheModule, DatabaseModule],
  controllers: [CartController],
  providers: [CartService, PrismaService, RedisService],
})
export class CartModule {}
