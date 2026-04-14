import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationQueueService } from '../../queues/notification-queue.service';
import { PrismaService } from '../../database/prisma.service';
import { BaseEvent } from '../event-map.interface';
import { 
  USER_EVENTS, 
  ORDER_EVENTS,
  VENDOR_EVENTS 
} from '../event-types';
import {
  OrderCreatedPayload,
  OrderShippedPayload,
  VendorProductAddedPayload,
  UserRegisteredPayload,
  UserFollowedPayload,
  VendorFollowedPayload,
  OrderDeliveredPayload,
  OrderCancelledPayload,
} from '../event-payloads.interface';

@Injectable()
export class NotificationEventHandler {
  private readonly logger = new Logger(NotificationEventHandler.name);

  constructor(
    private notificationQueue: NotificationQueueService,
    private prisma: PrismaService,
  ) {}

  @OnEvent(ORDER_EVENTS.CREATED)
  async handleOrderCreated(event: BaseEvent<typeof ORDER_EVENTS.CREATED>) {
    const payload = event.payload as OrderCreatedPayload;
    this.logger.log(`🔔 Queueing order notification for order ${payload.orderNumber}`);
    
    // Notify customer
    await this.notificationQueue.createInAppNotification({
      userId: payload.userId,
      title: 'Order Confirmed 🎉',
      message: `Your order #${payload.orderNumber} has been confirmed. We'll notify you when it ships.`,
      type: 'success',
      data: { 
        orderId: payload.orderId, 
        orderNumber: payload.orderNumber 
      },
      actionUrl: `/orders/${payload.orderId}`,
    });

    // Notify vendors who have items in this order
    const vendorIds = [...new Set(payload.items.map(item => item.productId))];
    // Note: You'd need to fetch vendor IDs from product IDs
    
    this.logger.log(`Order notification queued for user ${payload.userId}`);
  }

  @OnEvent(ORDER_EVENTS.SHIPPED)
  async handleOrderShipped(event: BaseEvent<typeof ORDER_EVENTS.SHIPPED>) {
    const payload = event.payload as OrderShippedPayload;
    this.logger.log(`🔔 Queueing shipment notification for order ${payload.orderNumber}`);
    
    await this.notificationQueue.createInAppNotification({
      userId: payload.userId,
      title: 'Order Shipped 🚚',
      message: `Great news! Your order #${payload.orderNumber} is on its way. Track it with #${payload.trackingNumber}`,
      type: 'info',
      data: { 
        orderId: payload.orderId, 
        orderNumber: payload.orderNumber,
        trackingNumber: payload.trackingNumber,
      },
      actionUrl: `/orders/${payload.orderId}/track`,
    });
  }

  @OnEvent(ORDER_EVENTS.DELIVERED)
  async handleOrderDelivered(event: BaseEvent<typeof ORDER_EVENTS.DELIVERED>) {
    const payload = event.payload as OrderDeliveredPayload;
    this.logger.log(`🔔 Queueing delivery notification for order ${payload.orderNumber}`);
    
    await this.notificationQueue.createInAppNotification({
      userId: payload.userId,
      title: 'Order Delivered ✅',
      message: `Your order #${payload.orderNumber} has been delivered. Enjoy your purchase! Leave a review?`,
      type: 'success',
      data: { 
        orderId: payload.orderId, 
        orderNumber: payload.orderNumber 
      },
      actionUrl: `/orders/${payload.orderId}/review`,
    });
  }

  @OnEvent(ORDER_EVENTS.CANCELLED)
  async handleOrderCancelled(event: BaseEvent<typeof ORDER_EVENTS.CANCELLED>) {
    const payload = event.payload as OrderCancelledPayload;
    this.logger.log(`🔔 Queueing cancellation notification for order ${payload.orderNumber}`);
    
    await this.notificationQueue.createInAppNotification({
      userId: payload.userId,
      title: 'Order Cancelled',
      message: `Your order #${payload.orderNumber} has been cancelled.${payload.reason ? ` Reason: ${payload.reason}` : ''}`,
      type: 'warning',
      data: { 
        orderId: payload.orderId, 
        orderNumber: payload.orderNumber, 
        reason: payload.reason 
      },
      actionUrl: `/orders/${payload.orderId}`,
    });
  }

  @OnEvent(VENDOR_EVENTS.PRODUCT_ADDED)
  async handleProductAdded(event: BaseEvent<typeof VENDOR_EVENTS.PRODUCT_ADDED>) {
    const payload = event.payload as VendorProductAddedPayload;
    this.logger.log(`🔔 Queueing product notifications for followers of vendor ${payload.vendorId}`);
    
    // Get vendor followers
    const followers = await this.prisma.vendorFollow.findMany({
      where: { vendorId: payload.vendorId },
      select: { userId: true },
    });

    if (followers.length > 0) {
      await this.notificationQueue.createBulkNotifications({
        userIds: followers.map(f => f.userId),
        title: 'New Product from Vendor You Follow ✨',
        message: `${payload.vendorName} just added a new product: ${payload.productName}`,
        type: 'info',
        // data: { 
        //   vendorId: payload.vendorId, 
        //   productId: payload.productId,
        //   productSlug: payload.productSlug,
        // },
        // actionUrl: `/products/${payload.productSlug}`,
      });
      
      this.logger.log(`Product notifications queued for ${followers.length} followers`);
    }
  }

  @OnEvent(USER_EVENTS.REGISTERED)
  async handleWelcomeNotification(event: BaseEvent<typeof USER_EVENTS.REGISTERED>) {
    const payload = event.payload as UserRegisteredPayload;
    this.logger.log(`🔔 Queueing welcome notification for user ${payload.userId}`);
    
    await this.notificationQueue.createInAppNotification({
      userId: payload.userId,
      title: 'Welcome to Taj Kulture! 🎉',
      message: 'We\'re excited to have you. Start exploring cultural treasures and get 10% off your first order!',
      type: 'success',
      data: { tip: 'Check out our featured collections' },
      actionUrl: '/collections/featured',
    });
  }

  @OnEvent(USER_EVENTS.FOLLOWED)
  async handleUserFollowed(event: BaseEvent<typeof USER_EVENTS.FOLLOWED>) {
    const payload = event.payload as UserFollowedPayload;
    this.logger.log(`🔔 Creating follow notification`);
    
    await this.notificationQueue.createInAppNotification({
      userId: payload.followingId,
      title: 'New Follower 👥',
      message: `${payload.followerName} started following you!`,
      type: 'info',
      data: { followerId: payload.followerId },
      actionUrl: `/profile/${payload.followerId}`,
    });
  }

  @OnEvent(VENDOR_EVENTS.FOLLOWED)
  async handleVendorFollowed(event: BaseEvent<typeof VENDOR_EVENTS.FOLLOWED>) {
    const payload = event.payload as VendorFollowedPayload;
    this.logger.log(`🔔 Creating vendor follow notification`);
    
    await this.notificationQueue.createInAppNotification({
      userId: payload.userId,
      title: 'New Store Follower 🏪',
      message: `${payload.userName} started following your store!`,
      type: 'info',
      data: { vendorId: payload.vendorId, followerId: payload.userId },
      actionUrl: `/vendors/${payload.vendorId}/followers`,
    });
  }
}