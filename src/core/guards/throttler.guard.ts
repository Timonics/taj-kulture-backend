
import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';

/**
 * CUSTOM THROTTLER GUARD
 * 
 * Rate limiting to prevent brute force attacks and API abuse.
 * 
 * IMPORTANT: This is DIFFERENT from the rate limiting in LocalStrategy
 * - LocalStrategy rate limiting: Only for login attempts (5 attempts/60 sec)
 * - ThrottlerGuard: Global API rate limiting (100 requests/60 sec per IP)
 * 
 * Two different protections for different purposes:
 * 1. Login rate limiting: Prevents password brute force
 * 2. API rate limiting: Prevents DDoS and API abuse
 * 
 * @example
 * -@UseGuards(CustomThrottlerGuard)
 * -@Post('sensitive-endpoint')
 * -async sensitiveEndpoint() { ... }
 */
@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  /**
   * Get unique tracker for rate limiting
   * 
   * Combines IP and user ID (if authenticated) for better tracking
   * - Unauthenticated: Track by IP only
   * - Authenticated: Track by user ID (more accurate)
   * 
   * @param context - Execution context with request
   * @returns Unique identifier for rate limit tracking
   */
  protected async getTracker(context: ExecutionContext): Promise<string> {
    const request = context.switchToHttp().getRequest<Request>();
    
    // Try to get user ID from authenticated user
    const userId = (request.user as any)?.id;
    
    if (userId) {
      // Authenticated user - track by user ID (more accurate)
      return `user:${userId}`;
    }
    
    // Unauthenticated - track by IP address
    const ip = request.ips.length ? request.ips[0] : request.ip;
    return `ip:${ip}`;
  }

  /**
   * Custom error message when rate limit exceeded
   */
  protected async throwThrottlingException(context: ExecutionContext): Promise<void> {
    const tracker = await this.getTracker(context);
    
    throw new Error(`Too many requests from ${tracker}. Please try again later.`);
  }
}