import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { QUEUE_NAMES } from 'src/core/constants/app.constants';

@Injectable()
export class EmailQueueService {
  constructor(@InjectQueue(QUEUE_NAMES.EMAIL) private emailQueue: Queue) {}

  async sendVerificationEmail(data: {
    email: string;
    name: string;
    verificationToken: string;
  }) {
    return this.emailQueue.add('send-verification', data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      priority: 1, // High priority
    });
  }

  async sendPasswordResetEmail(data: {
    email: string;
    name: string;
    resetToken: string;
  }) {
    return this.emailQueue.add('send-password-reset', data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      priority: 2, // Medium priority
    });
  }

  async sendWelcomeEmail(data: { email: string; name: string }) {
    return this.emailQueue.add('send-welcome', data, {
      attempts: 2,
      priority: 3, // Low priority
      delay: 5000, // Delay 5 seconds (user just verified, give them a moment)
    });
  }

  async sendOrderConfirmation(data: {
    email: string;
    orderNumber: string;
    items: any[];
    total: number;
  }) {
    return this.emailQueue.add('send-order-confirmation', data, {
      attempts: 3,
      priority: 1,
    });
  }

  async sendShippingUpdate(data: {
    email: string;
    orderNumber: string;
    trackingNumber: string;
    estimatedDelivery: Date;
  }) {
    return this.emailQueue.add('send-shipping-update', data, {
      attempts: 3,
      priority: 2,
    });
  }
}
