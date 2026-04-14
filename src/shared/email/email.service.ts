import { Injectable, OnModuleInit } from '@nestjs/common';
import sgMail from '@sendgrid/mail';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as Handlebars from 'handlebars';
import { EnvironmentService } from 'src/config/env/env.service';
import { ILogger } from '../logger/logger.interface';
import { LoggerService } from '../logger/logger.service';

export interface EmailOptions {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  templateId?: string;
  dynamicTemplateData?: Record<string, any>;
}

/**
 * EMAIL SERVICE
 *
 * Production-ready email service using SendGrid with multiple fallback strategies.
 *
 * WHY SENDGRID:
 * - Reliable delivery, analytics, dynamic templates
 *
 * FALLBACK STRATEGY (in order of preference):
 * 1. SendGrid Dynamic Template (configured via env)
 * 2. Handlebars template from filesystem
 * 3. Inline HTML (hardcoded fallback)
 *
 * All email methods are designed to be called by queue processors.
 */
@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger: ILogger;
  private readonly fromEmail: string;
  private readonly fromName: string;
  private templates: Map<string, HandlebarsTemplateDelegate> = new Map();
  private isInitialized = false;

  constructor(
    private env: EnvironmentService,
    logger: LoggerService,
  ) {
    this.logger = logger.child('EmailService');
    this.fromEmail = this.env.get('SENDGRID_FROM_EMAIL');
    this.fromName = this.env.get('SENDGRID_FROM_NAME');
  }

  async onModuleInit() {
    if (this.isInitialized) return;

    const apiKey = this.env.get('SENDGRID_API_KEY');
    if (!apiKey) {
      this.logger.warn(
        'SendGrid API key not configured. Email sending will fail.',
      );
      return;
    }

    try {
      sgMail.setApiKey(apiKey);
      await this.loadTemplates();
      this.isInitialized = true;
      this.logger.info('SendGrid initialized successfully');
    } catch (error: any) {
      this.logger.error('Failed to initialize SendGrid', error.stack);
    }
  }

  private async loadTemplates(): Promise<void> {
    const templateFiles = {
      verification: 'verification.hbs',
      'password-reset': 'password-reset.hbs',
      welcome: 'welcome.hbs',
      'order-confirmation': 'order-confirmation.hbs',
      'shipping-update': 'shipping-update.hbs',
      'order-cancellation': 'order-cancellation.hbs',
      'vendor-rejection': 'vendor-rejection.hbs',
    };

    for (const [name, filename] of Object.entries(templateFiles)) {
      try {
        const templatePath = path.join(
          process.cwd(),
          'src',
          'shared',
          'email',
          'templates',
          filename,
        );
        const templateContent = await fs.readFile(templatePath, 'utf-8');
        this.templates.set(name, Handlebars.compile(templateContent));
        this.logger.debug(`Loaded template: ${filename}`);
      } catch (error) {
        // Templates are optional – log debug only
        this.logger.debug(`Template not loaded: ${filename}`);
      }
    }
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    if (!this.isInitialized) {
      this.logger.warn(
        `Email not sent - service not initialized. To: ${options.to}`,
      );
      return;
    }

    try {
      const msg: any = {
        to: options.to,
        from: { email: this.fromEmail, name: this.fromName },
        subject: options.subject,
      };

      if (options.templateId) {
        msg.templateId = options.templateId;
        msg.dynamicTemplateData = options.dynamicTemplateData;
      } else if (options.html) {
        msg.html = options.html;
        if (options.text) msg.text = options.text;
      }

      await sgMail.send(msg);
      this.logger.info(
        `Email sent to ${options.to} - Subject: ${options.subject}`,
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to send email to ${options.to}: ${error.message}`,
      );
      if (error.response?.body) {
        this.logger.debug(
          `SendGrid error details: ${JSON.stringify(error.response.body)}`,
        );
      }
      // Don't throw – email failures shouldn't crash the queue worker
    }
  }

  // ========== SPECIFIC EMAIL METHODS (called by queue processor) ==========

  async sendVerificationEmail(
    email: string,
    name: string,
    verificationToken: string,
  ): Promise<void> {
    const frontendUrl = this.env.get('FRONTEND_URL');
    const verificationUrl = `${frontendUrl}/verify-email?token=${verificationToken}`;
    const templateId = this.env.get('SENDGRID_VERIFICATION_TEMPLATE_ID');

    if (templateId) {
      await this.sendEmail({
        to: email,
        subject: 'Welcome to Taj Kulture - Verify Your Email',
        templateId,
        dynamicTemplateData: {
          name,
          verificationUrl,
          year: new Date().getFullYear(),
        },
      });
      return;
    }

    const template = this.templates.get('verification');
    if (template) {
      const html = template({
        name,
        verificationUrl,
        year: new Date().getFullYear(),
      });
      await this.sendEmail({ to: email, subject: 'Verify Your Email', html });
      return;
    }

    // Ultimate fallback
    const fallbackHtml = this.getVerificationFallbackHtml(
      name,
      verificationUrl,
    );
    await this.sendEmail({
      to: email,
      subject: 'Verify Your Email',
      html: fallbackHtml,
    });
  }

  async sendPasswordResetEmail(
    email: string,
    name: string,
    resetToken: string,
  ): Promise<void> {
    const frontendUrl = this.env.get('FRONTEND_URL');
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;
    const templateId = this.env.get('SENDGRID_PASSWORD_RESET_TEMPLATE_ID');

    if (templateId) {
      await this.sendEmail({
        to: email,
        subject: 'Reset Your Password',
        templateId,
        dynamicTemplateData: { name, resetUrl, year: new Date().getFullYear() },
      });
      return;
    }

    const template = this.templates.get('password-reset');
    if (template) {
      const html = template({ name, resetUrl, year: new Date().getFullYear() });
      await this.sendEmail({ to: email, subject: 'Reset Your Password', html });
      return;
    }

    const fallbackHtml = this.getPasswordResetFallbackHtml(name, resetUrl);
    await this.sendEmail({
      to: email,
      subject: 'Reset Your Password',
      html: fallbackHtml,
    });
  }

  async sendWelcomeEmail(email: string, name: string): Promise<void> {
    const frontendUrl = this.env.get('FRONTEND_URL');
    const loginUrl = `${frontendUrl}/login`;
    const templateId = this.env.get('SENDGRID_WELCOME_TEMPLATE_ID');

    if (templateId) {
      await this.sendEmail({
        to: email,
        subject: 'Welcome to Taj Kulture!',
        templateId,
        dynamicTemplateData: { name, loginUrl, year: new Date().getFullYear() },
      });
      return;
    }

    const template = this.templates.get('welcome');
    if (template) {
      const html = template({ name, loginUrl, year: new Date().getFullYear() });
      await this.sendEmail({
        to: email,
        subject: 'Welcome to Taj Kulture!',
        html,
      });
      return;
    }

    const fallbackHtml = this.getWelcomeFallbackHtml(name, loginUrl);
    await this.sendEmail({
      to: email,
      subject: 'Welcome to Taj Kulture!',
      html: fallbackHtml,
    });
  }

  async sendOrderConfirmationEmail(
    email: string,
    name: string,
    orderNumber: string,
    items: Array<{
      productId: string;
      productName: string;
      quantity: number;
      price: number;
    }>,
    total: number,
  ): Promise<void> {
    const frontendUrl = this.env.get('FRONTEND_URL');
    const orderUrl = `${frontendUrl}/orders/${orderNumber}`;
    const templateId = this.env.get('SENDGRID_ORDER_CONFIRMATION_TEMPLATE_ID');

    if (templateId) {
      await this.sendEmail({
        to: email,
        subject: `Order Confirmed #${orderNumber}`,
        templateId,
        dynamicTemplateData: {
          name,
          orderNumber,
          items,
          total: total.toFixed(2),
          orderUrl,
          year: new Date().getFullYear(),
        },
      });
      return;
    }

    const template = this.templates.get('order-confirmation');
    if (template) {
      const html = template({
        name,
        orderNumber,
        items,
        total: total.toFixed(2),
        orderUrl,
        year: new Date().getFullYear(),
      });
      await this.sendEmail({
        to: email,
        subject: `Order Confirmed #${orderNumber}`,
        html,
      });
      return;
    }

    // Ultimate fallback HTML
    const itemsHtml = items
      .map(
        (item) => `
      <tr><td>${item.productName}</td><td>${item.quantity}</td><td>$${item.price.toFixed(2)}</td><td>$${(item.price * item.quantity).toFixed(2)}</td></tr>
    `,
      )
      .join('');
    const html = `
      <html><body>
      <h1>Order Confirmed!</h1>
      <p>Thank you, ${name}!</p>
      <p>Order #: ${orderNumber}</p>
      <table border="1"><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr>${itemsHtml}<tr><td colspan="3"><strong>Total</strong></td><td><strong>$${total.toFixed(2)}</strong></td></tr></table>
      <p><a href="${orderUrl}">View order</a></p>
      </body></html>`;
    await this.sendEmail({
      to: email,
      subject: `Order Confirmed #${orderNumber}`,
      html,
    });
  }

  async sendShippingUpdateEmail(
    email: string,
    name: string,
    orderNumber: string,
    trackingNumber: string,
    carrier: string,
    estimatedDelivery?: Date,
  ): Promise<void> {
    const frontendUrl = this.env.get('FRONTEND_URL');
    const trackingUrl = `${frontendUrl}/orders/${orderNumber}/track`;
    const templateId = this.env.get('SENDGRID_SHIPPING_UPDATE_TEMPLATE_ID'); // optional env var

    const estimated = estimatedDelivery
      ? estimatedDelivery.toDateString()
      : 'soon';

    if (templateId) {
      await this.sendEmail({
        to: email,
        subject: `Your Order #${orderNumber} Has Shipped`,
        templateId,
        dynamicTemplateData: {
          name,
          orderNumber,
          trackingNumber,
          carrier,
          estimatedDelivery: estimated,
          trackingUrl,
          year: new Date().getFullYear(),
        },
      });
      return;
    }

    const template = this.templates.get('shipping-update');
    if (template) {
      const html = template({
        name,
        orderNumber,
        trackingNumber,
        carrier,
        estimatedDelivery: estimated,
        trackingUrl,
        year: new Date().getFullYear(),
      });
      await this.sendEmail({
        to: email,
        subject: `Your Order #${orderNumber} Has Shipped`,
        html,
      });
      return;
    }

    // Fallback HTML
    const html = `
      <html><body>
      <h1>Order Shipped!</h1>
      <p>Hello ${name},</p>
      <p>Your order #${orderNumber} is on the way via ${carrier}.</p>
      <p>Tracking number: ${trackingNumber}</p>
      <p>Estimated delivery: ${estimated}</p>
      <p><a href="${trackingUrl}">Track your package</a></p>
      </body></html>`;
    await this.sendEmail({
      to: email,
      subject: `Your Order #${orderNumber} Has Shipped`,
      html,
    });
  }

  async sendOrderCancellationEmail(
    email: string,
    orderNumber: string,
    reason?: string,
  ): Promise<void> {
    const templateId = this.env.get('SENDGRID_ORDER_CANCELLATION_TEMPLATE_ID');

    if (templateId) {
      await this.sendEmail({
        to: email,
        subject: `Your Order #${orderNumber} Has Been Cancelled`,
        templateId,
        dynamicTemplateData: {
          orderNumber,
          reason,
          year: new Date().getFullYear(),
        },
      });
      return;
    }

    const template = this.templates.get('order-cancellation');
    if (template) {
      const html = template({
        orderNumber,
        reason,
        year: new Date().getFullYear(),
      });
      await this.sendEmail({
        to: email,
        subject: `Order Cancelled #${orderNumber}`,
        html,
      });
      return;
    }

    const html = `<html><body><h1>Order Cancelled</h1><p>Your order #${orderNumber} has been cancelled.${reason ? ` Reason: ${reason}` : ''}</p></body></html>`;
    await this.sendEmail({
      to: email,
      subject: `Order Cancelled #${orderNumber}`,
      html,
    });
  }

  async sendVendorApprovalEmail(
    email: string,
    storeName: string,
  ): Promise<void> {
    const dashboardUrl = `${this.env.get('FRONTEND_URL')}/vendor/dashboard`;
    const templateId = this.env.get('SENDGRID_VENDOR_APPROVAL_TEMPLATE_ID');

    if (templateId) {
      await this.sendEmail({
        to: email,
        subject: 'Your Vendor Application is Approved!',
        templateId,
        dynamicTemplateData: {
          storeName,
          dashboardUrl,
          year: new Date().getFullYear(),
        },
      });
      return;
    }

    const html = `<html><body><h1>Congratulations ${storeName}!</h1><p>Your vendor application has been approved. <a href="${dashboardUrl}">Go to dashboard</a></p></body></html>`;
    await this.sendEmail({
      to: email,
      subject: 'Vendor Application Approved',
      html,
    });
  }

  async sendVendorRejectionEmail(
    email: string,
    storeName: string,
    reason?: string,
  ): Promise<void> {
    const templateId = this.env.get('SENDGRID_VENDOR_REJECTION_TEMPLATE_ID');

    if (templateId) {
      await this.sendEmail({
        to: email,
        subject: 'Update on Your Vendor Application',
        templateId,
        dynamicTemplateData: {
          storeName,
          reason,
          year: new Date().getFullYear(),
        },
      });
      return;
    }

    const template = this.templates.get('vendor-rejection');
    if (template) {
      const html = template({
        storeName,
        reason,
        year: new Date().getFullYear(),
      });
      await this.sendEmail({
        to: email,
        subject: 'Vendor Application Update',
        html,
      });
      return;
    }

    const html = `<html><body><h1>Application Status</h1><p>Dear ${storeName}, your vendor application has not been approved at this time.${reason ? ` Reason: ${reason}` : ''}</p></body></html>`;
    await this.sendEmail({
      to: email,
      subject: 'Vendor Application Update',
      html,
    });
  }

  // ========== FALLBACK HTML METHODS (kept for backward compatibility) ==========

  private getVerificationFallbackHtml(
    name: string,
    verificationUrl: string,
  ): string {
    return `<!DOCTYPE html><html><head><style>body{font-family:Arial}</style></head><body><h1>Welcome to Taj Kulture!</h1><p>Hello ${name},</p><p>Please verify your email: <a href="${verificationUrl}">Verify Email</a></p><p>Or copy: ${verificationUrl}</p></body></html>`;
  }

  private getPasswordResetFallbackHtml(name: string, resetUrl: string): string {
    return `<!DOCTYPE html><html><body><h1>Password Reset</h1><p>Hello ${name},</p><p><a href="${resetUrl}">Reset Password</a></p><p>Link expires in 1 hour.</p></body></html>`;
  }

  private getWelcomeFallbackHtml(name: string, loginUrl: string): string {
    return `<!DOCTYPE html><html><body><h1>Welcome ${name}!</h1><p>Thanks for joining. <a href="${loginUrl}">Start exploring</a></p></body></html>`;
  }
}
