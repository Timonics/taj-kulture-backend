// src/modules/reviews/reviews.module.ts
import { Module } from '@nestjs/common';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { PrismaService } from 'src/shared/database/prisma.service';
import { EventBus } from 'src/shared/events/event-bus.service';
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
  imports: [EventEmitterModule],
  controllers: [ReviewsController],
  providers: [ReviewsService, PrismaService, EventBus],
  exports: [ReviewsService],
})
export class ReviewsModule {}
