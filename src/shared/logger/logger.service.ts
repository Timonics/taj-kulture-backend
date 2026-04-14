import {
  Injectable,
  Scope,
  LoggerService as NestLoggerService,
} from '@nestjs/common';
import {
  createLogger,
  format,
  transports,
  Logger as WinstonLoggerType,
} from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { ILogger, LogContext } from './logger.interface';
import { EnvironmentService } from '../../config/env/env.service';
import { RequestContext } from 'src/core/context/request-context';

/**
 * Main Logger Service
 *
 * Implements the ILogger interface using Winston as the underlying logging library.
 *
 * Why Winston?
 * - Most popular Node.js logging library (stable, battle-tested)
 * - Rich transports ecosystem (files, databases, cloud services)
 * - Flexible formatting (JSON, pretty, custom)
 * - Log rotation built-in via daily-rotate-file
 *
 * Why Scope.TRANSIENT?
 * - Creates a new instance for each class that injects it
 * - Allows each service to have its own context (module name)
 * - Prevents cross-contamination of context between services
 */
@Injectable({ scope: Scope.TRANSIENT })
export class LoggerService implements ILogger {
  /** Underlying Winston logger instance */
  private logger!: WinstonLoggerType;

  /** Current module/class name for context */
  private context: string = 'Application';

  /** Reference to environment service for config access */
  private env: EnvironmentService;

  constructor() {
    // Get singleton instance of environment service
    this.env = EnvironmentService.getInstance();

    // Initialize the Winston logger with appropriate configuration
    this.initializeLogger();
  }

  /**
   * Initialize Winston logger with production-ready configuration
   *
   * Why this configuration?
   * - Multiple transports: console for dev, files for production
   * - JSON format for log aggregation (ELK, Datadog, etc.)
   * - Daily rotation to prevent disk space issues
   * - Different log levels for different environments
   */
  private initializeLogger(): void {
    // Determine log level based on environment
    // Production: warn and above to reduce noise
    // Development: debug and above for maximum visibility
    const logLevel = this.env.isProduction() ? 'warn' : 'debug';

    // Create the Winston logger instance
    this.logger = createLogger({
      // Minimum log level - messages below this are ignored
      level: logLevel,

      // Default metadata added to every log entry
      defaultMeta: {
        service: 'taj-kulture-api', // Service name for microservices identification
        environment: this.env.get('NODE_ENV'), // Environment for filtering
        version: process.env.npm_package_version || '1.0.0', // Version for deployment tracking
      },

      // Format for all logs
      format: this.getLogFormat(),

      // Where logs are sent
      transports: this.getTransports(),
    });
  }

  /**
   * Get the appropriate log format based on environment
   *
   * Why different formats?
   * - Development: Human-readable with colors for easy debugging
   * - Production: JSON for machine parsing (ELK, Datadog, Splunk)
   */
  private getLogFormat() {
    if (this.env.isDevelopment()) {
      // Development format: colorful, human-readable
      return format.combine(
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.colorize({ all: true }), // Add colors to log levels
        format.printf(
          ({ timestamp, level, message, context, correlationId, ...meta }) => {
            const correlation = correlationId ? `[${correlationId}] ` : '';
            const contextStr = context ? `[${context}] ` : '';
            const metaStr = Object.keys(meta).length
              ? `\n${JSON.stringify(meta, null, 2)}`
              : '';
            return `${timestamp} ${level}: ${correlation}${contextStr}${message}${metaStr}`;
          },
        ),
      );
    }

    // Production format: JSON for log aggregation
    return format.combine(
      format.timestamp(),
      format.errors({ stack: true }), // Include stack traces for errors
      format.json(), // Output as JSON
    );
  }

  /**
   * Configure log transports (where logs are sent)
   *
   * Why multiple transports?
   * - Console: Immediate visibility during development
   * - File: Persistent storage for production debugging
   * - Daily rotate: Prevents disk space exhaustion
   */
  private getTransports() {
    const transportsList: any[] = [];

    // Console transport - always enabled
    // Good for: Development debugging, Docker logs, Kubernetes pods
    transportsList.push(
      new transports.Console({
        handleExceptions: true, // Catch uncaught exceptions
        handleRejections: true, // Catch unhandled promise rejections
      }),
    );

    // File transport - enabled in production or when LOG_FILE_ENABLED=true
    // Good for: Persistent logs, post-mortem debugging, compliance
    if (this.env.isProduction() || this.env.get('LOG_FILE_ENABLED')) {
      const logFilePath = this.env.get('LOG_FILE_PATH') || './logs';

      // Rotating file transport - creates new file daily
      // Prevents single log file from growing indefinitely
      transportsList.push(
        new DailyRotateFile({
          filename: `${logFilePath}/taj-kulture-%DATE%.log`,
          datePattern: 'YYYY-MM-DD', // New file every day
          maxSize: '20m', // Rotate if file exceeds 20MB
          maxFiles: '14d', // Keep logs for 14 days
          format: format.combine(format.timestamp(), format.json()),
        }),
      );

      // Separate error log file - only errors and above
      // Makes debugging failures easier
      transportsList.push(
        new DailyRotateFile({
          filename: `${logFilePath}/taj-kulture-error-%DATE%.log`,
          datePattern: 'YYYY-MM-DD',
          level: 'error', // Only error level and above
          maxSize: '20m',
          maxFiles: '30d', // Keep error logs longer (30 days)
          format: format.combine(format.timestamp(), format.json()),
        }),
      );
    }

    return transportsList;
  }

  // /**
  //  * Set the correlation ID for the current request
  //  *
  //  * Why separate method?
  //  * - Allows middleware to set correlation ID before any logging
  //  * - Ensures all logs from the same request have the same ID
  //  * - Thread-safe when used with AsyncLocalStorage (though NestJS handles this)
  //  */
  // setCorrelationId(correlationId: string): void {
  //   this.correlationId = correlationId;
  // }

  /**
   * Set the current module/class name for context
   *
   * Used by the child() method to create context-specific loggers
   */
  setContext(context: string): void {
    this.context = context;
  }

  /**
   * Debug level log
   *
   * Use cases:
   * - Cache operations (hit/miss)
   * - Database query execution
   * - Detailed request/response data (never log passwords!)
   */
  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  /**
   * Info level log - Normal application flow
   *
   * Use cases:
   * - User actions (login, registration, order placement)
   * - Background job execution
   * - Scheduled tasks
   */
  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  /**
   * Warn level log - Unexpected but handled issues
   *
   * Use cases:
   * - Rate limit exceeded
   * - Retry attempts
   * - Deprecated API usage
   * - Failed but recoverable operations
   */
  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  /**
   * Error level log - Failures that need attention
   *
   * Use cases:
   * - Exception caught
   * - Database connection failure
   * - Payment gateway errors
   * - Third-party API failures
   */
  error(message: string, trace?: string, context?: LogContext): void {
    this.log('error', message, context, trace);
  }

  /**
   * Create a child logger with pre-filled context
   *
   * Why child loggers?
   * - Eliminates repetitive context passing
   * - Ensures consistency within a module
   *
   * @example
   *   const authLogger = logger.child('AuthService');
   *   authLogger.info('User logged in'); // Automatically includes context: 'AuthService'
   */
  child(module: string): ILogger {
    const childLogger = new LoggerService();
    childLogger.setContext(module);
    // childLogger.setCorrelationId(this.correlationId);
    return childLogger;
  }

  /**
   * Core logging method that handles all log levels
   *
   * This allows services to log without explicitly passing correlationId
   * Example:
   *   logger.info('User logged in'); // Automatically includes correlation ID from context
   *
   * Why private?
   * - Internal implementation detail
   * - Public interface uses level-specific methods for clarity
   */
  private log(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    context?: LogContext,
    trace?: string,
  ): void {
    // Try to get correlation ID from multiple sources (priority order):
    // 1. Explicitly passed in context (highest priority for overrides)
    // 2. Set on the logger instance (from child loggers)
    // 3. From AsyncLocalStorage (current request context)
    // 4. None (last resort)
    const correlationId =
      context?.correlationId ?? RequestContext.getCorrelationId();

    // Build complete context with all available metadata
    const fullContext = {
      // Include module context if set
      context: this.context,

      // Include correlation ID for request tracing
      correlationId: correlationId,

      // Include any additional context passed in
      ...context,
    };

    // If this is an error and we have a stack trace, include it
    if (trace && level === 'error') {
      fullContext['stack'] = trace;
    }

    // Remove undefined values to keep logs clean
    Object.keys(fullContext).forEach(
      (key) => fullContext[key] === undefined && delete fullContext[key],
    );

    // Log to Winston
    if (trace && level === 'error') {
      this.logger.log(level, message, { ...fullContext, stack: trace });
    } else {
      this.logger.log(level, message, fullContext);
    }
  }
}
