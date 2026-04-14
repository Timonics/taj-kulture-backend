/**
 * EMAIL EVENT HANDLER
 *
 * Listens to domain events and delegates email sending to the email queue.
 *
 * WHY SEPARATE HANDLER:
 * - Keeps domain logic clean (no email concerns in services)
 * - Non-blocking (events are queued, not sent synchronously)
 * - Retry logic built into queue
 * - Easy to add/remove email types
 *
 * EVENT → EMAIL MAPPING:
 * - user.registered → Send verification email
 * - user.verified → Send welcome email
 * - user.password_reset_requested → Send reset email
 * - order.created → Send order confirmation
 * - order.shipped → Send shipping update
 * - order.delivered → Send delivery confirmation
 * - order.cancelled → Send cancellation notice
 * - vendor.approved → Send approval email
 * - vendor.rejected → Send rejection email
 */

import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EmailQueueService } from '../../queues/email-queue.service';
import { BaseEvent } from '../event-map.interface';
import { USER_EVENTS, ORDER_EVENTS, VENDOR_EVENTS } from '../event-types';
import type {
  UserRegisteredPayload,
  UserVerifiedPayload,
  PasswordResetRequestedPayload,
  OrderCreatedPayload,
  OrderShippedPayload,
  OrderDeliveredPayload,
  OrderCancelledPayload,
  VendorApprovedPayload,
  VendorRejectedPayload,
} from '../event-payloads.interface';
import { ILogger } from 'src/shared/logger/logger.interface';
import { LoggerService } from 'src/shared/logger/logger.service';

@Injectable()
export class EmailEventHandler {
  private readonly logger: ILogger;

  constructor(
    private emailQueue: EmailQueueService,
    logger: LoggerService,
  ) {
    this.logger = logger.child(EmailEventHandler.name);
  }

  // ============================================================
  // USER EMAILS
  // ============================================================

  @OnEvent(USER_EVENTS.REGISTERED)
  async handleUserRegistered(event: BaseEvent<typeof USER_EVENTS.REGISTERED>) {
    const payload = event.payload as UserRegisteredPayload;
    const correlationId = event.metadata?.correlationId;

    this.logger.info(`📧 Processing user.registered event for ${payload.email}`);

    await this.emailQueue.sendVerificationEmail({
      email: payload.email,
      name: payload.name,
      verificationToken: payload.verificationToken,
      correlationId,
    });

    this.logger.info(`Verification email queued for ${payload.email}`);
  }

  @OnEvent(USER_EVENTS.VERIFIED)
  async handleUserVerified(event: BaseEvent<typeof USER_EVENTS.VERIFIED>) {
    const payload = event.payload as UserVerifiedPayload;
    const correlationId = event.metadata?.correlationId;

    this.logger.info(`📧 Processing user.verified event for ${payload.email}`);

    await this.emailQueue.sendWelcomeEmail({
      email: payload.email,
      name: payload.name,
      correlationId,
    });

    this.logger.info(`Welcome email queued for ${payload.email}`);
  }

  @OnEvent(USER_EVENTS.PASSWORD_RESET_REQUESTED)
  async handlePasswordReset(
    event: BaseEvent<typeof USER_EVENTS.PASSWORD_RESET_REQUESTED>,
  ) {
    const payload = event.payload as PasswordResetRequestedPayload;
    const correlationId = event.metadata?.correlationId;

    this.logger.info(`📧 Processing password reset for ${payload.email}`);

    await this.emailQueue.sendPasswordResetEmail({
      email: payload.email,
      name: payload.name,
      resetToken: payload.resetToken,
      correlationId,
    });

    this.logger.info(`Password reset email queued for ${payload.email}`);
  }

  // ============================================================
  // ORDER EMAILS
  // ============================================================

  @OnEvent(ORDER_EVENTS.CREATED)
  async handleOrderCreated(event: BaseEvent<typeof ORDER_EVENTS.CREATED>) {
    const payload = event.payload as OrderCreatedPayload;
    const correlationId = event.metadata?.correlationId;

    this.logger.info(
      `📧 Processing order confirmation for order ${payload.orderNumber}`,
    );

    await this.emailQueue.sendOrderConfirmation({
      email: payload.userEmail,
      name: payload.userName,
      orderNumber: payload.orderNumber,
      items: payload.items,
      total: payload.total,
      correlationId,
    });

    this.logger.info(`Order confirmation email queued for ${payload.userEmail}`);
  }

  @OnEvent(ORDER_EVENTS.SHIPPED)
  async handleOrderShipped(event: BaseEvent<typeof ORDER_EVENTS.SHIPPED>) {
    const payload = event.payload as OrderShippedPayload;
    const correlationId = event.metadata?.correlationId;

    this.logger.info(
      `📧 Processing shipping notification for order ${payload.orderNumber}`,
    );

    await this.emailQueue.sendShippingUpdate({
      email: payload.userEmail,
      name: payload.userName,
      orderNumber: payload.orderNumber,
      trackingNumber: payload.trackingNumber,
      carrier: payload.carrier,
      estimatedDelivery: payload.estimatedDelivery,
      correlationId,
    });

    this.logger.info(`Shipping update email queued for ${payload.userEmail}`);
  }

  @OnEvent(ORDER_EVENTS.DELIVERED)
  async handleOrderDelivered(event: BaseEvent<typeof ORDER_EVENTS.DELIVERED>) {
    const payload = event.payload as OrderDeliveredPayload;
    const correlationId = event.metadata?.correlationId;

    this.logger.info(
      `📧 Processing delivery confirmation for order ${payload.orderNumber}`,
    );

    // await this.emailQueue.sendDeliveryConfirmation({
    //   email: payload.userEmail,
    //   orderNumber: payload.orderNumber,
    //   deliveredAt: payload.deliveredAt,
    //   correlationId,
    // });

    this.logger.info(
      `Delivery confirmation email queued for ${payload.userEmail}`,
    );
  }

  @OnEvent(ORDER_EVENTS.CANCELLED)
  async handleOrderCancelled(event: BaseEvent<typeof ORDER_EVENTS.CANCELLED>) {
    const payload = event.payload as OrderCancelledPayload;
    const correlationId = event.metadata?.correlationId;

    this.logger.info(
      `📧 Processing cancellation notification for order ${payload.orderNumber}`,
    );

    await this.emailQueue.sendOrderCancellation({
      email: payload.userEmail,
      orderNumber: payload.orderNumber,
      reason: payload.reason,
      correlationId,
    });

    this.logger.info(`Cancellation email queued for ${payload.userEmail}`);
  }

  // ============================================================
  // VENDOR EMAILS
  // ============================================================

  @OnEvent(VENDOR_EVENTS.APPROVED)
  async handleVendorApproved(event: BaseEvent<typeof VENDOR_EVENTS.APPROVED>) {
    const payload = event.payload as VendorApprovedPayload;
    const correlationId = event.metadata?.correlationId;

    this.logger.info(`📧 Processing vendor approval email for ${payload.name}`);

    await this.emailQueue.sendVendorApproval({
      email: payload.email,
      storeName: payload.name,
      correlationId,
    });

    this.logger.info(`Vendor approval email queued for ${payload.email}`);
  }

  @OnEvent(VENDOR_EVENTS.REJECTED)
  async handleVendorRejected(event: BaseEvent<typeof VENDOR_EVENTS.REJECTED>) {
    const payload = event.payload as VendorRejectedPayload;
    const correlationId = event.metadata?.correlationId;

    this.logger.info(`📧 Processing vendor rejection email for ${payload.name}`);

    await this.emailQueue.sendVendorRejection({
      email: payload.email,
      storeName: payload.name,
      reason: payload.reason,
      correlationId,
    });

    this.logger.info(`Vendor rejection email queued for ${payload.email}`);
  }
}
