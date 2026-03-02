import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { EmailService } from '../../email/email.service';
import { DeadLetterQueueService } from '../dead-letter-queue.service';

@Processor('email')
export class EmailQueueProcessor {
  private readonly logger = new Logger(EmailQueueProcessor.name);

  constructor(
    private emailService: EmailService,
    private deadLetterQueue: DeadLetterQueueService, // Inject DLQ
  ) {}

  @Process('send-verification')
  async handleVerificationEmail(job: Job) {
    this.logger.log(`Processing verification email job ${job.id}`);

    try {
      const { email, name, verificationToken } = job.data;

      // Validate email format
      if (!this.isValidEmail(email)) {
        // This is a permanent failure - send to dead letter
        await this.deadLetterQueue.addToDeadLetter(
          job,
          new Error(`Invalid email format: ${email}`),
          'email',
        );
        return; // Don't throw, it's already in DLQ
      }

      await this.emailService.sendVerificationEmail(
        email,
        name,
        verificationToken,
      );

      this.logger.log(`Verification email sent to ${email}`);
      return { success: true, email };
    } catch (error) {
      // Check if this is the last attempt
      if (job.attemptsMade >= (job.opts.attempts ?? 3)) {
        // All retries exhausted - send to dead letter
        await this.deadLetterQueue.addToDeadLetter(job, error, 'email');
        return; // Don't throw, it's now in DLQ
      }

      // Still have retries left - throw to trigger retry
      this.logger.error(`Failed to send verification email: ${error.message}`);
      throw error;
    }
  }

  @Process('send-password-reset')
  async handlePasswordResetEmail(job: Job) {
    this.logger.log(`Processing password reset email job ${job.id}`);

    try {
      const { email, name, resetToken } = job.data;

      // Check if email exists in our system (business rule)
      const userExists = await this.checkUserExists(email);
      if (!userExists) {
        // User might have been deleted - send to dead letter
        await this.deadLetterQueue.addToDeadLetter(
          job,
          new Error(`User not found for email: ${email}`),
          'email',
        );
        return;
      }

      await this.emailService.sendPasswordResetEmail(email, name, resetToken);

      this.logger.log(`Password reset email sent to ${email}`);
      return { success: true, email };
    } catch (error) {
      if (job.attemptsMade >= (job.opts.attempts ?? 3)) {
        await this.deadLetterQueue.addToDeadLetter(job, error, 'email');
        return;
      }
      throw error;
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private async checkUserExists(email: string): Promise<boolean> {
    // Implement user check
    return true; // Placeholder
  }
}
