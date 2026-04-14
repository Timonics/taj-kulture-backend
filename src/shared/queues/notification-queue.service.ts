import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { QUEUE_NAMES } from 'src/core/constants/app.constants';
import {
  InAppNotificationJobData,
  BulkNotificationJobData,
  PushNotificationJobData,
} from './interfaces';

/**
 * NOTIFICATION QUEUE SERVICE
 *
 * Adds notification jobs to Bull queue for async processing.
 *
 * WHY QUEUE FOR NOTIFICATIONS:
 * - Creating many notifications (bulk) can be slow
 * - In-app notifications can be batched
 * - Push notifications require external API calls
 *
 * JOB TYPES:
 * - create-in-app: Single user in-app notification
 * - create-bulk: Bulk in-app notifications (chunked)
 * - send-push: Push notification via Firebase/OneSignal
 */
@Injectable()
export class NotificationQueueService {
  constructor(
    @InjectQueue(QUEUE_NAMES.NOTIFICATION) private notificationQueue: Queue,
  ) {}

  async createInAppNotification(data: InAppNotificationJobData) {
    return this.notificationQueue.add('create-in-app', data, {
      attempts: 3,
      priority: 2,
      jobId: `in-app:${data.userId}:${Date.now()}`,
    });
  }

  async createBulkNotifications(
    data: Omit<BulkNotificationJobData, 'chunkIndex'>,
  ) {
    // Split into chunks of 100 to avoid memory issues
    const chunkSize = 100;
    const chunks: string[][] = [];

    for (let i = 0; i < data.userIds.length; i += chunkSize) {
      chunks.push(data.userIds.slice(i, i + chunkSize));
    }

    return Promise.all(
      chunks.map((chunk, index) =>
        this.notificationQueue.add(
          'create-bulk',
          {
            ...data,
            userIds: chunk,
            chunkIndex: index,
          },
          {
            attempts: 2,
            priority: 3,
            delay: index * 1000, // Stagger chunks
            jobId: `bulk:${index}:${Date.now()}`,
          },
        ),
      ),
    );
  }

  async sendPushNotification(data: PushNotificationJobData) {
    return this.notificationQueue.add('send-push', data, {
      attempts: 2,
      priority: 1,
      jobId: `push:${data.userId}:${Date.now()}`,
    });
  }
}
