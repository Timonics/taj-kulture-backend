import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { InAppNotificationPayload } from 'src/shared/events/event-payloads.interface';

@Injectable()
export class NotificationQueueService {
  constructor(@InjectQueue('notification') private notificationQueue: Queue) {}

  async createInAppNotification(data: InAppNotificationPayload) {
    return this.notificationQueue.add('create-in-app', data, {
      attempts: 3,
      priority: 2,
    });
  }

  async createBulkNotifications(data: {
    userIds: string[];
    title: string;
    message: string;
    type: string;
  }) {
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
          },
        ),
      ),
    );
  }

  async sendPushNotification(data: {
    userId: string;
    title: string;
    body: string;
    data?: any;
  }) {
    return this.notificationQueue.add('send-push', data, {
      attempts: 2,
      priority: 1,
    });
  }
}
