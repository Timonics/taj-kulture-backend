// User Events
export const USER_EVENTS = {
  // Lifecycle
  REGISTERED: 'user.registered',
  VERIFIED: 'user.verified',
  LOGGED_IN: 'user.logged_in',
  LOGGED_OUT: 'user.logged_out',
  DELETED: 'user.deleted',

  // Profile
  PROFILE_UPDATED: 'user.profile_updated',
  ROLE_CHANGED: 'user.role_changed',

  // Password
  PASSWORD_RESET_REQUESTED: 'user.password_reset_requested',
  PASSWORD_CHANGED: 'user.password_changed',

  // Addresses
  ADDRESS_ADDED: 'user.address_added',
  ADDRESS_UPDATED: 'user.address_updated',
  ADDRESS_DELETED: 'user.address_deleted',

  // Social
  FOLLOWED: 'user.followed',
  UNFOLLOWED: 'user.unfollowed',

  // Wishlist
  WISHLIST_UPDATED: 'user.wishlist_updated',
  WISHLIST_ADDED: 'user.wishlist_added',
  WISHLIST_REMOVED: 'user.wishlist_removed',
} as const;

// Vendor Events
export const VENDOR_EVENTS = {
  REGISTERED: 'vendor.registered',
  APPROVED: 'vendor.approved',
  REJECTED: 'vendor.rejected',
  PRODUCT_ADDED: 'vendor.product_added',
  PRODUCT_UPDATED: 'vendor.product_updated',
  VERIFICATION_UPDATED: 'vendor.verification_updated',
  PROFILE_UPDATED: 'vendor.profile_updated',
  FOLLOWED: 'vendor.followed',
  UNFOLLOWED: 'vendor.unfollowed',
} as const;

// Order Events
export const ORDER_EVENTS = {
  CREATED: 'order.created',
  PAID: 'order.paid',
  SHIPPED: 'order.shipped',
  DELIVERED: 'order.delivered',
  CANCELLED: 'order.cancelled',
  REFUNDED: 'order.refunded',
} as const;

// Product Events
export const PRODUCT_EVENTS = {
  CREATED: 'product.created',
  UPDATED: 'product.updated',
  DELETED: 'product.deleted',
  REVIEWED: 'product.reviewed',
  VIEWED: 'product.viewed',
} as const;

// Collection Events
export const COLLECTION_EVENTS = {
  CREATED: 'collection.created',
  UPDATED: 'collection.updated',
  FEATURED: 'collection.featured',
} as const;

// Notification Events
export const NOTIFICATION_EVENTS = {
  EMAIL: 'notification.email',
  SMS: 'notification.sms',
  PUSH: 'notification.push',
  IN_APP: 'notification.in_app',
} as const;

// Analytics Events
export const ANALYTICS_EVENTS = {
  PAGE_VIEW: 'analytics.page_view',
  PRODUCT_VIEW: 'analytics.product_view',
  SEARCH: 'analytics.search',
  CONVERSION: 'analytics.conversion',
} as const;
