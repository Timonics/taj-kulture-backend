import { Injectable, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../../../core/decorators/public.decorator';
import { ERROR_CODES } from '../../../core/constants/error-codes.constants';


/**
 * JWT AUTH GUARD
 * 
 * Protects routes by requiring a valid JWT access token.
 * 
 * HOW IT WORKS:
 * 1. Extracts JWT from cookie or Authorization header
 * 2. Validates token signature and expiration
 * 3. Attaches user object to request.user
 * 4. Throws UnauthorizedException if token invalid/missing
 * 
 * EXCEPTIONS:
 * - Routes decorated with @Public() bypass this guard
 * 
 * TOKEN LOCATION PRIORITY:
 * 1. Cookie (primary - web browsers)
 * 2. Authorization header (fallback - mobile apps)
 * 
 * SECURITY:
 * - HttpOnly cookies prevent XSS attacks
 * - Token validation includes user existence check
 * - Email verification required (unless bypassed)
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(private reflector: Reflector) {
    super();
  }

  /**
   * Determines if the route can be activated
   * 
   * @param context - Execution context containing route handler and request
   * @returns boolean or Promise<boolean>
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Public routes bypass authentication entirely
    if (isPublic) {
      this.logger.debug('Public route accessed - skipping authentication');
      return true;
    }

    // For protected routes, validate the JWT token
    try {
      const result = await super.canActivate(context);
      return result as boolean;
    } catch (error) {
      this.logger.error(`JWT validation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Handles errors during JWT validation
   * 
   * @param err - Error from passport strategy
   * @param user - User object if validation succeeded
   * @param info - Additional info from passport (contains token expiration details)
   * @returns User object or throws exception
   */
  handleRequest(err: any, user: any, info: any): any {
    // Token expired - specific error with helpful message
    if (info?.name === 'TokenExpiredError') {
      this.logger.warn('Access token expired');
      throw new UnauthorizedException({
        message: 'Access token has expired',
        code: ERROR_CODES.TOKEN_EXPIRED,
        details: { expiredAt: info.expiredAt },
      });
    }

    // Invalid token format or signature
    if (info?.name === 'JsonWebTokenError') {
      this.logger.warn('Invalid access token format or signature');
      throw new UnauthorizedException({
        message: 'Invalid access token',
        code: ERROR_CODES.INVALID_TOKEN,
      });
    }

    // No token provided
    if (err || !user) {
      this.logger.warn('No valid access token provided');
      throw err || new UnauthorizedException({
        message: 'Authentication required',
        code: ERROR_CODES.UNAUTHORIZED,
      });
    }

    // Email not verified - prevent access
    if (user && !user.isEmailVerified) {
      this.logger.warn(`Unverified email attempted access: ${user.email}`);
      throw new UnauthorizedException({
        message: 'Please verify your email address before accessing this resource',
        code: ERROR_CODES.EMAIL_NOT_VERIFIED,
      });
    }

    this.logger.debug(`User authenticated: ${user.email} (${user.role})`);
    return user;
  }
}