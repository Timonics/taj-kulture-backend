import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { LoggerService } from '../../logger/logger.service';
import { QUEUE_NAMES } from '../../../core/constants/app.constants';
import { ILogger } from 'src/shared/logger/logger.interface';

/**
 * DEAD LETTER QUEUE PROCESSOR
 *
 * Handles jobs that have failed all retry attempts.
 *
 * WHAT IT DOES:
 * - Logs failed job details prominently (for monitoring)
 * - Stores in database for admin dashboard
 * - Can trigger alerts (Slack, email) to ops team
 *
 * NOTE: This processor runs for jobs in the dead-letter queue,
 * not for jobs that fail. The dead-letter queue receives jobs
 * AFTER they've exhausted all retries.
 */
@Processor(QUEUE_NAMES.DEAD_LETTER)
export class DeadLetterQueueProcessor {
  private readonly logger: ILogger;

  constructor(logger: LoggerService) {
    this.logger = logger.child('DeadLetterQueueProcessor');
  }

  @Process('failed-job')
  async handleDeadLetter(job: Job): Promise<{ processed: boolean }> {
    const deadLetterData = job.data;

    // Prominent logging for monitoring/alerts
    this.logger.error(
      `🔴 DEAD LETTER JOB - Queue: ${deadLetterData.originalQueue}, Job: ${deadLetterData.originalJobName}`,
      deadLetterData.failedReason,
      {
        correlationId: deadLetterData.correlationId,
        originalJobId: deadLetterData.originalJobId,
        attemptsMade: deadLetterData.attemptsMade,
        failedAt: deadLetterData.failedAt,
      },
    );

    // Here you could:
    // 1. Send alert to Slack/Discord
    // 2. Create support ticket
    // 3. Notify on-call engineer
    // 4. Trigger alternative recovery process

    return { processed: true };
  }
}
