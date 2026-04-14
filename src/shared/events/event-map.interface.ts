/**
 * EVENT MAP - Maps event names to their payload types
 *
 * WHY NEEDED:
 * - Provides full type safety when emitting events
 * - TypeScript will enforce that payload matches event name
 *
 * @example
 * eventBus.emit({
 *   name: USER_EVENTS.REGISTERED,
 *   payload: { userId: '123', email: 'test@example.com', ... }
 * });
 */

import {
  USER_EVENTS,
  VENDOR_EVENTS,
  ORDER_EVENTS,
  PRODUCT_EVENTS,
  COLLECTION_EVENTS,
  NOTIFICATION_EVENTS,
  ANALYTICS_EVENTS,
} from './event-types';

import type {
  UserRegisteredPayload,
  UserVerifiedPayload,
  UserLoggedInPayload,
  UserLoggedOutPayload,
  UserDeletedPayload,
  UserProfileUpdatedPayload,
  UserRoleChangedPayload,
  PasswordResetRequestedPayload,
  PasswordChangedPayload,
  UserFollowedPayload,
  UserUnfollowedPayload,
  UserWishlistUpdatedPayload,
  UserWishlistAddedPayload,
  UserWishlistRemovedPayload,
  VendorRegisteredPayload,
  VendorApprovedPayload,
  VendorRejectedPayload,
  VendorProductAddedPayload,
  VendorProductUpdatedPayload,
  VendorVerificationUpdatedPayload,
  VendorProfileUpdatedPayload,
  VendorFollowedPayload,
  VendorUnfollowedPayload,
  OrderCreatedPayload,
  OrderPaidPayload,
  OrderShippedPayload,
  OrderDeliveredPayload,
  OrderCancelledPayload,
  OrderRefundedPayload,
  ProductCreatedPayload,
  ProductUpdatedPayload,
  ProductDeletedPayload,
  ProductViewedPayload,
  ProductReviewedPayload,
  CollectionCreatedPayload,
  CollectionUpdatedPayload,
  CollectionFeaturedPayload,
  EmailPayload,
  InAppNotificationPayload,
  SmsPayload,
  PushNotificationPayload,
  PageViewPayload,
  ProductViewPayload,
  SearchPayload,
  ConversionPayload,
} from './event-payloads.interface';

export interface EventMap {
  // User events
  [USER_EVENTS.REGISTERED]: UserRegisteredPayload;
  [USER_EVENTS.VERIFIED]: UserVerifiedPayload;
  [USER_EVENTS.LOGGED_IN]: UserLoggedInPayload;
  [USER_EVENTS.LOGGED_OUT]: UserLoggedOutPayload;
  [USER_EVENTS.DELETED]: UserDeletedPayload;
  [USER_EVENTS.PROFILE_UPDATED]: UserProfileUpdatedPayload;
  [USER_EVENTS.ROLE_CHANGED]: UserRoleChangedPayload;
  [USER_EVENTS.PASSWORD_RESET_REQUESTED]: PasswordResetRequestedPayload;
  [USER_EVENTS.PASSWORD_CHANGED]: PasswordChangedPayload;
  [USER_EVENTS.FOLLOWED]: UserFollowedPayload;
  [USER_EVENTS.UNFOLLOWED]: UserUnfollowedPayload;
  [USER_EVENTS.WISHLIST_UPDATED]: UserWishlistUpdatedPayload;
  [USER_EVENTS.WISHLIST_ADDED]: UserWishlistAddedPayload;
  [USER_EVENTS.WISHLIST_REMOVED]: UserWishlistRemovedPayload;

  // Vendor events
  [VENDOR_EVENTS.REGISTERED]: VendorRegisteredPayload;
  [VENDOR_EVENTS.APPROVED]: VendorApprovedPayload;
  [VENDOR_EVENTS.REJECTED]: VendorRejectedPayload;
  [VENDOR_EVENTS.PRODUCT_ADDED]: VendorProductAddedPayload;
  [VENDOR_EVENTS.PRODUCT_UPDATED]: VendorProductUpdatedPayload;
  [VENDOR_EVENTS.VERIFICATION_UPDATED]: VendorVerificationUpdatedPayload;
  [VENDOR_EVENTS.PROFILE_UPDATED]: VendorProfileUpdatedPayload;
  [VENDOR_EVENTS.FOLLOWED]: VendorFollowedPayload;
  [VENDOR_EVENTS.UNFOLLOWED]: VendorUnfollowedPayload;

  // Order events
  [ORDER_EVENTS.CREATED]: OrderCreatedPayload;
  [ORDER_EVENTS.PAID]: OrderPaidPayload;
  [ORDER_EVENTS.SHIPPED]: OrderShippedPayload;
  [ORDER_EVENTS.DELIVERED]: OrderDeliveredPayload;
  [ORDER_EVENTS.CANCELLED]: OrderCancelledPayload;
  [ORDER_EVENTS.REFUNDED]: OrderRefundedPayload;

  // Product events
  [PRODUCT_EVENTS.CREATED]: ProductCreatedPayload;
  [PRODUCT_EVENTS.UPDATED]: ProductUpdatedPayload;
  [PRODUCT_EVENTS.DELETED]: ProductDeletedPayload;
  [PRODUCT_EVENTS.VIEWED]: ProductViewedPayload;
  [PRODUCT_EVENTS.REVIEWED]: ProductReviewedPayload;

  // Collection events
  [COLLECTION_EVENTS.CREATED]: CollectionCreatedPayload;
  [COLLECTION_EVENTS.UPDATED]: CollectionUpdatedPayload;
  [COLLECTION_EVENTS.FEATURED]: CollectionFeaturedPayload;

  // Notification events
  [NOTIFICATION_EVENTS.EMAIL]: EmailPayload;
  [NOTIFICATION_EVENTS.SMS]: SmsPayload;
  [NOTIFICATION_EVENTS.PUSH]: PushNotificationPayload;
  [NOTIFICATION_EVENTS.IN_APP]: InAppNotificationPayload;

  // Analytics events
  [ANALYTICS_EVENTS.PAGE_VIEW]: PageViewPayload;
  [ANALYTICS_EVENTS.PRODUCT_VIEW]: ProductViewPayload;
  [ANALYTICS_EVENTS.SEARCH]: SearchPayload;
  [ANALYTICS_EVENTS.CONVERSION]: ConversionPayload;
}

/**
 * Base event structure with metadata for tracing
 */
export interface BaseEvent<T extends keyof EventMap = keyof EventMap> {
  name: T;
  payload: EventMap[T];
  metadata?: {
    timestamp: Date;
    correlationId?: string;
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
    version?: number; // For future event versioning
  };
}
