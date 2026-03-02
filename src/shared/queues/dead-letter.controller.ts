import {
  Controller,
  Get,
  Post,
  Param,
  Delete,
  UseGuards,
  Body,
} from '@nestjs/common';
import { DeadLetterQueueService } from './dead-letter-queue.service';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { UserRole } from 'generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { Roles } from 'src/core/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt.guard';
import { RolesGuard } from 'src/modules/auth/guards/roles.guard';

@Controller('admin/dead-letters')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class DeadLetterController {
  constructor(
    @InjectQueue('dead-letter') private deadLetterQueue: Queue,
    private deadLetterService: DeadLetterQueueService,
    private prisma: PrismaService,
  ) {}

  @Get()
  async getAllDeadLetters() {
    const jobs = await this.deadLetterQueue.getJobs([
      'waiting',
      'completed',
      'failed',
    ]);

    const deadLetters = await Promise.all(
      jobs.map(async (job) => ({
        id: job.id,
        data: job.data,
        timestamp: job.timestamp,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
        state: await job.getState(),
      })),
    );

    // Get database records
    const dbRecords = await this.prisma.deadLetterJob.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return {
      queue: deadLetters,
      database: dbRecords,
    };
  }

  @Get('stats')
  async getStats() {
    const stats = await this.prisma.deadLetterJob.groupBy({
      by: ['queueName'],
      _count: true,
      where: {
        replayed: false,
      },
    });

    const totalCount = await this.prisma.deadLetterJob.count();
    const replayedCount = await this.prisma.deadLetterJob.count({
      where: { replayed: true },
    });

    return {
      byQueue: stats,
      total: totalCount,
      replayed: replayedCount,
      pending: totalCount - replayedCount,
    };
  }

  @Post(':id/replay')
  async replayJob(
    @Param('id') id: string,
    @Body('targetQueue') targetQueue: string,
  ) {
    await this.deadLetterService.replayJob(id, targetQueue);
    return { message: 'Job replayed successfully' };
  }

  @Post('replay-all/:queue')
  async replayAllFromQueue(@Param('queue') queueName: string) {
    const jobs = await this.deadLetterQueue.getJobs(['waiting', 'failed']);

    let replayed = 0;
    for (const job of jobs) {
      if (job.data.originalQueue === queueName) {
        await this.deadLetterService.replayJob(String(job.id), queueName);
        replayed++;
      }
    }

    return { message: `Replayed ${replayed} jobs` };
  }

  @Delete(':id')
  async removeDeadLetter(@Param('id') id: string) {
    const job = await this.deadLetterQueue.getJob(id);
    if (job) {
      await job.remove();
    }

    await this.prisma.deadLetterJob.deleteMany({
      where: { jobId: id },
    });

    return { message: 'Dead letter removed' };
  }

  @Delete('clear/:queue')
  async clearQueue(@Param('queue') queueName: string) {
    const jobs = await this.deadLetterQueue.getJobs([
      'waiting',
      'failed',
      'completed',
    ]);

    let removed = 0;
    for (const job of jobs) {
      if (job.data.originalQueue === queueName) {
        await job.remove();
        removed++;
      }
    }

    await this.prisma.deadLetterJob.updateMany({
      where: {
        queueName,
        replayed: false,
      },
      data: { replayed: true, replayedAt: new Date() },
    });

    return { message: `Cleared ${removed} dead letters` };
  }
}
