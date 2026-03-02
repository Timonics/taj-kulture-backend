// src/shared/events/event-bus.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EventPayload } from './event-payloads.interface';
import { USER_EVENTS, VENDOR_EVENTS, ORDER_EVENTS, PRODUCT_EVENTS, COLLECTION_EVENTS, NOTIFICATION_EVENTS, ANALYTICS_EVENTS } from './event-types';

// Event name to payload type mapping
export interface EventMap {
  // User events
  [USER_EVENTS.REGISTERED]: import('./event-payloads.interface').UserRegisteredPayload;
  [USER_EVENTS.VERIFIED]: import('./event-payloads.interface').UserVerifiedPayload;
  [USER_EVENTS.LOGGED_IN]: import('./event-payloads.interface').UserLoggedInPayload;
  [USER_EVENTS.LOGGED_OUT]: import('./event-payloads.interface').UserLoggedOutPayload;
  [USER_EVENTS.DELETED]: import('./event-payloads.interface').UserDeletedPayload;
  [USER_EVENTS.PROFILE_UPDATED]: import('./event-payloads.interface').UserProfileUpdatedPayload;
  [USER_EVENTS.ROLE_CHANGED]: import('./event-payloads.interface').UserRoleChangedPayload;
  [USER_EVENTS.PASSWORD_RESET_REQUESTED]: import('./event-payloads.interface').PasswordResetRequestedPayload;
  [USER_EVENTS.PASSWORD_CHANGED]: import('./event-payloads.interface').PasswordChangedPayload;
  [USER_EVENTS.FOLLOWED]: import('./event-payloads.interface').UserFollowedPayload;
  [USER_EVENTS.UNFOLLOWED]: import('./event-payloads.interface').UserUnfollowedPayload;

  // Vendor events
  [VENDOR_EVENTS.REGISTERED]: import('./event-payloads.interface').VendorRegisteredPayload;
  [VENDOR_EVENTS.APPROVED]: import('./event-payloads.interface').VendorApprovedPayload;
  [VENDOR_EVENTS.REJECTED]: import('./event-payloads.interface').VendorRejectedPayload;
  [VENDOR_EVENTS.PRODUCT_ADDED]: import('./event-payloads.interface').VendorProductAddedPayload;
  [VENDOR_EVENTS.PRODUCT_UPDATED]: import('./event-payloads.interface').VendorProductUpdatedPayload;
  [VENDOR_EVENTS.VERIFICATION_UPDATED]: import('./event-payloads.interface').VendorVerificationUpdatedPayload;
  [VENDOR_EVENTS.PROFILE_UPDATED]: import('./event-payloads.interface').VendorProfileUpdatedPayload;
  [VENDOR_EVENTS.FOLLOWED]: import('./event-payloads.interface').VendorFollowedPayload;
  [VENDOR_EVENTS.UNFOLLOWED]: import('./event-payloads.interface').VendorUnfollowedPayload;

  // Order events
  [ORDER_EVENTS.CREATED]: import('./event-payloads.interface').OrderCreatedPayload;
  [ORDER_EVENTS.PAID]: import('./event-payloads.interface').OrderPaidPayload;
  [ORDER_EVENTS.SHIPPED]: import('./event-payloads.interface').OrderShippedPayload;
  [ORDER_EVENTS.DELIVERED]: import('./event-payloads.interface').OrderDeliveredPayload;
  [ORDER_EVENTS.CANCELLED]: import('./event-payloads.interface').OrderCancelledPayload;
  [ORDER_EVENTS.REFUNDED]: import('./event-payloads.interface').OrderRefundedPayload;

  // Product events
  [PRODUCT_EVENTS.CREATED]: import('./event-payloads.interface').ProductCreatedPayload;
  [PRODUCT_EVENTS.UPDATED]: import('./event-payloads.interface').ProductUpdatedPayload;
  [PRODUCT_EVENTS.DELETED]: import('./event-payloads.interface').ProductDeletedPayload;
  [PRODUCT_EVENTS.REVIEWED]: import('./event-payloads.interface').ProductReviewedPayload;

  // Collection events
  [COLLECTION_EVENTS.CREATED]: import('./event-payloads.interface').CollectionCreatedPayload;
  [COLLECTION_EVENTS.UPDATED]: import('./event-payloads.interface').CollectionUpdatedPayload;
  [COLLECTION_EVENTS.FEATURED]: import('./event-payloads.interface').CollectionFeaturedPayload;

  // Notification events
  [NOTIFICATION_EVENTS.EMAIL]: import('./event-payloads.interface').EmailPayload;
  [NOTIFICATION_EVENTS.SMS]: import('./event-payloads.interface').SmsPayload;
  [NOTIFICATION_EVENTS.PUSH]: import('./event-payloads.interface').PushNotificationPayload;
  [NOTIFICATION_EVENTS.IN_APP]: import('./event-payloads.interface').InAppNotificationPayload;

  // Analytics events
  [ANALYTICS_EVENTS.PAGE_VIEW]: import('./event-payloads.interface').PageViewPayload;
  [ANALYTICS_EVENTS.PRODUCT_VIEW]: import('./event-payloads.interface').ProductViewPayload;
  [ANALYTICS_EVENTS.SEARCH]: import('./event-payloads.interface').SearchPayload;
  [ANALYTICS_EVENTS.CONVERSION]: import('./event-payloads.interface').ConversionPayload;
}

export interface BaseEvent<T extends keyof EventMap = keyof EventMap> {
  name: T;
  payload: EventMap[T];
  metadata?: {
    correlationId?: string;
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
  };
}

@Injectable()
export class EventBus {
  private readonly logger = new Logger(EventBus.name);

  constructor(private eventEmitter: EventEmitter2) {}

  emit<T extends keyof EventMap>(event: BaseEvent<T>): void {
    const enrichedEvent = {
      ...event,
      metadata: {
        timestamp: new Date(),
        correlationId: this.generateCorrelationId(),
        ...event.metadata,
      },
    };

    this.logger.debug(`📢 Event emitted: ${String(event.name)}`);
    this.eventEmitter.emit(event.name, enrichedEvent);
  }

  async emitAsync<T extends keyof EventMap>(event: BaseEvent<T>): Promise<any[]> {
    const enrichedEvent = {
      ...event,
      metadata: {
        timestamp: new Date(),
        correlationId: this.generateCorrelationId(),
        ...event.metadata,
      },
    };

    this.logger.debug(`📢 Async event emitted: ${String(event.name)}`);
    return this.eventEmitter.emitAsync(event.name, enrichedEvent);
  }

  on<T extends keyof EventMap>(
    eventName: T,
    handler: (payload: BaseEvent<T>) => void | Promise<void>,
  ): void {
    this.eventEmitter.on(eventName, handler);
  }

  private generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}