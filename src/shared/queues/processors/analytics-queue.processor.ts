import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { PrismaService } from '../../database/prisma.service';

@Processor('analytics')
export class AnalyticsQueueProcessor {
  private readonly logger = new Logger(AnalyticsQueueProcessor.name);

  constructor(private prisma: PrismaService) {}

  @Process('track-product-view')
  async handleProductView(job: Job) {
    this.logger.debug(`Processing product view job ${job.id}`);

    try {
      const { productId, userId, sessionId } = job.data;

      await this.prisma.productView.create({
        data: {
          productId,
          userId,
          sessionId,
        },
      });

      // Update product view count (if you have such a field)
      // await this.prisma.product.update({
      //   where: { id: productId },
      //   data: { viewCount: { increment: 1 } },
      // });

      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to track product view: ${error.message}`);
      // Don't throw - analytics failures shouldn't break the app
      // Just log and continue
      return { success: false, error: error.message };
    }
  }

  @Process('track-search')
  async handleSearch(job: Job) {
    this.logger.debug(`Processing search tracking job ${job.id}`);

    try {
      const { query, userId, sessionId, resultsCount } = job.data;

      await this.prisma.searchQuery.create({
        data: {
          query,
          userId,
          sessionId,
          resultsCount,
        },
      });

      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to track search: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  @Process('track-order')
  async handleOrderTracking(job: Job) {
    this.logger.log(`Processing order tracking job ${job.id}`);

    try {
      const { orderId, userId, total, items } = job.data;

      // You might want to update vendor stats here
      // Group items by vendor
      const vendorTotals = items.reduce((acc: any, item: any) => {
        acc[item.vendorId] = (acc[item.vendorId] || 0) + item.total;
        return acc;
      }, {});

      // Update each vendor's sales
      for (const [vendorId, vendorTotal] of Object.entries(vendorTotals)) {
        await this.prisma.vendor.update({
          where: { id: vendorId },
          data: {
            totalSales: { increment: vendorTotal as number },
          },
        });
      }

      this.logger.log(`Order ${orderId} analytics processed`);
      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to track order: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  @Process('track-registration')
  async handleRegistrationTracking(job: Job) {
    this.logger.log(`Processing registration tracking job ${job.id}`);

    try {
      const { userId, method } = job.data;

      // Send to external analytics (Google Analytics, Mixpanel, etc.)
      // await this.analyticsService.trackEvent('user_registered', { userId, method });

      this.logger.log(`Registration tracked for user ${userId}`);
      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to track registration: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}
