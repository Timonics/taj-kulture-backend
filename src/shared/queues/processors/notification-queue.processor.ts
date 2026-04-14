import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { PrismaService } from '../../database/prisma.service';
import { DeadLetterQueueService } from '../dead-letter-queue.service';
import { ILogger } from '../../logger/logger.interface';
import { LoggerService } from '../../logger/logger.service';
import { QUEUE_NAMES } from '../../../core/constants/app.constants';

/**
 * NOTIFICATION QUEUE PROCESSOR
 *
 * Creates in-app notifications and sends push notifications.
 *
 * ERROR HANDLING:
 * - User not found → Dead letter (permanent failure)
 * - Database error → Retry
 * - Push service error → Retry with backoff
 */
@Processor(QUEUE_NAMES.NOTIFICATION)
export class NotificationQueueProcessor {
  private readonly logger: ILogger;

  constructor(
    private prisma: PrismaService,
    private deadLetterQueue: DeadLetterQueueService,
    logger: LoggerService,
  ) {
    this.logger = logger.child('NotificationQueueProcessor');
  }

  @Process('create-in-app')
  async handleInAppNotification(job: Job): Promise<any> {
    const { userId, title, message, type, data, actionUrl, correlationId } =
      job.data;
    this.logger.debug(`Creating in-app notification for user ${userId}`, {
      correlationId,
      jobId: job.id,
    });

    // Verify user exists – permanent failure if not
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      await this.deadLetterQueue.addToDeadLetter(
        job,
        new Error(`User ${userId} not found`),
        QUEUE_NAMES.NOTIFICATION,
        correlationId,
      );
      return;
    }

    const notification = await this.prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type,
        data: data || {},
        // actionUrl,
      },
    });

    this.logger.debug(`In-app notification created for user ${userId}`, {
      correlationId,
    });
    return notification;
  }

  @Process('create-bulk')
  async handleBulkNotifications(job: Job): Promise<any> {
    const {
      userIds,
      title,
      message,
      type,
      data,
      actionUrl,
      chunkIndex,
      correlationId,
    } = job.data;
    this.logger.debug(
      `Processing bulk notification chunk ${chunkIndex} for ${userIds.length} users`,
      { correlationId, jobId: job.id },
    );

    const result = await this.prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        title,
        message,
        type,
        data: data || {},
        actionUrl,
      })),
    });

    this.logger.debug(
      `Bulk chunk ${chunkIndex} created: ${result.count} notifications`,
      { correlationId },
    );
    return result;
  }

  // @Process('send-push')
  // async handlePushNotification(job: Job): Promise<any> {
  //   const { userId, title, body, data, correlationId } = job.data;
  //   this.logger.debug(`Sending push notification to user ${userId}`, {
  //     correlationId,
  //     jobId: job.id,
  //   });

  //   // Get user's push token
  //   const user = await this.prisma.user.findUnique({
  //     where: { id: userId },
  //     select: { pushToken: true },
  //   });

  //   if (!user?.pushToken) {
  //     this.logger.warn(`No push token for user ${userId}`, { correlationId });
  //     return { skipped: true, reason: 'no_push_token' };
  //   }

  //   // Example: Send via Firebase (implement your own push service)
  //   // await this.pushService.send(user.pushToken, { title, body, data });

  //   this.logger.log(`Push notification sent to user ${userId}`, {
  //     correlationId,
  //   });
  //   return { success: true, userId };
  // }
}
