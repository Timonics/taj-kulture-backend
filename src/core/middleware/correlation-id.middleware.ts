import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * Correlation ID Middleware
 * 
 * Purpose: Generate or propagate a unique identifier for each request
 * 
 * Why correlation IDs?
 * - Trace a single request across multiple services
 * - Correlate logs from different components
 * - Debug production issues by following the request trail
 * 
 * How it works:
 * 1. Check if request already has a correlation ID (from API Gateway or client)
 * 2. If not, generate a new UUID v4
 * 3. Store in request object for use in controllers/services
 * 4. Add to response headers so client can use it for debugging
 * 
 * Example workflow:
 *   Client request (no correlation ID)
 *   -> Middleware generates: "abc-123"
 *   -> Logged in controller: "Processing order [abc-123]"
 *   -> Response header: X-Correlation-ID: abc-123
 *   -> Client can now use this ID when reporting issues
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  /**
   * Express middleware function
   * 
   * @param req - Express request object (extended with correlationId)
   * @param res - Express response object
   * @param next - Next middleware function
   */
  use(req: Request, res: Response, next: NextFunction): void {
    // Priority 1: Check if correlation ID was passed in request header
    // This allows distributed tracing across microservices
    const existingCorrelationId = req.headers['x-correlation-id'] as string;
    
    // Priority 2: Check if we have a request ID from the client
    const requestId = req.headers['x-request-id'] as string;
    
    // Priority 3: Generate a new UUID if neither exists
    // UUID v4 is statistically unique - safe for production use
    const correlationId = existingCorrelationId || requestId || uuidv4();
    
    // Store correlation ID in request object for easy access in controllers
    // Use a Symbol to avoid property name collisions
    req['correlationId'] = correlationId;
    
    // Add correlation ID to response headers
    // This allows clients to include it in bug reports or follow-up requests
    res.setHeader('x-correlation-id', correlationId);
    
    // Also set as a standard header for API gateways and load balancers
    res.setHeader('X-Request-Id', correlationId);
    
    // Proceed to the next middleware/controller
    next();
  }
}