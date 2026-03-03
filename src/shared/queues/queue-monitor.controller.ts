import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

import { UserRole } from 'generated/prisma/client';
import { Roles } from 'src/core/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt.guard';
import { RolesGuard } from 'src/modules/auth/guards/roles.guard';
import { QUEUE_NAMES } from 'src/core/constants/app.constants';

@Controller('admin/queues')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class QueueMonitorController {
  constructor(
    @InjectQueue(QUEUE_NAMES.EMAIL) private emailQueue: Queue,
    @InjectQueue(QUEUE_NAMES.NOTIFICATION) private notificationQueue: Queue,
    @InjectQueue(QUEUE_NAMES.ANALYTICS) private analyticsQueue: Queue,
  ) {}

  @Get()
  async getAllQueues() {
    const queues = await Promise.all([
      this.getQueueMetrics(QUEUE_NAMES.EMAIL, this.emailQueue),
      this.getQueueMetrics(QUEUE_NAMES.NOTIFICATION, this.notificationQueue),
      this.getQueueMetrics(QUEUE_NAMES.ANALYTICS, this.analyticsQueue),
    ]);

    return queues;
  }

  @Get(':name')
  async getQueue(@Param('name') name: string) {
    let queue: Queue;

    switch (name) {
      case 'email':
        queue = this.emailQueue;
        break;
      case 'notification':
        queue = this.notificationQueue;
        break;
      case 'analytics':
        queue = this.analyticsQueue;
        break;
      default:
        return { error: 'Queue not found' };
    }

    return this.getQueueMetrics(name, queue);
  }

  @Get(':name/jobs')
  async getQueueJobs(@Param('name') name: string) {
    let queue: Queue;

    switch (name) {
      case 'email':
        queue = this.emailQueue;
        break;
      case 'notification':
        queue = this.notificationQueue;
        break;
      case 'analytics':
        queue = this.analyticsQueue;
        break;
      default:
        return { error: 'Queue not found' };
    }

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    const recentJobs = await queue.getJobs(['completed', 'failed'], 0, 20);

    return {
      counts: { waiting, active, completed, failed, delayed },
      recentJobs: recentJobs.map((job) => ({
        id: job.id,
        name: job.name,
        data: job.data,
        state: job.getState(),
        attemptsMade: job.attemptsMade,
        failedReason: job.failedReason,
        timestamp: job.timestamp,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
      })),
    };
  }

  private async getQueueMetrics(name: string, queue: Queue) {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    return {
      name,
      counts: { waiting, active, completed, failed, delayed },
      isPaused: await queue.isPaused(),
    };
  }
}
