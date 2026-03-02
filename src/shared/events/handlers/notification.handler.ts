import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationQueueService } from '../../queues/notification-queue.service';
import { PrismaService } from '../../database/prisma.service';
import { 
  USER_EVENTS, 
  ORDER_EVENTS,
  VENDOR_EVENTS 
} from '../event-types';

@Injectable()
export class NotificationEventHandler {
  constructor(
    private notificationQueue: NotificationQueueService,
    private prisma: PrismaService,
  ) {}

  @OnEvent(ORDER_EVENTS.CREATED)
  async handleOrderCreated(payload: any) {
    console.log('🔔 Queueing order notification', payload);
    
    await this.notificationQueue.createInAppNotification({
      userId: payload.userId,
      title: 'Order Confirmed',
      message: `Your order #${payload.orderNumber} has been confirmed.`,
      type: 'success',
      data: { orderId: payload.orderId },
    });
  }

  @OnEvent(ORDER_EVENTS.SHIPPED)
  async handleOrderShipped(payload: any) {
    console.log('🔔 Queueing shipment notification', payload);
    
    await this.notificationQueue.createInAppNotification({
      userId: payload.userId,
      title: 'Order Shipped',
      message: `Your order #${payload.orderNumber} is on its way!`,
      type: 'info',
      data: { 
        orderId: payload.orderId,
        trackingNumber: payload.trackingNumber 
      },
    });
  }

  @OnEvent(VENDOR_EVENTS.PRODUCT_ADDED)
  async handleProductAdded(payload: any) {
    console.log('🔔 Queueing product notifications for followers', payload);
    
    // Get vendor followers
    const followers = await this.prisma.vendorFollow.findMany({
      where: { vendorId: payload.vendorId },
      select: { userId: true },
    });

    if (followers.length > 0) {
      await this.notificationQueue.createBulkNotifications({
        userIds: followers.map(f => f.userId),
        title: 'New Product Available',
        message: `${payload.vendorName} added a new product: ${payload.productName}`,
        type: 'info',
      });
    }
  }

  @OnEvent(USER_EVENTS.REGISTERED)
  async handleWelcomeNotification(payload: any) {
    console.log('🔔 Queueing welcome notification', payload);
    
    await this.notificationQueue.createInAppNotification({
      userId: payload.userId,
      title: 'Welcome to Taj Kulture!',
      message: 'We\'re excited to have you. Start exploring cultural treasures!',
      type: 'success',
      data: { tip: 'Check out our featured collections' },
    });
  }
}