import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue, Job } from 'bull';
import { PrismaService } from '../database/prisma.service';

export interface DeadLetterJob {
  originalQueue: string;
  originalJobId: string | number;
  originalJobName: string;
  originalData: any;
  failedReason: string;
  attemptsMade: number;
  failedAt: Date;
  stacktrace?: string[];
}

@Injectable()
export class DeadLetterQueueService {
  private readonly logger = new Logger(DeadLetterQueueService.name);

  constructor(
    @InjectQueue('dead-letter') private deadLetterQueue: Queue,
    private prisma: PrismaService,
  ) {}

  async addToDeadLetter(
    job: Job,
    error: Error,
    queueName: string,
  ): Promise<void> {
    const deadLetterJob: DeadLetterJob = {
      originalQueue: queueName,
      originalJobId: job.id,
      originalJobName: job.name,
      originalData: job.data,
      failedReason: error.message,
      attemptsMade: job.attemptsMade,
      failedAt: new Date(),
      stacktrace: error.stack?.split('\n'),
    };

    this.logger.error(
      `Job ${job.id} from ${queueName} moved to dead letter queue. Reason: ${error.message}`,
    );

    // Store in Redis queue
    await this.deadLetterQueue.add('failed-job', deadLetterJob, {
      attempts: 1, // Don't retry dead letters
      removeOnComplete: false, // Keep for inspection
      removeOnFail: false,
    });

    // Also store in database for persistence and querying
    await this.prisma.deadLetterJob.create({
      data: {
        queueName,
        jobId: String(job.id),
        jobName: job.name,
        jobData: job.data,
        errorMessage: error.message,
        errorStack: error.stack,
        attempts: job.attemptsMade,
      },
    });
  }

  async getAllDeadLetters(): Promise<DeadLetterJob[]> {
    const jobs = await this.deadLetterQueue.getJobs(['waiting', 'completed', 'failed']);
    return jobs.map(job => job.data);
  }

  async replayJob(jobId: string, targetQueue: string): Promise<void> {
    const deadLetterJob = await this.deadLetterQueue.getJob(jobId);
    
    if (!deadLetterJob) {
      throw new Error('Dead letter job not found');
    }

    const data = deadLetterJob.data as DeadLetterJob;
    
    // Get target queue
    const targetQueueInstance = this.getQueueByName(targetQueue);
    
    if (!targetQueueInstance) {
      throw new Error(`Target queue '${targetQueue}' not found`);
    }
    
    // Replay the job
    await targetQueueInstance.add(data.originalJobName, data.originalData, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    });

    // Remove from dead letter queue
    await deadLetterJob.remove();

    // Update database record
    await this.prisma.deadLetterJob.updateMany({
      where: { 
        jobId: String(data.originalJobId),
        queueName: targetQueue 
      },
      data: { replayed: true, replayedAt: new Date() },
    });

    this.logger.log(`Replayed job ${jobId} to ${targetQueue}`);
  }

  private getQueueByName(name: string): Queue | null {
    // This will be injected - we'll handle this in the module
    return null;
  }
}