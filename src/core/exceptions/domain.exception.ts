import { HttpException, HttpStatus } from '@nestjs/common';
import { ERROR_CODES, ErrorCode } from '../constants/error-codes.constants';
import { RequestContext } from '../context/request-context';

/**
 * Domain Exception - Enhanced BusinessException
 * 
 * This replaces your BusinessException class with more features while
 * maintaining backward compatibility with your existing code.
 * 
 * KEY FEATURES:
 * 1. Auto-injects correlation ID for request tracing
 * 2. Supports both new and legacy error codes
 * 3. Adds timestamp, path, and other metadata
 * 4. Helper methods for error categorization
 */
export class DomainException extends HttpException {
  public readonly code: string;
  public readonly correlationId?: string;
  public readonly details?: any;
  public readonly timestamp: string;

  constructor(
    message: string,
    code: ErrorCode | string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    details?: any,
  ) {
    // Auto-inject correlation ID from request context if available
    const correlationId = RequestContext.getCorrelationId();
    
    // Build consistent error response (matches your existing structure)
    const errorResponse = {
      message,
      code: code,  // Your existing format uses 'code', not 'error.code'
      details,
      correlationId,
      timestamp: new Date().toISOString(),
    };
    
    super(errorResponse, status);
    
    this.code = code;
    this.correlationId = correlationId;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }

  /**
   * Helper to check if this is a specific error type
   * Useful for frontend error handling
   * 
   * Example: if (exception.isCode(ERROR_CODES.PRODUCT_OUT_OF_STOCK)) {...}
   */
  isCode(expectedCode: ErrorCode): boolean {
    return this.code === expectedCode;
  }

  /**
   * Helper to check error category (e.g., 'AUTH', 'USER', 'PROD')
   * 
   * Example: if (exception.getCategory() === 'PROD') {...}
   */
  getCategory(): string {
    return this.code.split('_')[0];
  }

  /**
   * Helper to get numeric part of error code
   */
  getCodeNumber(): number {
    const parts = this.code.split('_');
    return parseInt(parts[1], 10);
  }
}

// Alias for backward compatibility (your existing BusinessException imports still work)
export { DomainException as BusinessException };