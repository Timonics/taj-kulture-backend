// src/core/filters/all-exceptions.filter.ts
/**
 * GLOBAL EXCEPTION FILTER - The Last Line of Defense
 * 
 * WHAT THIS FILE DOES:
 * Catches EVERY error that happens in your application and turns it into a
 * consistent, predictable response format that your frontend can handle.
 * 
 * WHY THIS IS CRITICAL:
 * Without this filter, different parts of your app throw different error formats:
 * - Your DomainException: { message, code, details }
 * - NestJS ValidationPipe: { statusCode, message, error }
 * - JWT Auth Guard: { statusCode, message }
 * - Prisma Database: { code: 'P2002', meta: {...} }
 * - Random crashes: Empty response or server crash
 * 
 * WITH THIS FILTER: EVERY error becomes { success: false, message, code, details, meta }
 * Your frontend code can handle ALL errors with ONE pattern.
 * 
 * HOW IT WORKS (Priority Order):
 * 1. Catches DomainException → Your custom errors (already formatted correctly)
 * 2. Catches HttpException → NestJS errors (Validation, Auth, Guards)
 * 3. Catches Prisma errors → Database errors (converted to friendly format)
 * 4. Catches everything else → Unknown errors (wrapped safely)
 */

import {
  ExceptionFilter,    // Interface for creating global exception filters
  Catch,              // Decorator to mark class as exception filter
  ArgumentsHost,      // Provides access to request/response objects
  HttpException,      // Base NestJS exception class
  HttpStatus,         // HTTP status code constants (200, 404, 500, etc.)
  Logger,             // NestJS built-in logger (different from our Winston logger)
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ERROR_CODES } from '../constants/error-codes.constants';
import { DomainException } from '../exceptions/domain.exception';

/**
 * Extended Express Request interface with our custom properties
 * 
 * WHY NEEDED: Express Request doesn't have correlationId by default
 * We add it via middleware, but TypeScript doesn't know that
 * This interface tells TypeScript these properties exist
 */
// interface RequestWithCorrelation extends Request {
//   /** Unique ID for tracking this request across logs (set by CorrelationIdMiddleware) */
//   correlationId?: string;
//   /** Authenticated user data (set by JWT Auth Guard) */
//   user?: {
//     id: string;
//     email: string;
//     role: string;
//   };
// }

/**
 * @Catch() with no arguments means "catch EVERYTHING"
 * This filter runs for ALL exceptions thrown in your app
 * 
 * Execution order:
 * 1. Exception thrown somewhere (service, controller, guard, etc.)
 * 2. This filter catches it BEFORE it reaches the client
 * 3. Formats it consistently
 * 4. Sends formatted response to client
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  /**
   * NestJS built-in logger instance
   * 
   * WHY NOT using our Winston LoggerService here?
   * - This filter runs VERY early in the request cycle
   * - Winston LoggerService might not be initialized yet
   * - Could cause circular dependencies
   * - NestJS Logger is always available and safe to use
   */
  private readonly logger = new Logger(AllExceptionsFilter.name);

  /**
   * Main exception handling method - called automatically by NestJS
   * 
   * @param exception - The error/exception that was thrown (could be anything)
   * @param host - Provides access to the HTTP context (request/response)
   * 
   * WHY ArgumentsHost instead of direct Request/Response?
   * - Works for different contexts (HTTP, WebSocket, RPC, etc.)
   * - More flexible for future use (if you add WebSockets)
   */
  catch(exception: unknown, host: ArgumentsHost) {
    // Switch to HTTP context (we're building a REST API, not WebSocket)
    const ctx = host.switchToHttp();
    
    // Get Express response object - used to send the error response
    const response = ctx.getResponse<Response>();
    
    // Get Express request object - used to get URL, correlationId, etc.
    const request = ctx.getRequest<Request>();
    
    // Extract correlation ID for request tracing (set by CorrelationIdMiddleware)
    // This allows you to find all logs related to this error in your log system
    const correlationId = request.correlationId;

    // Default error values (used if no specific error type matches)
    let status = HttpStatus.INTERNAL_SERVER_ERROR;  // 500
    let message = 'Internal server error';
    let code: string = ERROR_CODES.INTERNAL_ERROR;  // 'SYS_11003'
    let details = null;

    // ============================================================
    // CASE 1: Your Custom DomainException
    // ============================================================
    // These are errors you explicitly throw in your business logic:
    //   throw new ProductNotFoundException('prod_123')
    //   throw new UserNotFoundException()
    //   throw new InvalidCredentialsException()
    //
    // These exceptions ALREADY have the correct format because your
    // DomainException class formats them properly in its constructor.
    // So we just extract and return as-is.
    if (exception instanceof DomainException) {
      // Get HTTP status code (404, 400, 401, 403, etc.)
      status = exception.getStatus();
      
      // Get the already-formatted error response
      const exceptionResponse = exception.getResponse() as any;
      
      // Extract the error details (they're already in the right format)
      message = exceptionResponse.message || exception.message;
      code = exceptionResponse.code || code;
      details = exceptionResponse.details;
      
      // Log the error for debugging (but don't log 404s - too noisy)
      this.logError(exception, correlationId, status, code, request);
      
      // Send the response immediately and STOP execution (return)
      return response.status(status).json({
        success: false,
        message,
        code,
        details,
        meta: {
          timestamp: new Date().toISOString(),  // When error occurred
          path: request.url,                    // Which endpoint was called
          correlationId,                        // For request tracing
        },
      });
    }

    // ============================================================
    // CASE 2: NestJS HTTP Exceptions
    // ============================================================
    // These are thrown by NestJS built-in features:
    // - ValidationPipe: When DTO validation fails
    // - JwtAuthGuard: When token is invalid/missing
    // - RolesGuard: When user lacks permissions
    // - ThrottlerGuard: When rate limit exceeded
    // - And any HttpException you throw manually
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      // --------------------------------------------
      // SUB-CASE 2A: Validation Errors (class-validator)
      // --------------------------------------------
      // Example: POST /users with invalid email
      // NestJS returns: { statusCode: 400, message: ["email must be an email"], error: "Bad Request" }
      // We convert to: { success: false, code: "SYS_11000", message: "Validation failed", details: [...] }
      if (status === HttpStatus.BAD_REQUEST && 
          typeof exceptionResponse === 'object' && 
          'message' in exceptionResponse) {
        
        // Extract validation error messages (could be string or array)
        message = 'Validation failed';
        code = ERROR_CODES.VALIDATION_FAILED;  // 'SYS_11000'
        details = null
        
        this.logError(exception, correlationId, status, code, request);
        
        return response.status(status).json({
          success: false,
          message,
          code,
          details,
          meta: {
            timestamp: new Date().toISOString(),
            path: request.url,
            correlationId,
          },
        });
      }

      // --------------------------------------------
      // SUB-CASE 2B: Unauthorized (JWT Auth Guard)
      // --------------------------------------------
      // Example: Accessing /profile without valid JWT token
      // Status: 401 - User is not authenticated
      if (status === HttpStatus.UNAUTHORIZED) {
        message = exception.message || 'Unauthorized access';
        code = ERROR_CODES.UNAUTHORIZED;  // 'AUTH_1000'
        
        this.logError(exception, correlationId, status, code, request);
        
        return response.status(status).json({
          success: false,
          message,
          code,
          details: null,
          meta: {
            timestamp: new Date().toISOString(),
            path: request.url,
            correlationId,
          },
        });
      }

      // --------------------------------------------
      // SUB-CASE 2C: Forbidden (Roles Guard)
      // --------------------------------------------
      // Example: Regular user trying to access admin endpoint
      // Status: 403 - User is authenticated but lacks permissions
      if (status === HttpStatus.FORBIDDEN) {
        message = "Access Denied - You don't have the necessary access for this resource";
        code = ERROR_CODES.SYS_FORBIDDEN;  // 'SYS_11006'
        
        this.logError(exception, correlationId, status, code, request);
        
        return response.status(status).json({
          success: false,
          message,
          code,
          details: null,
          meta: {
            timestamp: new Date().toISOString(),
            path: request.url,
            correlationId,
          },
        });
      }

      // --------------------------------------------
      // SUB-CASE 2D: Generic HTTP Exception
      // --------------------------------------------
      // Any other HttpException not specifically handled above
      // Extract whatever format it has and pass through
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        message = (exceptionResponse as any).message || message;
        code = (exceptionResponse as any).code || code;
        details = (exceptionResponse as any).details;
      }
    } 
    
    // ============================================================
    // CASE 3: Prisma Database Errors
    // ============================================================
    // Prisma throws its own error objects with specific codes.
    // These are technical and not user-friendly, so we convert them
    // to our domain format before sending to client.
    // 
    // Common Prisma error codes:
    // - P2002: Unique constraint violation (duplicate email, slug, etc.)
    // - P2025: Record not found (tried to update/delete non-existent record)
    // - P2003: Foreign key violation (referenced record doesn't exist)
    else if (exception && typeof exception === 'object' && 'code' in exception) {
      const prismaError = exception as any;
      
      // --------------------------------------------
      // Prisma P2002: Unique constraint failed
      // --------------------------------------------
      // Example: Trying to register with existing email
      // Database error: "Unique constraint failed on email"
      // User-friendly: "Email already registered"
      if (prismaError.code === 'P2002') {
        status = HttpStatus.CONFLICT;  // 409
        const fields = prismaError.meta?.target?.join(', ') || 'unknown field';
        message = `Duplicate value for field: ${fields}`;
        code = ERROR_CODES.VALIDATION_FAILED;  // 'SYS_11000'
        details = prismaError.meta;
      }
      
      // --------------------------------------------
      // Prisma P2025: Record not found
      // --------------------------------------------
      // Example: updateUser where user doesn't exist
      // Database error: "Record to update not found"
      // User-friendly: "Record not found"
      else if (prismaError.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;  // 404
        message = 'Record not found';
        code = ERROR_CODES.SYS_NOT_FOUND;  // 'SYS_11008'
        details = prismaError.meta;
      }
      
      // --------------------------------------------
      // Prisma P2003: Foreign key constraint
      // --------------------------------------------
      // Example: Creating product with invalid category ID
      // Database error: "Foreign key constraint failed"
      // User-friendly: "Invalid reference: category not found"
      else if (prismaError.code === 'P2003') {
        status = HttpStatus.BAD_REQUEST;  // 400
        message = `Invalid reference: ${prismaError.meta?.field_name || 'related record not found'}`;
        code = ERROR_CODES.VALIDATION_FAILED;  // 'SYS_11000'
        details = prismaError.meta;
      }
      
      // --------------------------------------------
      // Other Prisma Errors (unknown database errors)
      // --------------------------------------------
      else {
        status = HttpStatus.INTERNAL_SERVER_ERROR;  // 500
        message = `Database error: ${prismaError.code}`;
        code = ERROR_CODES.DATABASE_ERROR;  // 'SYS_11004'
        details = prismaError.meta;
      }
    }
    
    // ============================================================
    // CASE 4: Unknown/Unhandled Errors
    // ============================================================
    // This should rarely happen in production, but catches anything
    // that fell through all the above cases.
    // 
    // Examples:
    // - Syntax errors in your code
    // - Uncaught promise rejections
    // - Third-party library crashes
    // - Any error that isn't DomainException, HttpException, or PrismaError
    else if (exception instanceof Error) {
      message = exception.message;
      // Log the full stack trace because this is unexpected
      this.logger.error(exception.stack);
    }
    // If exception is not an Error object (e.g., string literal thrown)
    // the default values at the top will be used

    // Log the error (unless it's a 404 - those are too noisy)
    this.logError(exception, correlationId, status, code, request);

    // Send the final unified error response
    response.status(status).json({
      success: false,
      message,
      code,
      details,
      meta: {
        timestamp: new Date().toISOString(),
        path: request.url,
        correlationId,
      },
    });
  }

  /**
   * Centralized error logging with severity levels
   * 
   * WHY DIFFERENT LOG LEVELS:
   * - ERROR (5xx): Server problems - need immediate attention, full stack trace
   * - WARN (4xx): Client problems - user did something wrong, no stack trace needed
   * - DEBUG (404): Not found - common, no need to clutter logs
   * 
   * This helps you focus on REAL problems in production
   * 
   * @param exception - The original error object
   * @param correlationId - Request tracking ID
   * @param status - HTTP status code (200, 404, 500, etc.)
   * @param code - Our internal error code (AUTH_1000, PROD_4000, etc.)
   * @param request - Express request object for context
   */
  private logError(
    exception: unknown,
    correlationId: string | undefined,
    status: number,
    code: string,
    request: Request,
  ) {
    // Determine severity based on status code
    const isServerError = status >= 500;    // 500-599: Our server broke
    const isNotFound = status === 404;      // 404: Resource not found (very common)
    
    // Skip logging 404s entirely - they're just missing resources
    // Without this, your logs would be flooded with 404s from bots and crawlers
    if (isNotFound) {
      return;
    }
    
    // Common log data for ALL errors (correlation ID is most important)
    const logData = {
      correlationId,    // Links this log to the specific request
      status,           // HTTP status (404, 500, etc.)
      code,             // Our error code (PROD_4000, etc.)
      path: request.url,      // Which endpoint was called
      method: request.method, // GET, POST, PUT, DELETE, etc.
      ip: request.ip,         // Client IP address (for security audits)
    };
    
    // SERVER ERRORS (5xx) - Log as ERROR with full stack trace
    // These need immediate attention from your team
    if (isServerError) {
      const errorMessage = exception instanceof Error ? exception.message : 'Server error';
      const errorStack = exception instanceof Error ? exception.stack : undefined;
      
      this.logger.error(
        `${status} - ${errorMessage}`,
        errorStack,  // Stack trace is CRITICAL for debugging server errors
        logData,
      );
    } 
    // CLIENT ERRORS (4xx) - Log as WARN without stack trace
    // These are user mistakes or auth issues - no bug in your code
    else {
      const errorMessage = exception instanceof Error ? exception.message : 'Client error';
      
      this.logger.warn(
        `${status} - ${errorMessage}`,
        logData,
      );
    }
  }
}