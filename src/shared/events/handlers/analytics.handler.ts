// import { Injectable } from '@nestjs/common';
// import { OnEvent } from '@nestjs/event-emitter';
// import { AnalyticsQueueService } from '../../queues/analytics-queue.service';
// import { 
//   USER_EVENTS, 
//   PRODUCT_EVENTS,
//   ORDER_EVENTS,
//   ANALYTICS_EVENTS 
// } from '../event-types';

// @Injectable()
// export class AnalyticsEventHandler {
//   constructor(private analyticsQueue: AnalyticsQueueService) {}

//   @OnEvent(PRODUCT_EVENTS.VIEWED)
//   async handleProductView(payload: any) {
//     console.log('📊 Queueing product view tracking', payload);
    
//     await this.analyticsQueue.trackProductView({
//       productId: payload.productId,
//       userId: payload.userId,
//       sessionId: payload.sessionId,
//     });
//   }

//   @OnEvent(ANALYTICS_EVENTS.SEARCH)
//   async handleSearch(payload: any) {
//     console.log('📊 Queueing search tracking', payload);
    
//     await this.analyticsQueue.trackSearch({
//       query: payload.query,
//       userId: payload.userId,
//       sessionId: payload.sessionId,
//       resultsCount: payload.resultsCount,
//     });
//   }

//   @OnEvent(ORDER_EVENTS.COMPLETED)
//   async handleOrderCompleted(payload: any) {
//     console.log('📊 Queueing order tracking', payload);
    
//     await this.analyticsQueue.trackOrder({
//       orderId: payload.orderId,
//       userId: payload.userId,
//       total: payload.total,
//       items: payload.items,
//     });
//   }

//   @OnEvent(USER_EVENTS.REGISTERED)
//   async handleUserRegistration(payload: any) {
//     console.log('📊 Queueing registration tracking', payload);
    
//     await this.analyticsQueue.trackUserRegistration({
//       userId: payload.userId,
//       method: payload.registrationMethod,
//     });
//   }
// }