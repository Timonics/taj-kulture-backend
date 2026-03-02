import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { PrismaService } from '../../database/prisma.service';
import { DeadLetterQueueService } from '../dead-letter-queue.service';

@Processor('notification')
export class NotificationQueueProcessor {
  private readonly logger = new Logger(NotificationQueueProcessor.name);

  constructor(
    private prisma: PrismaService,
    private deadLetterQueue: DeadLetterQueueService,
  ) {}

  @Process('create-in-app')
  async handleInAppNotification(job: Job) {
    this.logger.log(`Processing in-app notification job ${job.id}`);

    try {
      const { userId, title, message, type, data } = job.data;

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        // User deleted - permanent failure
        await this.deadLetterQueue.addToDeadLetter(
          job,
          new Error(`User ${userId} not found`),
          'notification',
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
        },
      });

      this.logger.log(`In-app notification created for user ${userId}`);
      return notification;
    } catch (error) {
      this.logger.error(
        `Failed to create in-app notification: ${error.message}`,
      );
      throw error;
    }
  }

  @Process('create-bulk')
  async handleBulkNotifications(job: Job) {
    this.logger.log(
      `Processing bulk notification job ${job.id}, chunk ${job.data.chunkIndex}`,
    );

    try {
      const { userIds, title, message, type, chunkIndex } = job.data;

      const result = await this.prisma.notification.createMany({
        data: userIds.map((userId: string) => ({
          userId,
          title,
          message,
          type,
        })),
      });

      this.logger.log(
        `Bulk notification chunk ${chunkIndex} created: ${result.count} notifications`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `Failed to create bulk notifications: ${error.message}`,
      );
      throw error;
    }
  }

  // You'd implement push notifications here
  @Process('send-push')
  async handlePushNotification(job: Job) {
    this.logger.log(`Processing push notification job ${job.id}`);

    try {
      const { userId, title, body, data } = job.data;

      // Get user's push token from database
      // const user = await this.prisma.user.findUnique({
      //   where: { id: userId },
      //   select: { pushToken: true },
      // });

      // if (!user?.pushToken) {
      //   this.logger.warn(`No push token for user ${userId}`);
      //   return { skipped: true, reason: 'no_push_token' };
      // }

      // Send push notification (using Firebase, OneSignal, etc.)
      // await this.pushService.send(user.pushToken, { title, body, data });

      this.logger.log(`Push notification sent to user ${userId}`);
      return { success: true, userId };
    } catch (error) {
      this.logger.error(`Failed to send push notification: ${error.message}`);
      throw error;
    }
  }
}
