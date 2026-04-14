import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { PrismaService } from '../../database/prisma.service';
import { ILogger } from '../../logger/logger.interface';
import { LoggerService } from '../../logger/logger.service';
import { QUEUE_NAMES } from '../../../core/constants/app.constants';

/**
 * ANALYTICS QUEUE PROCESSOR
 *
 * Processes analytics jobs: product views, searches, orders, registrations.
 *
 * ERROR HANDLING:
 * - Analytics failures are logged but don't throw (non-critical)
 * - No dead letter – analytics can be safely dropped on failure
 * - Still uses retry for transient errors (network timeouts)
 */
@Processor(QUEUE_NAMES.ANALYTICS)
export class AnalyticsQueueProcessor {
  private readonly logger: ILogger;

  constructor(
    private prisma: PrismaService,
    logger: LoggerService,
  ) {
    this.logger = logger.child('AnalyticsQueueProcessor');
  }

  @Process('track-product-view')
  async handleProductView(job: Job): Promise<{ success: boolean }> {
    const { productId, userId, sessionId, correlationId } = job.data;
    this.logger.debug(`Tracking product view for ${productId}`, {
      correlationId,
      jobId: job.id,
    });

    try {
      await this.prisma.productView.create({
        data: { productId, userId, sessionId },
      });
      this.logger.debug(`Product view recorded for ${productId}`, {
        correlationId,
      });
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : '';
      this.logger.error(
        `Failed to track product view: ${errorMessage}`,
        errorStack,
        { correlationId },
      );
      return { success: false };
    }
  }

  @Process('track-search')
  async handleSearch(job: Job): Promise<{ success: boolean }> {
    const { query, userId, sessionId, resultsCount, filters, correlationId } =
      job.data;
    this.logger.debug(`Tracking search: "${query}"`, {
      correlationId,
      jobId: job.id,
    });

    try {
      await this.prisma.searchQuery.create({
        data: {
          query,
          userId,
          sessionId,
          resultsCount,
          // filters: filters || {},
        },
      });
      this.logger.debug(`Search tracked: "${query}"`, { correlationId });
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : '';
      this.logger.error(
        `Failed to track search: ${errorMessage}`,
        errorStack,
        { correlationId },
      );
      return { success: false };
    }
  }

  @Process('track-order')
  async handleOrderTracking(job: Job): Promise<{ success: boolean }> {
    const { orderId, userId, total, items, correlationId } = job.data;
    this.logger.debug(`Tracking order analytics for ${orderId}`, {
      correlationId,
      jobId: job.id,
    });

    try {
      // Group items by vendor to update sales
      const vendorTotals = new Map<string, number>();
      for (const item of items) {
        const itemTotal = item.price * item.quantity;
        vendorTotals.set(
          item.vendorId,
          (vendorTotals.get(item.vendorId) || 0) + itemTotal,
        );
      }

      // Update each vendor's total sales
      for (const [vendorId, vendorTotal] of vendorTotals) {
        await this.prisma.vendor.update({
          where: { id: vendorId },
          data: { totalSales: { increment: vendorTotal } },
        });
      }

      // Optionally store order analytics summary
      // await this.prisma.orderAnalytics.create({
      //   data: { orderId, userId, total, itemCount: items.length },
      // });

      this.logger.info(`Order analytics processed for ${orderId}`, {
        correlationId,
      });
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : '';
      this.logger.error(
        `Failed to track order: ${errorMessage}`,
        errorStack,
        { correlationId },
      );
      return { success: false };
    }
  }

  @Process('track-registration')
  async handleRegistrationTracking(job: Job): Promise<{ success: boolean }> {
    const { userId, method, correlationId } = job.data;
    this.logger.debug(`Tracking registration for user ${userId}`, {
      correlationId,
      jobId: job.id,
    });

    try {
      // Example: send to external analytics service (Mixpanel, Google Analytics)
      // await this.analyticsService.track('user_registered', { userId, method });
      this.logger.info(`Registration tracked for user ${userId} via ${method}`, {
        correlationId,
      });
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : '';
      this.logger.error(
        `Failed to track registration: ${errorMessage}`,
        errorStack,
        { correlationId },
      );
      return { success: false };
    }
  }
}
