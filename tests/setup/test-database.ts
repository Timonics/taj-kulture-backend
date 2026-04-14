9 /**
 * TEST DATABASE MANAGER
 * 
 * PURPOSE: Manages a separate database for testing
 * 
 * WHY SEPARATE DATABASE:
 * - Tests should NEVER touch your development or production data
 * - Each test run needs a clean slate
 * - Parallel test execution requires isolated databases
 * 
 * HOW IT WORKS:
 * 1. Creates a test database with unique name (supports parallel test runs)
 * 2. Uses PrismaPg adapter for connection (required for Driver Adapters setup)
 * 3. Runs Prisma migrations to set up schema
 * 4. Provides utilities to clear data between tests
 * 5. Drops database after all tests complete
 */

import { PrismaClient } from 'generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { execSync } from 'child_process';
import { randomBytes } from 'crypto';

export class TestDatabase {
  private static prisma: PrismaClient;
  private static databaseName: string;
  private static originalDatabaseUrl: string;
  private static pool: Pool; // Store pool to close later

  /**
   * Initialize test database
   * 
   * Creates a unique database for this test run to allow parallel execution
   */
  static async initialize(): Promise<void> {
    // Generate unique database name for this test run
    // Format: taj_kulture_test_<random_suffix>
    // WHY UNIQUE: Allows multiple test suites to run in parallel without conflicts
    const uniqueSuffix = randomBytes(4).toString('hex');
    this.databaseName = `taj_kulture_test_${uniqueSuffix}`;
    
    // Store original DATABASE_URL to restore later
    this.originalDatabaseUrl = process.env.DATABASE_URL || '';
    
    // Extract connection parameters from original URL
    // Example: postgresql://user:password@localhost:5432/taj_kulture
    const match = this.originalDatabaseUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
    
    if (!match) {
      throw new Error('Invalid DATABASE_URL format');
    }
    
    const [, user, password, host, port] = match;
    
    // Create new database URL for the test database
    const testDatabaseUrl = `postgresql://${user}:${password}@${host}:${port}/${this.databaseName}`;
    
    // Create the test database
    await this.createDatabase(testDatabaseUrl);
    
    // Update environment variable for Prisma
    process.env.DATABASE_URL = testDatabaseUrl;
    
    // Initialize Prisma client with PostgreSQL adapter
    // REQUIRED: When using Prisma with Driver Adapters (PrismaPg)
    // You MUST pass an adapter option to PrismaClient
    this.pool = new Pool({ connectionString: testDatabaseUrl });
    const adapter = new PrismaPg(this.pool);
    this.prisma = new PrismaClient({ adapter });
    
    // Connect to the database
    await this.prisma.$connect();
    
    // Run migrations to set up schema
    await this.runMigrations();
    
    console.log(`✅ Test database created: ${this.databaseName}`);
  }

  /**
   * Create a new PostgreSQL database
   * 
   * Connects to the default 'postgres' database and creates a new database
   */
  private static async createDatabase(databaseUrl: string): Promise<void> {
    const match = databaseUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
    if (!match) throw new Error('Invalid database URL');
    
    const [, user, password, host, port, database] = match;
    
    // Connect to default 'postgres' database to create new database
    const adminUrl = `postgresql://${user}:${password}@${host}:${port}/postgres`;
    
    // Create admin client with adapter
    const adminPool = new Pool({ connectionString: adminUrl });
    const adminAdapter = new PrismaPg(adminPool);
    const adminPrisma = new PrismaClient({ adapter: adminAdapter });
    
    await adminPrisma.$connect();
    
    // Create database (ignore error if it already exists)
    try {
      await adminPrisma.$executeRawUnsafe(`CREATE DATABASE "${database}"`);
    } catch (error: any) {
      // Database might already exist - that's fine
      if (!error.message.includes('already exists')) {
        throw error;
      }
    }
    
    await adminPrisma.$disconnect();
    await adminPool.end();
  }

  /**
   * Run Prisma migrations to set up schema
   */
  private static async runMigrations(): Promise<void> {
    try {
      // Run migrations using Prisma CLI
      execSync('npx prisma migrate deploy', {
        stdio: 'inherit',
        env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
      });
    } catch (error) {
      console.error('Failed to run migrations:', error);
      throw error;
    }
  }

  /**
   * Clear all data from tables (but keep schema)
   * 
   * WHY: Each test needs a fresh database state
   * HOW: Truncates all tables in the correct order (respecting foreign keys)
   */
  static async clearTables(): Promise<void> {
    if (!this.prisma) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    
    // Get all table names from the database (exclude Prisma migration table)
    const tables = await this.prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
      AND tablename NOT IN ('_prisma_migrations')
    `;
    
    // Disable foreign key checks temporarily to allow truncating in any order
    await this.prisma.$executeRawUnsafe('SET CONSTRAINTS ALL DEFERRED');
    
    // Truncate each table (TRUNCATE is faster than DELETE for clearing all rows)
    for (const { tablename } of tables) {
      await this.prisma.$executeRawUnsafe(`TRUNCATE TABLE "${tablename}" CASCADE`);
    }
    
    // Re-enable foreign key checks
    await this.prisma.$executeRawUnsafe('SET CONSTRAINTS ALL IMMEDIATE');
  }

  /**
   * Get Prisma client instance for tests
   */
  static getPrisma(): PrismaClient {
    if (!this.prisma) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.prisma;
  }

  /**
   * Close database connection and drop test database
   * Called after all tests complete
   */
  static async close(): Promise<void> {
    // Disconnect Prisma client
    if (this.prisma) {
      await this.prisma.$disconnect();
    }
    
    // Close the connection pool
    if (this.pool) {
      await this.pool.end();
    }
    
    // Drop the test database
    if (this.databaseName && this.originalDatabaseUrl) {
      const match = this.originalDatabaseUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
      if (match) {
        const [, user, password, host, port] = match;
        const adminUrl = `postgresql://${user}:${password}@${host}:${port}/postgres`;
        
        // Create admin client to drop the test database
        const adminPool = new Pool({ connectionString: adminUrl });
        const adminAdapter = new PrismaPg(adminPool);
        const adminPrisma = new PrismaClient({ adapter: adminAdapter });
        
        await adminPrisma.$connect();
        // WITH (FORCE) terminates all existing connections before dropping
        await adminPrisma.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${this.databaseName}" WITH (FORCE)`);
        await adminPrisma.$disconnect();
        await adminPool.end();
        
        console.log(`✅ Test database dropped: ${this.databaseName}`);
      }
    }
    
    // Restore original DATABASE_URL
    process.env.DATABASE_URL = this.originalDatabaseUrl;
  }

  /**
   * Reset database to clean state (clear all data)
   * Useful between test suites
   */
  static async reset(): Promise<void> {
    await this.clearTables();
  }
}