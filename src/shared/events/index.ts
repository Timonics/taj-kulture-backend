// Core
export { EventBus } from './event-bus.service';
export { EventsModule } from './event.module';

// Types
export * from './event-types';
export * from './event-payloads.interface';

// Handlers (if needed directly)
export { EmailEventHandler } from './handlers/email.handler';
export { NotificationEventHandler } from './handlers/notification.handler';
export { AnalyticsEventHandler } from './handlers/analytics.handler';
