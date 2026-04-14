import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { QUEUE_NAMES } from 'src/core/constants/app.constants';
import {
  SendVerificationJobData,
  SendPasswordResetJobData,
  SendWelcomeJobData,
  SendOrderConfirmationJobData,
  SendShippingUpdateJobData,
  SendOrderCancellationJobData,
  SendVendorApprovalJobData,
  SendVendorRejectionJobData,
} from './interfaces';

/**
 * EMAIL QUEUE SERVICE
 *
 * Adds email jobs to the Bull queue for async processing.
 *
 * WHY QUEUE INSTEAD OF DIRECT SEND:
 * - Email sending is slow (network I/O)
 * - Queues prevent blocking the HTTP response
 * - Automatic retry if SendGrid fails
 * - Can scale workers independently
 *
 * JOB TYPES:
 * - send-verification: Welcome email with verification link
 * - send-password-reset: Password reset link email
 * - send-welcome: Welcome email after verification
 * - send-order-confirmation: Order receipt
 * - send-shipping-update: Tracking info
 * - send-order-cancellation: Cancellation notice
 * - send-vendor-approval: Vendor application approved
 * - send-vendor-rejection: Vendor application rejected
 */
@Injectable()
export class EmailQueueService {
  constructor(@InjectQueue(QUEUE_NAMES.EMAIL) private emailQueue: Queue) {}

  async sendVerificationEmail(data: SendVerificationJobData) {
    return this.emailQueue.add('send-verification', data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      priority: 1, // High priority - user is waiting
      jobId: `verification:${data.email}:${Date.now()}`, // Deduplication
    });
  }

  async sendPasswordResetEmail(data: SendPasswordResetJobData) {
    return this.emailQueue.add('send-password-reset', data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      priority: 1,
      jobId: `password-reset:${data.email}:${Date.now()}`,
    });
  }

  async sendWelcomeEmail(data: SendWelcomeJobData) {
    return this.emailQueue.add('send-welcome', data, {
      attempts: 2,
      priority: 3, // Low priority - can wait
      delay: 5000, // Wait 5 seconds after verification
    });
  }

  async sendOrderConfirmation(data: SendOrderConfirmationJobData) {
    return this.emailQueue.add('send-order-confirmation', data, {
      attempts: 3,
      priority: 1,
    });
  }

  async sendShippingUpdate(data: SendShippingUpdateJobData) {
    return this.emailQueue.add('send-shipping-update', data, {
      attempts: 3,
      priority: 2,
    });
  }

  async sendOrderCancellation(data: SendOrderCancellationJobData) {
    return this.emailQueue.add('send-order-cancellation', data, {
      attempts: 3,
      priority: 1,
    });
  }

  async sendDeliveryConfirmation(data: SendOrderConfirmationJobData) {
    return this.emailQueue.add('send-delivery-confirmation', data, {
      attempts: 3,
      priority: 2,
    });
  }

  async sendVendorApproval(data: SendVendorApprovalJobData) {
    return this.emailQueue.add('send-vendor-approval', data, {
      attempts: 3,
      priority: 2,
    });
  }

  async sendVendorRejection(data: SendVendorRejectionJobData) {
    return this.emailQueue.add('send-vendor-rejection', data, {
      attempts: 3,
      priority: 2,
    });
  }
}
