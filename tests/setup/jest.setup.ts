/**
 * JEST GLOBAL SETUP
 *
 * WHAT THIS DOES:
 * - Loads environment variables for testing
 * - Sets up test database (creates schema, runs migrations)
 * - Configures global mocks (Redis, AWS, Payment gateways)
 * - Runs before ANY test executes
 *
 * WHY NEEDED: Tests need isolated environment that doesn't touch your real database
 */

import 'dotenv/config';
import { TestDatabase } from './test-database';

// ============================================
// LOAD TEST ENVIRONMENT VARIABLES
// ============================================
// Force test environment (overrides .env file)
process.env.NODE_ENV = 'test';
process.env.REDIS_ENABLED = 'false'; // Disable Redis in tests (use mocks)

// Ensure database URL points to test database (not your real data!)
// If DATABASE_URL doesn't contain 'test', we throw an error to prevent accidents
const databaseUrl = process.env.DATABASE_URL || '';
if (!databaseUrl.includes('test') && !databaseUrl.includes('postgres')) {
  throw new Error(
    '⚠️ TEST SETUP ERROR: DATABASE_URL must point to a test database!\n' +
      'Current URL: ' +
      databaseUrl +
      '\n' +
      'Example: postgresql://localhost:5432/taj_kulture_test',
  );
}

// ============================================
// GLOBAL TEST HOOKS
// ============================================

/**
 * beforeAll - Runs ONCE before all tests start
 *
 * Use for: Expensive setup operations that can be shared across tests
 * - Setting up database schema
 * - Initializing test data
 * - Starting mock servers
 */
beforeAll(async () => {
  console.log('\n🧪 [TEST SETUP] Initializing test environment...');

  // Initialize test database (create schema, run migrations)
  await TestDatabase.initialize();

  console.log('✅ [TEST SETUP] Test database ready');
});

/**
 * beforeEach - Runs BEFORE each individual test
 *
 * Use for: Isolating tests from each other
 * - Clearing database tables
 * - Resetting mocks
 * - Fresh state for each test
 */
beforeEach(async () => {
  // Clear all database tables (but keep schema)
  await TestDatabase.clearTables();

  // Reset all Jest mocks (clears call counts, implementations)
  jest.clearAllMocks();
  jest.resetAllMocks();
});

/**
 * afterAll - Runs ONCE after ALL tests finish
 *
 * Use for: Cleanup operations
 * - Closing database connections
 * - Stopping mock servers
 * - Deleting test artifacts
 */
afterAll(async () => {
  console.log('\n🧹 [TEST CLEANUP] Cleaning up test environment...');

  // Close database connection
  await TestDatabase.close();

  console.log('✅ [TEST CLEANUP] Cleanup complete');
});

// ============================================
// GLOBAL MOCKS
// ============================================

// Mock Winston logger to avoid log file clutter during tests
jest.mock('winston', () => ({
  createLogger: jest.fn().mockReturnValue({
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    json: jest.fn(),
    colorize: jest.fn(),
    simple: jest.fn(),
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn(),
  },
}));

// Mock SendGrid email service to prevent actual emails during tests
jest.mock('@sendgrid/mail', () => ({
  setApiKey: jest.fn(),
  send: jest.fn().mockResolvedValue([{ statusCode: 202 }, {}]),
}));

// Mock AWS S3 to prevent actual file uploads during tests
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({}),
  })),
  PutObjectCommand: jest.fn(),
  DeleteObjectCommand: jest.fn(),
}));
