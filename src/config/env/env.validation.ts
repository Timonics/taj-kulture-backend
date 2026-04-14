import { plainToClass } from 'class-transformer';
import {
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  IsUrl,
  Min,
  Max,
  IsBoolean,
  IsNotEmpty,
  validateSync,
  ValidationError,
  IsEmail,
} from 'class-validator';
import { Transform } from 'class-transformer';

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export class EnvironmentVariables {
  // ========== Core ==========
  @IsEnum(Environment)
  NODE_ENV!: Environment;

  @IsNumber()
  @Min(1)
  @Max(65535)
  @Transform(({ value }) => parseInt(value, 10))
  PORT!: number;

  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim())
  DATABASE_URL!: string;

  // ========== JWT ==========
  @IsString()
  @IsNotEmpty()
  JWT_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  JWT_EXPIRES_IN!: string;

  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_EXPIRES_IN!: string;

  // ========== Google OAuth ==========
  @IsString()
  @IsOptional()
  GOOGLE_CLIENT_ID?: string;

  @IsString()
  @IsOptional()
  GOOGLE_CLIENT_SECRET?: string;

  // @IsUrl()
  @IsString()
  @IsOptional()
  GOOGLE_CALLBACK_URL?: string;

  // ========== Redis ==========
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === '1')
  REDIS_ENABLED!: boolean;

  @IsString()
  @IsOptional()
  REDIS_HOST?: string;

  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(value, 10) : undefined))
  REDIS_PORT?: number;

  // @IsUrl()
  @IsString()
  @IsOptional()
  REDIS_URL?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(15)
  @Transform(({ value }) => (value ? parseInt(value, 10) : undefined))
  REDIS_DB?: number;

  @IsString()
  @IsOptional()
  REDIS_PASSWORD?: string;

  @IsString()
  @IsOptional()
  REDIS_KEY_PREFIX?: string;

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Transform(({ value }) => (value ? parseInt(value, 10) : undefined))
  REDIS_RETRY_ATTEMPTS?: number;

  @IsNumber()
  @IsOptional()
  @Min(100)
  @Transform(({ value }) => (value ? parseInt(value, 10) : undefined))
  REDIS_RETRY_DELAY?: number;

  // ========== Email (SendGrid) ==========
  @IsString()
  @IsNotEmpty()
  SENDGRID_API_KEY!: string;

  @IsEmail()
  @IsNotEmpty()
  SENDGRID_FROM_EMAIL!: string;

  @IsString()
  @IsNotEmpty()
  SENDGRID_FROM_NAME!: string;

  @IsString()
  @IsOptional()
  SENDGRID_VERIFICATION_TEMPLATE_ID?: string;

  @IsString()
  @IsOptional()
  SENDGRID_WELCOME_TEMPLATE_ID?: string;

  @IsString()
  @IsOptional()
  SENDGRID_PASSWORD_RESET_TEMPLATE_ID?: string;

  @IsString()
  @IsOptional()
  SENDGRID_ORDER_CONFIRMATION_TEMPLATE_ID?: string;

  @IsString()
  @IsOptional()
  SENDGRID_SHIPPING_UPDATE_TEMPLATE_ID?: string;

  @IsString()
  @IsOptional()
  SENDGRID_ORDER_CANCELLATION_TEMPLATE_ID?: string;

  @IsString()
  @IsOptional()
  SENDGRID_VENDOR_APPROVAL_TEMPLATE_ID?: string;

  @IsString()
  @IsOptional()
  SENDGRID_VENDOR_REJECTION_TEMPLATE_ID?: string;

  // ========== Frontend ==========
  // @IsUrl()
  @IsString()
  FRONTEND_URL!: string;

  // ========== Rate Limiting ==========
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Transform(({ value }) => (value ? parseInt(value, 10) : 60))
  THROTTLE_TTL?: number = 60;

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Transform(({ value }) => (value ? parseInt(value, 10) : 100))
  THROTTLE_LIMIT?: number = 100;

  // ========== Token Expiration ==========
  @IsString()
  @IsOptional()
  EMAIL_VERIFICATION_TOKEN_EXPIRES_IN?: string = '24h';

  @IsString()
  @IsOptional()
  PASSWORD_RESET_TOKEN_EXPIRES_IN?: string = '1h';

  // ========== AWS S3 ==========
  @IsString()
  @IsNotEmpty()
  AWS_ACCESS_KEY_ID!: string;

  @IsString()
  @IsNotEmpty()
  AWS_SECRET_ACCESS_KEY!: string;

  @IsString()
  @IsNotEmpty()
  AWS_REGION!: string;

  @IsString()
  @IsNotEmpty()
  AWS_S3_BUCKET!: string;

  // @IsUrl()
  @IsString()
  @IsOptional()
  AWS_S3_ENDPOINT?: string;

  // @IsUrl()
  @IsString()
  @IsOptional()
  AWS_S3_BUCKET_PUBLIC_URL?: string;

  // ========== Request Timeout ==========
  @IsNumber()
  @IsOptional()
  @Min(1000)
  @Max(120000)
  @Transform(({ value }) => (value ? parseInt(value, 10) : 30000))
  REQUEST_TIMEOUT?: number = 30000;

  // ========== Logging Configuration ==========
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === '1')
  LOG_FILE_ENABLED?: boolean = false; // ← ADD THIS

  @IsString()
  @IsOptional()
  LOG_FILE_PATH?: string = './logs'; // ← ADD THIS

  @IsString()
  @IsOptional()
  LOG_LEVEL?: 'error' | 'warn' | 'info' | 'debug' = 'info'; // ← ADD THIS

  // ========== Security ==========
  @IsNumber()
  @IsOptional()
  @Min(8)
  @Max(14)
  @Transform(({ value }) => (value ? parseInt(value, 10) : 10))
  BCRYPT_ROUNDS?: number = 10;

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === '1')
  ENABLE_CSRF?: boolean = true;

  // ========== Feature Flags ==========
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === '1')
  ENABLE_MAINTENANCE_MODE?: boolean = false;

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === '1')
  ENABLE_EMAIL_VERIFICATION?: boolean = true;

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === '1')
  ENABLE_GOOGLE_AUTH?: boolean = false;

  // Custom validation for conditional requirements
  private validateConditionalRequirements() {
    if (
      this.ENABLE_GOOGLE_AUTH &&
      (!this.GOOGLE_CLIENT_ID || !this.GOOGLE_CLIENT_SECRET)
    ) {
      throw new Error(
        'Google OAuth is enabled but missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET',
      );
    }

    if (
      this.REDIS_ENABLED &&
      !this.REDIS_URL &&
      (!this.REDIS_HOST || !this.REDIS_PORT)
    ) {
      throw new Error(
        'Redis is enabled but missing REDIS_URL or REDIS_HOST/PORT',
      );
    }
  }

  postValidate() {
    this.validateConditionalRequirements();
    return this;
  }
}

function formatValidationErrors(errors: ValidationError[]): string {
  return errors
    .map((error) => {
      const constraints = Object.values(error.constraints || {});
      return `  • ${error.property}: ${constraints.join(', ')}`;
    })
    .join('\n');
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToClass(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
    whitelist: true,
    // forbidNonWhitelisted: true,
  });

  if (errors.length > 0) {
    const formattedErrors = formatValidationErrors(errors);
    throw new Error(`❌ Environment validation failed:\n${formattedErrors}`);
  }

  return validatedConfig.postValidate();
}
