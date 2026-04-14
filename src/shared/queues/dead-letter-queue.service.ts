import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue, Job } from 'bull';
import { PrismaService } from '../database/prisma.service';
import { LoggerService } from '../logger/logger.service';
import { QUEUE_NAMES } from 'src/core/constants/app.constants';
import { ILogger } from '../logger/logger.interface';

// Local interface for the dead letter job stored in Redis (not Prisma)
interface DeadLetterJobData {
  originalQueue: string;
  originalJobId: string | number;
  originalJobName: string;
  originalData: any;
  failedReason: string;
  attemptsMade: number;
  failedAt: Date;
  stacktrace?: string[];
  correlationId?: string;
}

/**
 * DEAD LETTER QUEUE SERVICE
 *
 * Handles failed jobs that exhausted all retry attempts.
 *
 * WHY DEAD LETTER QUEUE:
 * - Prevents infinite retry loops
 * - Preserves failed jobs for debugging
 * - Allows manual replay after fixing the issue
 * - Admin dashboard to monitor failures
 *
 * JOB FLOW:
 * 1. Job fails → Retry (3-5 times with backoff)
 * 2. All retries exhausted → Move to dead letter queue
 * 3. Admin investigates → Fixes the issue
 * 4. Admin replays job → Job re-queued to original queue
 */
@Injectable()
export class DeadLetterQueueService {
  private readonly logger: ILogger;
  private queues: Map<string, Queue> = new Map();

  constructor(
    @InjectQueue(QUEUE_NAMES.DEAD_LETTER) private deadLetterQueue: Queue,
    @InjectQueue(QUEUE_NAMES.EMAIL) private emailQueue: Queue,
    @InjectQueue(QUEUE_NAMES.NOTIFICATION) private notificationQueue: Queue,
    @InjectQueue(QUEUE_NAMES.ANALYTICS) private analyticsQueue: Queue,
    private prisma: PrismaService,
    logger: LoggerService,
  ) {
    this.logger = logger.child('DeadLetterQueueService');
    this.registerQueues();
  }

  private registerQueues(): void {
    this.queues.set(QUEUE_NAMES.EMAIL, this.emailQueue);
    this.queues.set(QUEUE_NAMES.NOTIFICATION, this.notificationQueue);
    this.queues.set(QUEUE_NAMES.ANALYTICS, this.analyticsQueue);
  }

  async addToDeadLetter(
    job: Job,
    error: Error,
    queueName: string,
    correlationId?: string,
  ): Promise<void> {
    const deadLetterData: DeadLetterJobData = {
      originalQueue: queueName,
      originalJobId: job.id,
      originalJobName: job.name,
      originalData: job.data,
      failedReason: error.message,
      attemptsMade: job.attemptsMade,
      failedAt: new Date(),
      stacktrace: error.stack?.split('\n'),
      correlationId,
    };

    this.logger.error(
      `Job ${job.id} from ${queueName} moved to dead letter queue`,
      error.stack,
      { correlationId, jobId: job.id, queueName },
    );

    // Store in Redis queue (full data for replay)
    await this.deadLetterQueue.add('failed-job', deadLetterData, {
      attempts: 1,
      removeOnComplete: false,
      removeOnFail: false,
    });

    // Store minimal record in database (matching your Prisma schema)
    await this.prisma.deadLetterJob.create({
      data: {
        queueName,
        jobId: String(job.id),
        jobName: job.name,
        jobData: job.data,
        errorMessage: error.message,
        errorStack: error.stack,
        attempts: job.attemptsMade,
        // correlationId is not in your schema – omit or add later
        // replayed defaults to false
      },
    });
  }

  async replayJob(jobId: string, targetQueueName: string): Promise<void> {
    const job = await this.deadLetterQueue.getJob(jobId);
    if (!job) throw new Error(`Dead letter job ${jobId} not found`);

    const data = job.data as DeadLetterJobData;
    const targetQueue = this.queues.get(targetQueueName);
    if (!targetQueue) throw new Error(`Target queue '${targetQueueName}' not found`);

    await targetQueue.add(data.originalJobName, data.originalData, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      jobId: `${data.originalJobName}:${Date.now()}:replay`,
    });

    await job.remove();

    await this.prisma.deadLetterJob.updateMany({
      where: { jobId: String(data.originalJobId), queueName: targetQueueName },
      data: { replayed: true, replayedAt: new Date() },
    });

    this.logger.info(`Replayed job ${jobId} to ${targetQueueName}`, {
      correlationId: data.correlationId,
    });
  }

  async getAllDeadLetters(): Promise<DeadLetterJobData[]> {
    const jobs = await this.deadLetterQueue.getJobs(['waiting', 'failed']);
    return jobs.map(job => job.data as DeadLetterJobData);
  }

  async getDeadLetterCount(): Promise<number> {
    return this.prisma.deadLetterJob.count({ where: { replayed: false } });
  }
}
