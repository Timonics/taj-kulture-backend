import {
  Environment,
  EnvironmentVariables,
} from '../../src/config/env/env.validation';

export class TestEnvHelper {
  private originalEnv: NodeJS.ProcessEnv;

  constructor() {
    this.originalEnv = { ...process.env };
  }

  // Set test environment variables
  setTestEnv(overrides: Partial<EnvironmentVariables> = {}) {
    const defaultTestEnv: Partial<EnvironmentVariables> = {
      NODE_ENV: Environment.Test,
      PORT: 3001,
      DATABASE_URL: 'postgresql://localhost:5432/taj_kulture_test',
      JWT_SECRET: 'test-jwt-secret-32-chars-minimum-length',
      JWT_EXPIRES_IN: '1h',
      JWT_REFRESH_SECRET: 'test-refresh-secret-32-chars-minimum',
      JWT_REFRESH_EXPIRES_IN: '7d',
      REDIS_ENABLED: false,
      SENDGRID_API_KEY: 'test-key',
      SENDGRID_FROM_EMAIL: 'test@example.com',
      SENDGRID_FROM_NAME: 'Test',
      FRONTEND_URL: 'http://localhost:3000',
      AWS_ACCESS_KEY_ID: 'test-key',
      AWS_SECRET_ACCESS_KEY: 'test-secret',
      AWS_REGION: 'us-east-1',
      AWS_S3_BUCKET: 'test-bucket',
    };

    Object.assign(process.env, defaultTestEnv, overrides);
  }

  // Restore original environment
  restore() {
    process.env = this.originalEnv;
  }
}
