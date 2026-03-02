// src/shared/events/handlers/email.handler.ts
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EmailQueueService } from '../../queues/email-queue.service';
import { EventBus, BaseEvent } from '../event-bus.service';
import { USER_EVENTS, ORDER_EVENTS, VENDOR_EVENTS } from '../event-types';
import {
  UserRegisteredPayload,
  UserVerifiedPayload,
  PasswordResetRequestedPayload,
  OrderCreatedPayload,
  OrderShippedPayload,
  VendorApprovedPayload,
  VendorRejectedPayload,
  UserProfileUpdatedPayload,
  PasswordChangedPayload,
  UserDeletedPayload,
} from '../event-payloads.interface';

@Injectable()
export class EmailEventHandler {
  private readonly logger = new Logger(EmailEventHandler.name);

  constructor(
    private emailQueue: EmailQueueService,
    private eventBus: EventBus,
  ) {}

  @OnEvent(USER_EVENTS.REGISTERED)
  async handleUserRegistered(event: BaseEvent<typeof USER_EVENTS.REGISTERED>) {
    const payload = event.payload as UserRegisteredPayload;
    this.logger.log(`Processing user.registered event for ${payload.email}`);

    try {
      await this.emailQueue.sendVerificationEmail({
        email: payload.email,
        name: payload.name,
        verificationToken: payload.verificationToken,
      });

      this.logger.log(`Verification email queued for ${payload.email}`);
    } catch (error) {
      this.logger.error(`Failed to queue verification email: ${error.message}`);
      throw error; // Let the queue retry
    }
  }

  @OnEvent(USER_EVENTS.PASSWORD_RESET_REQUESTED)
  async handlePasswordReset(
    event: BaseEvent<typeof USER_EVENTS.PASSWORD_RESET_REQUESTED>,
  ) {
    const payload = event.payload as PasswordResetRequestedPayload;
    this.logger.log(`Processing password reset for ${payload.email}`);

    try {
      await this.emailQueue.sendPasswordResetEmail({
        email: payload.email,
        name: payload.name,
        resetToken: payload.resetToken,
      });

      this.logger.log(`Password reset email queued for ${payload.email}`);
    } catch (error) {
      this.logger.error(
        `Failed to queue password reset email: ${error.message}`,
      );
      throw error;
    }
  }

  @OnEvent(USER_EVENTS.VERIFIED)
  async handleUserVerified(event: BaseEvent<typeof USER_EVENTS.VERIFIED>) {
    const payload = event.payload as UserVerifiedPayload;
    this.logger.log(`Processing welcome email for ${payload.email}`);

    try {
      await this.emailQueue.sendWelcomeEmail({
        email: payload.email,
        name: payload.name,
      });

      this.logger.log(`Welcome email queued for ${payload.email}`);
    } catch (error) {
      this.logger.error(`Failed to queue welcome email: ${error.message}`);
    }
  }

  // @OnEvent(USER_EVENTS.PROFILE_UPDATED)
  // async handleUserProfileUpdated(event: BaseEvent<typeof USER_EVENTS.PROFILE_UPDATED>) {
  //   const payload = event.payload as UserProfileUpdatedPayload;
  //   this.logger.log(`Processing profile update email for user ${payload.userId}`);

  //   try {
  //     await this.emailQueue.sendProfileUpdateEmail({
  //       userId: payload.userId,
  //       changes: payload.changes,
  //     });

  //     this.logger.log(`Profile update email queued for user ${payload.userId}`);
  //   } catch (error) {
  //     this.logger.error(`Failed to queue profile update email: ${error.message}`);
  //   }
  // }

  // @OnEvent(USER_EVENTS.PASSWORD_CHANGED)
  // async handlePasswordChanged(
  //   event: BaseEvent<typeof USER_EVENTS.PASSWORD_CHANGED>,
  // ) {
  //   const payload = event.payload as PasswordChangedPayload;
  //   this.logger.log(
  //     `Processing password change notification for user ${payload.userId}`,
  //   );

  //   try {
  //     await this.emailQueue.sendPasswordChangeNotification({
  //       userId: payload.userId,
  //     });

  //     this.logger.log(
  //       `Password change notification queued for user ${payload.userId}`,
  //     );
  //   } catch (error) {
  //     this.logger.error(
  //       `Failed to queue password change notification: ${error.message}`,
  //     );
  //   }
  // }

  // @OnEvent(USER_EVENTS.DELETED)
  // async handleUserDeleted(event: BaseEvent<typeof USER_EVENTS.DELETED>) {
  //   const payload = event.payload as UserDeletedPayload;
  //   this.logger.log(`Processing user deleted email for ${payload.userId}`);

  //   try {
  //     await this.emailQueue.sendUserDeletedEmail({
  //       userId: payload.userId,
  //       email: payload.email,
  //     });

  //     this.logger.log(`User deleted email queued for ${payload.email}`);
  //   } catch (error) {
  //     this.logger.error(`Failed to queue user deleted email: ${error.message}`);
  //   }
  // }

  // @OnEvent(ORDER_EVENTS.CREATED)
  // async handleOrderCreated(event: BaseEvent<typeof ORDER_EVENTS.CREATED>) {
  //   const payload = event.payload as OrderCreatedPayload;
  //   this.logger.log(
  //     `Processing order confirmation for order ${payload.orderNumber}`,
  //   );

  //   try {
  //     await this.emailQueue.sendOrderConfirmation({
  //       email: payload.userEmail,
  //       name: payload.userName,
  //       orderNumber: payload.orderNumber,
  //       items: payload.items,
  //       subtotal: payload.subtotal,
  //       shipping: payload.shipping,
  //       tax: payload.tax,
  //       total: payload.total,
  //       createdAt: payload.createdAt,
  //       shippingAddress: payload.shippingAddress,
  //     });

  //     this.logger.log(
  //       `Order confirmation email queued for ${payload.userEmail}`,
  //     );
  //   } catch (error) {
  //     this.logger.error(`Failed to queue order confirmation: ${error.message}`);
  //     throw error;
  //   }
  // }

  // @OnEvent(ORDER_EVENTS.SHIPPED)
  // async handleOrderShipped(event: BaseEvent<typeof ORDER_EVENTS.SHIPPED>) {
  //   const payload = event.payload as OrderShippedPayload;
  //   this.logger.log(
  //     `Processing shipping notification for order ${payload.orderNumber}`,
  //   );

  //   try {
  //     await this.emailQueue.sendShippingUpdate({
  //       email: payload.userEmail,
  //       name: payload.userName,
  //       orderNumber: payload.orderNumber,
  //       trackingNumber: payload.trackingNumber,
  //       carrier: payload.carrier,
  //       estimatedDelivery: payload.estimatedDelivery,
  //       shippedAt: payload.shippedAt,
  //     });

  //     this.logger.log(`Shipping update email queued for ${payload.userEmail}`);
  //   } catch (error) {
  //     this.logger.error(`Failed to queue shipping update: ${error.message}`);
  //     throw error;
  //   }
  // }

  // @OnEvent(VENDOR_EVENTS.APPROVED)
  // async handleVendorApproved(event: BaseEvent<typeof VENDOR_EVENTS.APPROVED>) {
  //   const payload = event.payload as VendorApprovedPayload;
  //   this.logger.log(`Processing vendor approval email for ${payload.name}`);

  //   try {
  //     await this.emailQueue.sendVendorApprovedEmail({
  //       email: payload.email,
  //       name: payload.name,
  //       vendorName: payload.name,
  //     });

  //     this.logger.log(`Vendor approval email queued for ${payload.email}`);
  //   } catch (error) {
  //     this.logger.error(
  //       `Failed to queue vendor approval email: ${error.message}`,
  //     );
  //     throw error;
  //   }
  // }

  // @OnEvent(VENDOR_EVENTS.REJECTED)
  // async handleVendorRejected(event: BaseEvent<typeof VENDOR_EVENTS.REJECTED>) {
  //   const payload = event.payload as VendorRejectedPayload;
  //   this.logger.log(`Processing vendor rejection email for ${payload.name}`);

  //   try {
  //     await this.emailQueue.sendVendorRejectedEmail({
  //       email: payload.email,
  //       name: payload.name,
  //       vendorName: payload.name,
  //       reason: payload.reason,
  //     });

  //     this.logger.log(`Vendor rejection email queued for ${payload.email}`);
  //   } catch (error) {
  //     this.logger.error(
  //       `Failed to queue vendor rejection email: ${error.message}`,
  //     );
  //     // Don't throw for rejection emails
  //   }
  // }
}
