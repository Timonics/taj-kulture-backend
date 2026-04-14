import { Global, Module, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';

/**
 * EMAIL MODULE
 *
 * Handles all email sending using SendGrid with multiple fallback strategies:
 * 1. SendGrid Dynamic Templates (best - can edit in UI)
 * 2. Handlebars templates (good - version controlled)
 * 3. Inline HTML (fallback - always works)
 *
 * @Global() - Makes EmailService available everywhere without importing
 */
@Global()
@Module({
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule implements OnModuleInit {
  constructor(
    private emailService: EmailService,
    private configService: ConfigService,
  ) {}

  async onModuleInit() {
    // Validate email configuration on startup
    const apiKey = this.configService.get('SENDGRID_API_KEY');
    const fromEmail = this.configService.get('SENDGRID_FROM_EMAIL');

    if (!apiKey) {
      console.warn('⚠️ SENDGRID_API_KEY not set. Email sending will fail.');
    }

    if (!fromEmail) {
      console.warn('⚠️ SENDGRID_FROM_EMAIL not set. Email sending will fail.');
    }

    // Initialize email service (sets up SendGrid)
    await this.emailService.onModuleInit();
  }
}
