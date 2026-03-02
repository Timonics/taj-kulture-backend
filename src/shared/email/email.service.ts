import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sgMail from '@sendgrid/mail';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as Handlebars from 'handlebars';

export interface EmailOptions {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  templateId?: string;
  dynamicTemplateData?: Record<string, any>;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly fromEmail: string;
  private readonly fromName: string;
  private templates: Map<string, HandlebarsTemplateDelegate> = new Map();

  constructor(private configService: ConfigService) {
    this.fromEmail = this.configService.get('SENDGRID_FROM_EMAIL')!;
    this.fromName = this.configService.get('SENDGRID_FROM_NAME')!;
  }

  async onModuleInit() {
    // Initialize SendGrid in onModuleInit to ensure everything is loaded
    const apiKey = this.configService.get('SENDGRID_API_KEY');

    try {
      sgMail.setApiKey(apiKey);
      this.logger.log('SendGrid initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize SendGrid:', error);
      throw error;
    }

    await this.loadTemplates();
  }

  private async loadTemplates() {
    const templateFiles = {
      verification: 'verification.hbs',
      'password-reset': 'password-reset.hbs',
      welcome: 'welcome.hbs',
      'order-confirmation': 'order-confirmation.hbs',
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
        this.logger.log(`Loaded template: ${filename}`);
      } catch (error) {
        this.logger.warn(
          `Could not load template ${filename}: ${error.message}`,
        );
      }
    }
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    try {
      const msg: any = {
        to: options.to,
        from: {
          email: this.fromEmail,
          name: this.fromName,
        },
        subject: options.subject,
      };

      // Use template if provided
      if (options.templateId) {
        msg.templateId = options.templateId;
        msg.dynamicTemplateData = options.dynamicTemplateData;
      } else {
        // Fallback to HTML/text
        if (options.html) msg.html = options.html;
        if (options.text) msg.text = options.text;
      }

      await sgMail.send(msg);
      this.logger.log(`Email sent successfully to ${options.to}`);
    } catch (error) {
      this.logger.error(
        `Failed to send email to ${options.to}: ${error.message}`,
      );
      if (error.response) {
        this.logger.error('SendGrid response:', error.response.body);
      }
      throw error;
    }
  }

  // ========== FALLBACK HTML METHODS ==========

  private getVerificationFallbackHtml(
    name: string,
    verificationUrl: string,
  ): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #8B4513; color: white; padding: 20px; text-align: center; }
          .button { 
            display: inline-block; 
            padding: 10px 20px; 
            background: #8B4513; 
            color: white; 
            text-decoration: none; 
            border-radius: 5px;
            margin: 20px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to Taj Kulture!</h1>
          </div>
          <div class="content">
            <p>Hello ${name},</p>
            <p>Please verify your email address by clicking the button below:</p>
            <p style="text-align: center;">
              <a href="${verificationUrl}" class="button">Verify Email Address</a>
            </p>
            <p>Or copy and paste this link: ${verificationUrl}</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private getPasswordResetFallbackHtml(name: string, resetUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #8B4513; color: white; padding: 20px; text-align: center; }
          .button { 
            display: inline-block; 
            padding: 10px 20px; 
            background: #8B4513; 
            color: white; 
            text-decoration: none; 
            border-radius: 5px;
            margin: 20px 0;
          }
          .warning { background: #fff3cd; border: 1px solid #ffeeba; padding: 15px; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Request</h1>
          </div>
          <div class="content">
            <p>Hello ${name},</p>
            <p>We received a request to reset your password.</p>
            <p style="text-align: center;">
              <a href="${resetUrl}" class="button">Reset Password</a>
            </p>
            <p>This link will expire in 1 hour.</p>
            <div class="warning">
              <p><strong>Didn't request this?</strong> If you didn't request a password reset, please ignore this email.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private getWelcomeFallbackHtml(name: string, loginUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #8B4513; color: white; padding: 20px; text-align: center; }
          .button { 
            display: inline-block; 
            padding: 10px 20px; 
            background: #8B4513; 
            color: white; 
            text-decoration: none; 
            border-radius: 5px;
            margin: 20px 0;
          }
          .features { display: flex; flex-wrap: wrap; margin: 20px 0; }
          .feature { flex: 1; min-width: 200px; padding: 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to Taj Kulture, ${name}!</h1>
          </div>
          <div class="content">
            <p>We're thrilled to have you join our community!</p>
            <div class="features">
              <div class="feature">
                <h3>🪡 Handcrafted Treasures</h3>
                <p>Authentic pieces from master artisans</p>
              </div>
              <div class="feature">
                <h3>📖 Cultural Stories</h3>
                <p>Every product has a story</p>
              </div>
              <div class="feature">
                <h3>🤝 Support Artisans</h3>
                <p>Directly support traditional crafts</p>
              </div>
            </div>
            <p style="text-align: center;">
              <a href="${loginUrl}" class="button">Start Exploring</a>
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // ========== SPECIFIC EMAIL METHODS ==========

  async sendVerificationEmail(
    email: string,
    name: string,
    verificationToken: string,
  ): Promise<void> {
    const verificationUrl = `${this.configService.get('FRONTEND_URL')}/verify-email?token=${verificationToken}`;

    // Try SendGrid template first
    const templateId = this.configService.get(
      'SENDGRID_VERIFICATION_TEMPLATE_ID',
    );

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

    // Fallback to HBS template
    const template = this.templates.get('verification');
    if (template) {
      const html = template({
        name,
        verificationUrl,
        year: new Date().getFullYear(),
      });
      await this.sendEmail({
        to: email,
        subject: 'Welcome to Taj Kulture - Verify Your Email',
        html,
      });
      return;
    }

    // Ultimate fallback - simple HTML
    await this.sendEmail({
      to: email,
      subject: 'Welcome to Taj Kulture - Verify Your Email',
      html: this.getVerificationFallbackHtml(name, verificationUrl),
    });
  }

  async sendPasswordResetEmail(
    email: string,
    name: string,
    resetToken: string,
  ): Promise<void> {
    const resetUrl = `${this.configService.get('FRONTEND_URL')}/reset-password?token=${resetToken}`;

    // Try SendGrid template
    const templateId = this.configService.get(
      'SENDGRID_PASSWORD_RESET_TEMPLATE_ID',
    );

    if (templateId) {
      await this.sendEmail({
        to: email,
        subject: 'Taj Kulture - Password Reset Request',
        templateId,
        dynamicTemplateData: {
          name,
          resetUrl,
          year: new Date().getFullYear(),
        },
      });
      return;
    }

    // Fallback to HBS template
    const template = this.templates.get('password-reset');
    if (template) {
      const html = template({
        name,
        resetUrl,
        year: new Date().getFullYear(),
      });
      await this.sendEmail({
        to: email,
        subject: 'Taj Kulture - Password Reset Request',
        html,
      });
      return;
    }

    // Ultimate fallback
    await this.sendEmail({
      to: email,
      subject: 'Taj Kulture - Password Reset Request',
      html: this.getPasswordResetFallbackHtml(name, resetUrl),
    });
  }

  async sendWelcomeEmail(email: string, name: string): Promise<void> {
    const loginUrl = `${this.configService.get('FRONTEND_URL')}/login`;

    // Try SendGrid template
    const templateId = this.configService.get('SENDGRID_WELCOME_TEMPLATE_ID');

    if (templateId) {
      await this.sendEmail({
        to: email,
        subject: 'Welcome to Taj Kulture!',
        templateId,
        dynamicTemplateData: {
          name,
          loginUrl,
          year: new Date().getFullYear(),
        },
      });
      return;
    }

    // Fallback to HBS template
    const template = this.templates.get('welcome');
    if (template) {
      const html = template({
        name,
        loginUrl,
        year: new Date().getFullYear(),
      });
      await this.sendEmail({
        to: email,
        subject: 'Welcome to Taj Kulture!',
        html,
      });
      return;
    }

    // Ultimate fallback
    await this.sendEmail({
      to: email,
      subject: 'Welcome to Taj Kulture!',
      html: this.getWelcomeFallbackHtml(name, loginUrl),
    });
  }

  async sendOrderConfirmationEmail(
    email: string,
    name: string,
    orderNumber: string,
    items: any[],
    total: number,
  ): Promise<void> {
    const orderUrl = `${this.configService.get('FRONTEND_URL')}/orders/${orderNumber}`;

    // Try SendGrid template
    const templateId = this.configService.get(
      'SENDGRID_ORDER_CONFIRMATION_TEMPLATE_ID',
    );

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

    // Fallback to HBS template
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

    // Ultimate fallback - your existing HTML generation
    const itemsList = items
      .map(
        (item) => `
        <tr>
          <td>${item.name}</td>
          <td>${item.quantity}</td>
          <td>$${item.price.toFixed(2)}</td>
          <td>$${(item.price * item.quantity).toFixed(2)}</td>
        </tr>
      `,
      )
      .join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; }
          .container { max-width: 600px; margin: 0 auto; }
          table { width: 100%; border-collapse: collapse; }
          th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Order Confirmed!</h1>
          <p>Thank you for your order, ${name}!</p>
          <p>Order #: ${orderNumber}</p>
          
          <h3>Order Summary:</h3>
          <table>
            <thead>
              <tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr>
            </thead>
            <tbody>
              ${itemsList}
            </tbody>
            <tfoot>
              <tr><td colspan="3" style="text-align: right;"><strong>Total:</strong></td>
              <td><strong>$${total.toFixed(2)}</strong></td></tr>
            </tfoot>
          </table>
          
          <p>View your order: <a href="${orderUrl}">${orderUrl}</a></p>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail({
      to: email,
      subject: `Order Confirmed #${orderNumber}`,
      html,
    });
  }

  async sendVendorApprovalEmail(
    email: string,
    storeName: string,
  ): Promise<void> {
    const dashboardUrl = `${this.configService.get('FRONTEND_URL')}/vendor/dashboard`;

    const html = `
      <!DOCTYPE html>
      <html>
      <body>
        <div style="max-width: 600px; margin: 0 auto;">
          <h1>Congratulations ${storeName}!</h1>
          <p>Your vendor application has been approved.</p>
          <p>You can now start listing your products on Taj Kulture.</p>
          <p><a href="${dashboardUrl}">Go to your dashboard</a></p>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail({
      to: email,
      subject: 'Your Taj Kulture Vendor Application is Approved!',
      html,
    });
  }
}
