/**
 * EVENT PAYLOADS - Single source of truth for all event data structures
 * 
 * WHY SEPARATE FILE:
 * - Prevents circular imports between event-bus and handlers
 * - Easier to find and modify payload types
 * - Can be imported by other modules without pulling in the whole event system
 * 
 * NAMING CONVENTION:
 * - {Domain}{Action}Payload
 * - Example: UserRegisteredPayload, OrderCreatedPayload
 */

// ============================================================
// USER EVENT PAYLOADS
// ============================================================

export interface UserRegisteredPayload {
  userId: string;
  email: string;
  name: string;
  verificationToken: string;
  registrationMethod: 'email' | 'google' | 'facebook' | 'email-resend';
}

export interface UserVerifiedPayload {
  userId: string;
  email: string;
  name: string;
  verifiedAt: Date;
}

export interface UserProfileUpdatedPayload {
  userId: string;
  changes?: Record<string, any>;
}

export interface UserLoggedInPayload {
  userId: string;
  email: string;
  ipAddress?: string;
  userAgent?: string;
  loginMethod: 'email' | 'google' | 'facebook';
  timestamp: Date;
}

export interface UserLoggedOutPayload {
  userId: string;
  timestamp: Date;
}

export interface UserDeletedPayload {
  userId: string;
  email: string;
  reason?: string;
  deletedAt: Date;
}

export interface UserRoleChangedPayload {
  userId: string;
  oldRole: string;
  newRole: string;
  changedAt: Date;
}

export interface PasswordResetRequestedPayload {
  userId: string;
  email: string;
  name: string;
  resetToken: string;
  expiresAt: Date;
  ipAddress?: string;
}

export interface PasswordChangedPayload {
  userId: string;
  changedAt: Date;
  ipAddress?: string;
}

export interface UserFollowedPayload {
  followerId: string;
  followingId: string;
  followerName: string;
  followingName: string;
  timestamp: Date;
}

export interface UserUnfollowedPayload {
  followerId: string;
  followingId: string;
  timestamp: Date;
}

export interface UserWishlistUpdatedPayload {
  userId: string;
  productId: string;
  action: 'added' | 'removed';
  timestamp: Date;
}

export interface UserWishlistAddedPayload {
  userId: string;
  productId: string;
  productName: string;
  timestamp: Date;
}

export interface UserWishlistRemovedPayload {
  userId: string;
  productId: string;
  productName: string;
  timestamp: Date;
}

// ============================================================
// VENDOR EVENT PAYLOADS
// ============================================================

export interface VendorRegisteredPayload {
  vendorId: string;
  userId: string;
  name: string;
  email: string;
  categoryIds?: string[];
  appliedAt: Date;
}

export interface VendorApprovedPayload {
  vendorId: string;
  userId: string;
  name: string;
  email: string;
  approvedBy: string;
  approvedAt: Date;
}

export interface VendorRejectedPayload {
  vendorId: string;
  userId: string;
  name: string;
  email: string;
  reason?: string;
  rejectedBy: string;
  rejectedAt: Date;
}

export interface VendorProductAddedPayload {
  vendorId: string;
  vendorName: string;
  productId: string;
  productName: string;
  productSlug: string;
  addedAt: Date;
}

export interface VendorProductUpdatedPayload {
  vendorId: string;
  productId: string;
  productName: string;
  updatedFields: string[];
}

export interface VendorVerificationUpdatedPayload {
  vendorId: string;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED';
  updatedBy: string;
  updatedAt: Date;
}

export interface VendorProfileUpdatedPayload {
  vendorId: string;
  updatedFields: string[];
}

export interface VendorFollowedPayload {
  vendorId: string;
  userId: string;
  vendorName: string;
  userName: string;
  timestamp: Date;
}

export interface VendorUnfollowedPayload {
  vendorId: string;
  userId: string;
  timestamp: Date;
}

// ============================================================
// ORDER EVENT PAYLOADS
// ============================================================

export interface OrderCreatedPayload {
  orderId: string;
  orderNumber: string;
  userId: string;
  userEmail: string;
  userName: string;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    price: number;
  }>;
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  shippingAddress: any;
  createdAt: Date;
}

export interface OrderPaidPayload {
  orderId: string;
  orderNumber: string;
  userId: string;
  userEmail: string;
  paymentMethod: string;
  paymentId: string;
  paidAt: Date;
  amount: number;
}

export interface OrderShippedPayload {
  orderId: string;
  orderNumber: string;
  userId: string;
  userEmail: string;
  userName: string;
  trackingNumber: string;
  carrier: string;
  estimatedDelivery?: Date;
  shippedAt: Date;
}

export interface OrderDeliveredPayload {
  orderId: string;
  orderNumber: string;
  userId: string;
  userEmail: string;
  deliveredAt: Date;
}

export interface OrderCancelledPayload {
  orderId: string;
  orderNumber: string;
  userId: string;
  userEmail: string;
  reason?: string;
  cancelledBy: 'user' | 'admin' | 'system';
  cancelledAt: Date;
}

export interface OrderRefundedPayload {
  orderId: string;
  orderNumber: string;
  userId: string;
  userEmail: string;
  refundAmount: number;
  refundReason?: string;
  refundedAt: Date;
}

// ============================================================
// PRODUCT EVENT PAYLOADS
// ============================================================

export interface ProductCreatedPayload {
  productId: string;
  vendorId: string;
  vendorName: string;
  name: string;
  slug: string;
  price: number;
  categoryId?: string;
  createdAt: Date;
}

export interface ProductUpdatedPayload {
  productId: string;
  vendorId: string;
  updatedFields: string[];
}

export interface ProductDeletedPayload {
  productId: string;
  vendorId: string;
  productName: string;
  deletedAt: Date;
}

export interface ProductViewedPayload {
  productId: string;
  userId?: string;
  sessionId?: string;
}

export interface ProductReviewedPayload {
  reviewId: string;
  productId: string;
  productName: string;
  userId: string;
  userName: string;
  rating: number;
  reviewTitle?: string;
  createdAt: Date;
}

// ============================================================
// COLLECTION EVENT PAYLOADS
// ============================================================

export interface CollectionCreatedPayload {
  collectionId: string;
  vendorId?: string;
  name: string;
  slug: string;
  type: string;
  productCount: number;
  createdAt: Date;
}

export interface CollectionUpdatedPayload {
  collectionId: string;
  vendorId?: string;
  updatedFields: string[];
}

export interface CollectionFeaturedPayload {
  collectionId: string;
  name: string;
  isFeatured: boolean;
  updatedBy: string;
}

// ============================================================
// NOTIFICATION PAYLOADS
// ============================================================

export interface EmailPayload {
  to: string | string[];
  subject: string;
  template: string;
  context: Record<string, any>;
  from?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content?: any;
    path?: string;
  }>;
  priority?: 'high' | 'normal' | 'low';
  metadata?: {
    userId?: string;
    correlationId?: string;
  };
}

export interface InAppNotificationPayload {
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  data?: Record<string, any>;
  actionUrl?: string;
  imageUrl?: string;
  expiresAt?: Date;
  priority?: 'high' | 'normal' | 'low';
}

export interface SmsPayload {
  to: string;
  message: string;
  template?: string;
  context?: Record<string, any>;
  priority?: 'high' | 'normal' | 'low';
}

export interface PushNotificationPayload {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  imageUrl?: string;
  badge?: number;
  sound?: string;
}

// ============================================================
// ANALYTICS PAYLOADS
// ============================================================

export interface PageViewPayload {
  userId?: string;
  sessionId: string;
  page: string;
  referrer?: string;
  userAgent?: string;
  ipAddress?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface ProductViewPayload {
  productId: string;
  productName: string;
  vendorId: string;
  userId?: string;
  sessionId: string;
  viewDuration?: number;
  timestamp: Date;
}

export interface SearchPayload {
  query: string;
  userId?: string;
  sessionId: string;
  resultsCount: number;
  filters?: Record<string, any>;
  timestamp: Date;
}

export interface ConversionPayload {
  conversionType: 'order' | 'signup' | 'review' | 'follow';
  value?: number;
  userId?: string;
  metadata: Record<string, any>;
  timestamp: Date;
}