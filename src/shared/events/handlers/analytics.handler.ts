import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AnalyticsQueueService } from '../../queues/analytics-queue.service';
import {
  USER_EVENTS,
  PRODUCT_EVENTS,
  ORDER_EVENTS,
} from '../event-types';
import {
  UserRegisteredPayload,
  ProductViewedPayload,
  OrderCreatedPayload,
  ConversionPayload,
  OrderPaidPayload,
} from '../event-payloads.interface';
import { BaseEvent } from '../event-map.interface';

@Injectable()
export class AnalyticsEventHandler {
  private readonly logger = new Logger(AnalyticsEventHandler.name);

  constructor(private analyticsQueue: AnalyticsQueueService) {}

  @OnEvent(PRODUCT_EVENTS.VIEWED)
  async handleProductView(event: BaseEvent<typeof PRODUCT_EVENTS.VIEWED>) {
    const payload = event.payload as ProductViewedPayload;
    this.logger.debug(`📊 Queueing product view tracking for product ${payload.productId}`);

    await this.analyticsQueue.trackProductView({
      productId: payload.productId,
      userId: payload.userId,
      sessionId: payload.sessionId!,
    });
  }

  @OnEvent(ORDER_EVENTS.CREATED)
  async handleOrderCreated(event: BaseEvent<typeof ORDER_EVENTS.CREATED>) {
    const payload = event.payload as OrderCreatedPayload;
    this.logger.log(`📊 Queueing order analytics for order ${payload.orderNumber}`);

    // await this.analyticsQueue.trackOrder({
    //   orderId: payload.orderId,
    //   userId: payload.userId,
    //   total: payload.total,
    //   items: payload.items.map(item => ({
    //     productId: item.productId,
    //     productName: item.productName,
    //     quantity: item.quantity,
    //     price: item.price,
    //   })),
    // });
  }

  @OnEvent(ORDER_EVENTS.PAID)
  async handleOrderPaid(event: BaseEvent<typeof ORDER_EVENTS.PAID>) {
    const payload = event.payload as OrderPaidPayload;
    this.logger.log(`📊 Queueing conversion tracking for order ${payload.orderNumber}`);

    const conversionPayload: ConversionPayload = {
      conversionType: 'order',
      // value: payload.amount,
      userId: payload.userId,
      metadata: {
        orderId: payload.orderId,
        orderNumber: payload.orderNumber,
        paymentMethod: payload.paymentMethod,
      },
      timestamp: payload.paidAt,
    };

    // await this.analyticsQueue.trackConversion(conversionPayload);
  }

  @OnEvent(USER_EVENTS.REGISTERED)
  async handleUserRegistration(event: BaseEvent<typeof USER_EVENTS.REGISTERED>) {
    const payload = event.payload as UserRegisteredPayload;
    this.logger.log(`📊 Queueing registration tracking for user ${payload.userId}`);

    const conversionPayload: ConversionPayload = {
      conversionType: 'signup',
      userId: payload.userId,
      metadata: {
        email: payload.email,
        method: payload.registrationMethod,
      },
      timestamp: new Date(),
    };

    // await this.analyticsQueue.trackConversion(conversionPayload);
    // await this.analyticsQueue.trackUserRegistration({
    //   userId: payload.userId,
    //   method: payload.registrationMethod,
    // });
  }
}