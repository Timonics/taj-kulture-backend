import { Global, Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { EventBus } from './event-bus.service';
import { EmailEventHandler } from './handlers/email.handler';
import { NotificationEventHandler } from './handlers/notification.handler';
import { AnalyticsEventHandler } from './handlers/analytics.handler';
import { EmailQueueService } from '../queues/email-queue.service';
import { NotificationQueueService } from '../queues/notification-queue.service';
import { AnalyticsQueueService } from '../queues/analytics-queue.service';
import { BullModule } from '@nestjs/bull';
import { DatabaseModule } from '../database/database.module';
import { QUEUE_NAMES } from 'src/core/constants/app.constants';

@Global()
@Module({
  imports: [
    EventEmitterModule.forRoot({
      wildcard: false,
      delimiter: '.',
      newListener: false,
      removeListener: false,
      maxListeners: 10,
      verboseMemoryLeak: false,
      ignoreErrors: false,
    }),
    // Import Bull queues if needed by the handlers
    BullModule.registerQueue(
      { name: QUEUE_NAMES.EMAIL },
      { name: QUEUE_NAMES.NOTIFICATION },
      { name: QUEUE_NAMES.ANALYTICS },
    ),
    DatabaseModule,
  ],
  providers: [
    EventBus,
    EmailEventHandler,
    NotificationEventHandler,
    AnalyticsEventHandler,
    EmailQueueService,
    NotificationQueueService,
    AnalyticsQueueService,
  ],
  exports: [EventBus],
})
export class EventsModule {}
