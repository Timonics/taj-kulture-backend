
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BaseEvent, EventMap } from './event-map.interface';
import { RequestContext } from 'src/core/context/request-context';

/**
 * EVENT BUS - Central event dispatcher
 * 
 * WHAT IT DOES:
 * - Emits events synchronously (emit) or asynchronously (emitAsync)
 * - Enriches events with metadata (timestamp, correlationId)
 * - Provides type-safe event emission via EventMap
 * 
 * WHY SEPARATE:
 * - Decouples event emission from handling
 * - Single place for metadata enrichment
 * - Easy to add logging/monitoring
 * 
 * @example
 * eventBus.emit({
 *   name: USER_EVENTS.REGISTERED,
 *   payload: { userId, email, name, verificationToken, registrationMethod }
 * });
 */
@Injectable()
export class EventBus {
  private readonly logger = new Logger(EventBus.name);

  constructor(private eventEmitter: EventEmitter2) {}

  /**
   * Emit event synchronously (fire and forget)
   * 
   * Use for: Non-critical events that can be processed asynchronously
   * Example: Analytics tracking, email sending
   */
  emit<T extends keyof EventMap>(event: BaseEvent<T>): void {
    const enrichedEvent = this.enrichEvent(event);
    
    this.logger.debug(`📢 Event emitted: ${String(event.name)}`);
    this.eventEmitter.emit(event.name, enrichedEvent);
  }

  /**
   * Emit event asynchronously and wait for all handlers to complete
   * 
   * Use for: Critical events that must complete before continuing
   * Example: Order processing, inventory updates
   */
  async emitAsync<T extends keyof EventMap>(event: BaseEvent<T>): Promise<any[]> {
    const enrichedEvent = this.enrichEvent(event);
    
    this.logger.debug(`📢 Async event emitted: ${String(event.name)}`);
    return this.eventEmitter.emitAsync(event.name, enrichedEvent);
  }

  /**
   * Register an event handler
   * 
   * @example
   * eventBus.on(USER_EVENTS.REGISTERED, async (event) => {
   *   await emailService.sendWelcome(event.payload.email);
   * });
   */
  on<T extends keyof EventMap>(
    eventName: T,
    handler: (event: BaseEvent<T>) => void | Promise<void>,
  ): void {
    this.eventEmitter.on(eventName, handler);
  }

  /**
   * Enrich event with metadata for tracing and debugging
   * 
   * Adds:
   * - timestamp: When the event occurred
   * - correlationId: For request tracing across services
   * - userId: From current request context (if available)
   */
  private enrichEvent<T extends keyof EventMap>(event: BaseEvent<T>): BaseEvent<T> {
    return {
      ...event,
      metadata: {
        timestamp: new Date(),
        correlationId: RequestContext.getCorrelationId() || this.generateCorrelationId(),
        userId: RequestContext.getUserId(),
        version: 1, // For future event versioning
        ...event.metadata,
      },
    };
  }

  /**
   * Generate a fallback correlation ID if none exists in context
   */
  private generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }
}