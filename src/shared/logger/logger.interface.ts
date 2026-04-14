/**
 * LOGGER INTERFACE
 * 
 * Defines the contract for all logging operations across the application.
 * This ensures consistent logging behavior regardless of the underlying implementation.
 * 
 * Why an interface?
 * - Allows easy swapping of logging libraries (Winston, Pino, etc.)
 * - Enables mocking for tests
 * - Ensures all loggers have the same API
 */

/**
 * Context metadata that can be attached to any log entry
 * 
 * Why separate LogContext?
 * - Provides structured data for log aggregation tools (Datadog, Splunk, etc.)
 * - Makes logs searchable and filterable
 * - Enables correlation across distributed systems
 */
export interface LogContext {
  /** Unique identifier for tracking a single request across services */
  correlationId?: string;
  
  /** User ID if the action is performed by an authenticated user */
  userId?: string;
  
  /** Session ID for tracking user sessions */
  sessionId?: string;
  
  /** Request ID from the HTTP request */
  requestId?: string;
  
  /** IP address of the client */
  ip?: string;
  
  /** User agent for debugging client issues */
  userAgent?: string;
  
  /** Any additional context - allows flexibility without breaking the contract */
  [key: string]: any;
}

/**
 * Main logger interface that all loggers must implement
 * 
 * Why these specific methods?
 * - Follows standard logging levels: debug, info, warn, error
 * - child() allows for context-aware loggers (module-specific, user-specific, etc.)
 */
export interface ILogger {
  /**
   * Debug level - for development debugging only
   * Should not appear in production logs unless LOG_LEVEL=debug
   */
  debug(message: string, context?: LogContext): void;
  
  /**
   * Info level - normal application events
   * Examples: user logged in, order created, cache hit
   */
  info(message: string, context?: LogContext): void;
  
  /**
   * Warn level - unexpected but handled events
   * Examples: rate limit hit, deprecated API used, retry attempts
   */
  warn(message: string, context?: LogContext): void;
  
  /**
   * Error level - exceptions and failures
   * Always includes stack trace and correlation ID for debugging
   */
  error(message: string, trace?: string, context?: LogContext): void;
  
  /**
   * Creates a child logger with pre-filled context
   * 
   * Why child loggers?
   * - Avoids passing context parameters everywhere
   * - Ensures all logs from a module have consistent context
   * - Example: AuthLogger automatically includes module="Auth"
   */
  child(module: string): ILogger;
}