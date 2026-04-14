import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigService } from '@nestjs/config'; // ✅ Use ConfigService
import { EmailQueueService } from './email-queue.service';
import { NotificationQueueService } from './notification-queue.service';
import { AnalyticsQueueService } from './analytics-queue.service';
import { DeadLetterQueueService } from './dead-letter-queue.service';
import { EmailQueueProcessor } from './processors/email-queue.processor';
import { NotificationQueueProcessor } from './processors/notification-queue.processor';
import { AnalyticsQueueProcessor } from './processors/analytics-queue.processor';
import { DeadLetterQueueProcessor } from './processors/dead-letter-queue.processor';
import { QueueMonitorController } from './queue-monitor.controller';
import { DeadLetterController } from './dead-letter.controller';
import { EmailModule } from '../email/email.module';
import { DatabaseModule } from '../database/database.module';
import { LoggerModule } from '../logger/logger.module';
import { QUEUE_NAMES } from 'src/core/constants/app.constants';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: (configService: ConfigService) => {
        const redisConfig = {
          host: configService.get<string>('REDIS_HOST'),
          port: configService.get<number>('REDIS_PORT'),
          password: configService.get<string>('REDIS_PASSWORD'),
          db: configService.get<number>('REDIS_DB') || 1,
        };
        return {
          redis: redisConfig,
          defaultJobOptions: {
            attempts: 3,
            backoff: { type: 'exponential', delay: 1000 },
            removeOnComplete: true,
            removeOnFail: false,
          },
        };
      },
      inject: [ConfigService],
    }),
    BullModule.registerQueue(
      { name: QUEUE_NAMES.EMAIL },
      { name: QUEUE_NAMES.NOTIFICATION },
      { name: QUEUE_NAMES.ANALYTICS },
      { name: QUEUE_NAMES.DEAD_LETTER },
    ),
    EmailModule,
    DatabaseModule,
    LoggerModule,
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