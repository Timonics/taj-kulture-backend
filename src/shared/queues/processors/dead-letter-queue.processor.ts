import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { PrismaService } from '../../database/prisma.service';
import { EmailQueueService } from '../email-queue.service';
import { NotificationQueueService } from '../notification-queue.service';
import { AnalyticsQueueService } from '../analytics-queue.service';

@Processor('dead-letter')
export class DeadLetterQueueProcessor {
  private readonly logger = new Logger(DeadLetterQueueProcessor.name);

  constructor(
    private prisma: PrismaService,
    private emailQueue: EmailQueueService,
    private notificationQueue: NotificationQueueService,
    private analyticsQueue: AnalyticsQueueService,
  ) {}

  @Process('failed-job')
  async handleDeadLetter(job: Job) {
    this.logger.warn(`Processing dead letter job: ${job.id}`);
    const deadLetterData = job.data;

    // Log to console with clear formatting
    console.log('\n');
    console.log('🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥');
    console.log('🔴 DEAD LETTER JOB RECEIVED');
    console.log('🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥');
    console.log(`Queue: ${deadLetterData.originalQueue}`);
    console.log(`Job ID: ${deadLetterData.originalJobId}`);
    console.log(`Job Name: ${deadLetterData.originalJobName}`);
    console.log(`Failed Reason: ${deadLetterData.failedReason}`);
    console.log(`Attempts Made: ${deadLetterData.attemptsMade}`);
    console.log(`Failed At: ${deadLetterData.failedAt}`);
    console.log(
      '📦 Job Data:',
      JSON.stringify(deadLetterData.originalData, null, 2),
    );
    console.log('🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥');
    console.log('\n');

    // Here you could:
    // 1. Send alert to Slack/Email
    // 2. Create support ticket
    // 3. Notify admin
    // 4. Try alternative recovery

    // For now, just track it
    return { processed: true };
  }

  // Optional: Add a periodic job to clean up old dead letters
  @Process('cleanup')
  async handleCleanup(job: Job) {
    this.logger.log('Cleaning up old dead letters');

    // Delete dead letters older than 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    await this.prisma.deadLetterJob.deleteMany({
      where: {
        createdAt: { lt: thirtyDaysAgo },
        replayed: false,
      },
    });

    this.logger.log('Cleanup completed');
  }
}
