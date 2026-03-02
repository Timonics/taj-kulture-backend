import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class AnalyticsQueueService {
  constructor(@InjectQueue('analytics') private analyticsQueue: Queue) {}

  async trackProductView(data: {
    productId: string;
    userId?: string;
    sessionId: string;
  }) {
    return this.analyticsQueue.add('track-product-view', data, {
      attempts: 2,
      priority: 4, // Low priority
      removeOnComplete: true,
    });
  }

  async trackSearch(data: {
    query: string;
    userId?: string;
    sessionId: string;
    resultsCount: number;
  }) {
    return this.analyticsQueue.add('track-search', data, {
      attempts: 2,
      priority: 4,
    });
  }

  async trackOrder(data: {
    orderId: string;
    userId: string;
    total: number;
    items: any[];
  }) {
    return this.analyticsQueue.add('track-order', data, {
      attempts: 3,
      priority: 2,
    });
  }

  async trackUserRegistration(data: { userId: string; method: string }) {
    return this.analyticsQueue.add('track-registration', data, {
      attempts: 2,
      priority: 3,
    });
  }
}
