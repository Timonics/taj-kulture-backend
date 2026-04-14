import { Module } from '@nestjs/common';
import { WishlistController } from './wishlist.controller';
import { WishlistService } from './wishlist.service';
import { PrismaService } from '../../shared/database/prisma.service';
import { EventBus } from '../../shared/events/event-bus.service';
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
  imports: [EventEmitterModule],
  controllers: [WishlistController],
  providers: [WishlistService, PrismaService, EventBus],
  exports: [WishlistService],
})
export class WishlistModule {}