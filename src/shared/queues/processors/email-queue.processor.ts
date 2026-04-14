import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { EmailService } from '../../email/email.service';
import { DeadLetterQueueService } from '../dead-letter-queue.service';
import { LoggerService } from '../../logger/logger.service';
import { EnvironmentService } from '../../../config/env/env.service';
import { QUEUE_NAMES } from '../../../core/constants/app.constants';
import { ILogger } from 'src/shared/logger/logger.interface';

/**
 * EMAIL QUEUE PROCESSOR
 *
 * Actually sends emails when jobs are processed.
 *
 * WHY SEPARATE PROCESSOR:
 * - Runs in separate process (can scale independently)
 * - Retries failed emails automatically
 * - Dead letter queue for permanent failures
 *
 * ERROR HANDLING STRATEGY:
 * - Invalid email format → Dead letter (permanent failure)
 * - User not found → Dead letter (permanent failure)
 * - SendGrid timeout → Retry (temporary failure)
 * - Rate limit → Retry with delay
 */
@Processor(QUEUE_NAMES.EMAIL)
export class EmailQueueProcessor {
  private readonly logger: ILogger;

  constructor(
    private emailService: EmailService,
    private deadLetterQueue: DeadLetterQueueService,
    private env: EnvironmentService,
    logger: LoggerService,
  ) {
    this.logger = logger.child('EmailQueueProcessor');
  }

  @Process('send-verification')
  async handleVerificationEmail(job: Job) {
    const { email, name, verificationToken, correlationId } = job.data;
    this.logger.debug(`Processing verification email for ${email}`, {
      correlationId,
      jobId: job.id,
    });

    // Validate email format - permanent failure if invalid
    if (!this.isValidEmail(email)) {
      await this.deadLetterQueue.addToDeadLetter(
        job,
        new Error(`Invalid email format: ${email}`),
        QUEUE_NAMES.EMAIL,
        correlationId,
      );
      return;
    }

    await this.emailService.sendVerificationEmail(
      email,
      name,
      verificationToken,
    );
    this.logger.info(`Verification email sent to ${email}`, { correlationId });
  }

  @Process('send-password-reset')
  async handlePasswordResetEmail(job: Job) {
    const { email, name, resetToken, correlationId } = job.data;
    this.logger.debug(`Processing password reset email for ${email}`, {
      correlationId,
      jobId: job.id,
    });

    await this.emailService.sendPasswordResetEmail(email, name, resetToken);
    this.logger.info(`Password reset email sent to ${email}`, {
      correlationId,
    });
  }

  @Process('send-welcome')
  async handleWelcomeEmail(job: Job) {
    const { email, name, correlationId } = job.data;
    this.logger.debug(`Processing welcome email for ${email}`, {
      correlationId,
      jobId: job.id,
    });

    await this.emailService.sendWelcomeEmail(email, name);
    this.logger.info(`Welcome email sent to ${email}`, { correlationId });
  }

  @Process('send-order-confirmation')
  async handleOrderConfirmation(job: Job) {
    const { email, name, orderNumber, items, total, correlationId } = job.data;
    this.logger.debug(`Processing order confirmation for ${orderNumber}`, {
      correlationId,
      jobId: job.id,
    });

    await this.emailService.sendOrderConfirmationEmail(
      email,
      name,
      orderNumber,
      items,
      total,
    );
    this.logger.info(`Order confirmation sent for ${orderNumber}`, {
      correlationId,
    });
  }

  @Process('send-shipping-update')
  async handleShippingUpdate(job: Job) {
    const {
      email,
      name,
      orderNumber,
      trackingNumber,
      carrier,
      estimatedDelivery,
      correlationId,
    } = job.data;
    this.logger.debug(`Processing shipping update for ${orderNumber}`, {
      correlationId,
      jobId: job.id,
    });

    await this.emailService.sendShippingUpdateEmail(
      email,
      name,
      orderNumber,
      trackingNumber,
      carrier,
      estimatedDelivery,
    );
    this.logger.info(`Shipping update sent for ${orderNumber}`, {
      correlationId,
    });
  }

  @Process('send-order-cancellation')
  async handleOrderCancellation(job: Job) {
    const { email, orderNumber, reason, correlationId } = job.data;
    this.logger.debug(`Processing cancellation for ${orderNumber}`, {
      correlationId,
      jobId: job.id,
    });

    await this.emailService.sendOrderCancellationEmail(
      email,
      orderNumber,
      reason,
    );
    this.logger.info(`Cancellation email sent for ${orderNumber}`, {
      correlationId,
    });
  }

  @Process('send-vendor-approval')
  async handleVendorApproval(job: Job) {
    const { email, storeName, correlationId } = job.data;
    this.logger.debug(`Processing vendor approval for ${storeName}`, {
      correlationId,
      jobId: job.id,
    });

    await this.emailService.sendVendorApprovalEmail(email, storeName);
    this.logger.info(`Vendor approval email sent to ${email}`, {
      correlationId,
    });
  }

  @Process('send-vendor-rejection')
  async handleVendorRejection(job: Job) {
    const { email, storeName, reason, correlationId } = job.data;
    this.logger.debug(`Processing vendor rejection for ${storeName}`, {
      correlationId,
      jobId: job.id,
    });

    await this.emailService.sendVendorRejectionEmail(email, storeName, reason);
    this.logger.info(`Vendor rejection email sent to ${email}`, {
      correlationId,
    });
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
