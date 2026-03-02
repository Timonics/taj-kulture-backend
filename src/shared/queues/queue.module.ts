import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigService } from '@nestjs/config';
import { EmailQueueService } from './email-queue.service';
import { EmailQueueProcessor } from './processors/email-queue.processor';
import { NotificationQueueService } from './notification-queue.service';
import { NotificationQueueProcessor } from './processors/notification-queue.processor';
import { AnalyticsQueueService } from './analytics-queue.service';
import { AnalyticsQueueProcessor } from './processors/analytics-queue.processor';
import { DeadLetterQueueService } from './dead-letter-queue.service';
import { DeadLetterQueueProcessor } from './processors/dead-letter-queue.processor';
import { QueueMonitorController } from './queue-monitor.controller';
import { EmailModule } from '../email/email.module';
import { DeadLetterController } from './dead-letter.controller';
import { QUEUE_NAMES } from 'src/core/constants/app.constants';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get('REDIS_HOST'),
          port: configService.get('REDIS_PORT'),
          password: configService.get('REDIS_PASSWORD'),
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
          removeOnComplete: true,
          removeOnFail: false, // Keep failed jobs for DLQ
        },
      }),
      inject: [ConfigService],
    }),

    // Register queues
    BullModule.registerQueue(
      {
        name: QUEUE_NAMES.EMAIL,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
        },
      },
      {
        name: QUEUE_NAMES.NOTIFICATION,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'fixed',
            delay: 2000,
          },
        },
      },
      {
        name: QUEUE_NAMES.ANALYTICS,
        defaultJobOptions: {
          attempts: 2,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
        },
      },
      {
        name: QUEUE_NAMES.DEAD_LETTER, // Add dead letter queue
        defaultJobOptions: {
          attempts: 1, // Don't retry dead letters
          removeOnComplete: false, // Keep for inspection
          removeOnFail: false,
        },
      },
    ),
    EmailModule
  ],
  controllers: [QueueMonitorController, DeadLetterController],
  providers: [
    EmailQueueService,
    EmailQueueProcessor,
    NotificationQueueService,
    NotificationQueueProcessor,
    AnalyticsQueueService,
    AnalyticsQueueProcessor,
    DeadLetterQueueService,
    DeadLetterQueueProcessor,
  ],
  exports: [
    EmailQueueService,
    NotificationQueueService,
    AnalyticsQueueService,
    DeadLetterQueueService,
  ],
})
export class QueuesModule {}
