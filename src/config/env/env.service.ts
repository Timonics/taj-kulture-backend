import { Injectable, Logger } from '@nestjs/common';
import { EnvironmentVariables, Environment } from './env.validation';

@Injectable()
export class EnvironmentService {
  private static instance: EnvironmentService; // Singleton instance
  private readonly logger = new Logger(EnvironmentService.name);
  private readonly env: EnvironmentVariables;

  /**
   * Private constructor - use getInstance() instead
   * This ensures only one instance exists
   */
  private constructor() {
    // env is already validated by the time we get here
    this.env = process.env as unknown as EnvironmentVariables;
    this.logConfiguration();
  }

  /**
   * Get the singleton instance of EnvironmentService
   *
   * WHY SINGLETON?
   * - Environment variables don't change at runtime
   * - One instance = consistent config everywhere
   * - Can be used outside NestJS (queues, cron jobs, scripts)
   * - Prevents unnecessary re-initialization
   *
   * USAGE:
   *   const env = EnvironmentService.getInstance();
   *   const port = env.get('PORT');
   * 
   * NOTE: Still works with NestJS DI because -@Injectable() creates
   * a singleton by default in NestJS. This method just provides
   * a way to access it outside of NestJS context.
   */
  static getInstance(): EnvironmentService {
    if (!EnvironmentService.instance) {
      EnvironmentService.instance = new EnvironmentService();
    }
    return EnvironmentService.instance;
  }

  /**
   * For NestJS DI - returns the singleton instance
   * This allows both patterns to work:
   * - constructor(private env: EnvironmentService) {} // NestJS DI
   * - const env = EnvironmentService.getInstance();   // Manual access
   */
  static forRoot(): EnvironmentService {
    return EnvironmentService.getInstance();
  }

  private logConfiguration(): void {
    this.logger.log(`✅ Environment: ${this.env.NODE_ENV}`);
    this.logger.log(`✅ Port: ${this.env.PORT}`);

    if (this.isProduction()) {
      this.logger.log('🚀 Running in production mode');
    }

    if (this.env.ENABLE_MAINTENANCE_MODE) {
      this.logger.warn('⚠️  Maintenance mode is ENABLED');
    }
  }

  // Type-safe getter for all env variables
  get<K extends keyof EnvironmentVariables>(key: K): EnvironmentVariables[K] {
    return this.env[key];
  }

  // Environment checks
  isDevelopment(): boolean {
    return this.env.NODE_ENV === Environment.Development;
  }

  isProduction(): boolean {
    return this.env.NODE_ENV === Environment.Production;
  }

  isTest(): boolean {
    return this.env.NODE_ENV === Environment.Test;
  }

  // JWT convenience methods
  getJwtConfig() {
    return {
      secret: this.env.JWT_SECRET,
      expiresIn: this.env.JWT_EXPIRES_IN,
      refreshSecret: this.env.JWT_REFRESH_SECRET,
      refreshExpiresIn: this.env.JWT_REFRESH_EXPIRES_IN,
    };
  }

  // Redis convenience methods
  getRedisConfig() {
    if (!this.env.REDIS_ENABLED) {
      return { enabled: false };
    }

    return {
      enabled: true,
      url: this.env.REDIS_URL,
      host: this.env.REDIS_HOST,
      port: this.env.REDIS_PORT,
    };
  }

  // Rate limiting convenience
  getRateLimitConfig() {
    return {
      ttl: this.env.THROTTLE_TTL,
      limit: this.env.THROTTLE_LIMIT,
    };
  }

  // AWS S3 convenience
  getS3Config() {
    return {
      accessKeyId: this.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: this.env.AWS_SECRET_ACCESS_KEY,
      region: this.env.AWS_REGION,
      bucket: this.env.AWS_S3_BUCKET,
      endpoint: this.env.AWS_S3_ENDPOINT,
    };
  }

  // Email convenience
  getEmailConfig() {
    return {
      apiKey: this.env.SENDGRID_API_KEY,
      from: {
        email: this.env.SENDGRID_FROM_EMAIL,
        name: this.env.SENDGRID_FROM_NAME,
      },
      templates: {
        verification: this.env.SENDGRID_VERIFICATION_TEMPLATE_ID,
        welcome: this.env.SENDGRID_WELCOME_TEMPLATE_ID,
        passwordReset: this.env.SENDGRID_PASSWORD_RESET_TEMPLATE_ID,
        orderConfirmation: this.env.SENDGRID_ORDER_CONFIRMATION_TEMPLATE_ID,
      },
    };
  }

  // Feature flags
  isMaintenanceMode(): boolean {
    return this.env.ENABLE_MAINTENANCE_MODE || false;
  }

  isEmailVerificationEnabled(): boolean {
    return this.env.ENABLE_EMAIL_VERIFICATION !== false;
  }

  isGoogleAuthEnabled(): boolean {
    return (
      this.env.ENABLE_GOOGLE_AUTH === true &&
      !!this.env.GOOGLE_CLIENT_ID &&
      !!this.env.GOOGLE_CLIENT_SECRET
    );
  }
}
