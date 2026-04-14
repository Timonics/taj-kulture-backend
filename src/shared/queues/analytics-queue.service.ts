import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { QUEUE_NAMES } from 'src/core/constants/app.constants';
import {
  TrackOrderJobData,
  TrackProductViewJobData,
  TrackRegistrationJobData,
  TrackSearchJobData,
} from './interfaces';

/**
 * ANALYTICS QUEUE SERVICE
 *
 * Adds analytics jobs to Bull queue for async processing.
 *
 * WHY QUEUE FOR ANALYTICS:
 * - Analytics shouldn't block HTTP responses
 * - Can batch multiple events
 * - Retry on failure (external analytics services may be slow)
 * - Low priority – can process when idle
 *
 * JOB TYPES:
 * - track-product-view: Record product view for recommendations
 * - track-search: Store search queries for analytics
 * - track-order: Update vendor sales metrics
 * - track-registration: User signup analytics
 */
@Injectable()
export class AnalyticsQueueService {
  constructor(
    @InjectQueue(QUEUE_NAMES.ANALYTICS) private analyticsQueue: Queue,
  ) {}

  async trackProductView(data: TrackProductViewJobData) {
    return this.analyticsQueue.add('track-product-view', data, {
      attempts: 2,
      priority: 4, // Low priority
      removeOnComplete: true,
      jobId: `product-view:${data.productId}:${data.sessionId}:${Date.now()}`,
    });
  }

  async trackSearch(data: TrackSearchJobData) {
    return this.analyticsQueue.add('track-search', data, {
      attempts: 2,
      priority: 4,
      jobId: `search:${data.sessionId}:${Date.now()}`,
    });
  }

  async trackOrder(data: TrackOrderJobData) {
    return this.analyticsQueue.add('track-order', data, {
      attempts: 3,
      priority: 2,
      jobId: `order:${data.orderId}`,
    });
  }

  async trackUserRegistration(data: TrackRegistrationJobData) {
    return this.analyticsQueue.add('track-registration', data, {
      attempts: 2,
      priority: 3,
      jobId: `registration:${data.userId}`,
    });
  }
}
