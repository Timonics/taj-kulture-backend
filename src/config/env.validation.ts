import { plainToClass } from 'class-transformer';
import {
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  validateSync,
} from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV: Environment;

  @IsNumber()
  PORT: number;

  @IsString()
  DATABASE_URL: string;

  @IsString()
  JWT_SECRET: string;

  @IsString()
  JWT_EXPIRES_IN: string;

  @IsString()
  JWT_REFRESH_SECRET: string;

  @IsString()
  JWT_REFRESH_EXPIRES_IN: string;

  @IsString()
  GOOGLE_CLIENT_ID: string;

  @IsString()
  GOOGLE_CLIENT_SECRET: string;

  @IsString()
  GOOGLE_CALLBACK_URL: string;

  //Redis
  @IsString()
  REDIS_ENABLED: string;

  @IsString()
  REDIS_HOST: string;

  @IsNumber()
  REDIS_PORT: number;

  @IsString()
  REDIS_URL: string;

  // Email
  @IsString()
  SENDGRID_API_KEY: string;

  @IsString()
  SENDGRID_FROM_EMAIL: string;

  @IsString()
  SENDGRID_FROM_NAME: string;

  @IsString()
  SENDGRID_VERIFICATION_TEMPLATE_ID: string;

  @IsString()
  SENDGRID_WELCOME_TEMPLATE_ID: string;

  @IsString()
  SENDGRID_PASSWORD_RESET_TEMPLATE_ID: string;

  @IsString()
  SENDGRID_ORDER_CONFIRMATION_TEMPLATE_ID: string;

  @IsString()
  FRONTEND_URL: string;

  // Rate Limiting
  @IsNumber()
  @IsOptional()
  THROTTLE_TTL?: number;

  @IsNumber()
  @IsOptional()
  THROTTLE_LIMIT?: number;

  // Token Expiration
  @IsString()
  @IsOptional()
  EMAIL_VERIFICATION_TOKEN_EXPIRES_IN?: string;

  @IsString()
  @IsOptional()
  PASSWORD_RESET_TOKEN_EXPIRES_IN?: string;

  // AWS S3
  @IsString()
  AWS_ACCESS_KEY_ID: string;

  @IsString()
  AWS_SECRET_ACCESS_KEY: string;

  @IsString()
  AWS_REGION: string;

  @IsString()
  AWS_S3_BUCKET: string;

  @IsString()
  @IsOptional()
  AWS_S3_ENDPOINT?: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToClass(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }
  return validatedConfig;
}
