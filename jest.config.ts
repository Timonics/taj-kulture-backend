/**
 * JEST CONFIGURATION
 * 
 * WHY THESE SETTINGS:
 * - testEnvironment: 'node' because we're testing a Node.js backend
 * - setupFilesAfterEnv: Runs setup code before tests (DB initialization, mocks)
 * - moduleNameMapper: Allows clean imports like '@core/exceptions' instead of '../../../'
 * - coverageThreshold: Forces minimum 80% coverage - no slacking!
 * - maxWorkers: 50% of CPU cores - balances speed vs resource usage
 */

export default {
  // Use Node.js environment (not jsdom - that's for frontend testing)
  testEnvironment: 'node',
  
  // TypeScript support - transforms .ts files to JS before running tests
  preset: 'ts-jest',
  
  // Test file patterns - where to find tests
  testMatch: [
    '**/tests/unit/**/*.spec.ts',        // Unit tests
    '**/tests/integration/**/*.spec.ts', // Integration tests
    '**/tests/e2e/**/*.e2e-spec.ts',     // E2E tests
  ],
  
  // Run this file before any test runs (global setup)
  setupFilesAfterEnv: ['<rootDir>/tests/setup/jest.setup.ts'],
  
  // Path aliases - allows clean imports in tests too
  moduleNameMapper: {
    '^@core/(.*)$': '<rootDir>/src/core/$1',
    '^@shared/(.*)$': '<rootDir>/src/shared/$1',
    '^@modules/(.*)$': '<rootDir>/src/modules/$1',
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1',
  },
  
  // Files to collect coverage from (exclude mocks, configs, and test files)
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.module.ts',           // Modules just glue code together
    '!src/**/*.interface.ts',        // Interfaces have no logic to test
    '!src/**/*.d.ts',                // Type declaration files
    '!src/main.ts',                  // App bootstrap file
    '!src/core/constants/**/*',      // Constants don't need testing
    '!src/config/**/*',              // Config is tested via integration
  ],
  
  // Coverage thresholds - fail if below these numbers
  // WHY 80%? Industry standard for production apps - high enough to catch bugs,
  // but not so high that developers waste time testing trivial getters/setters
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  
  // Coverage report formats
  // - text: Shows in console output
  // - lcov: Generates HTML report you can open in browser
  coverageReporters: ['text', 'lcov', 'json'],
  
  // Directory for coverage reports
  coverageDirectory: '<rootDir>/coverage',
  
  // Verbose output - shows individual test results
  verbose: true,
  
  // Timeout for tests (5 seconds default, sometimes too short for integration tests)
  testTimeout: 10000,
  
  // Max parallel workers - use 50% of available CPU cores
  // Balance: Faster tests vs resource usage on CI runners
  maxWorkers: '50%',
  
  // Clear mocks between tests automatically
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  
  // Global variables available in all tests
  globals: {
    'ts-jest': {
      isolatedModules: true,  // Faster compilation for tests
    },
  },
};