import {
  Injectable,
//   ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ERROR_CODES } from '../../../core/constants/error-codes.constants';

/**
 * REFRESH AUTH GUARD
 *
 * Special guard for refresh token endpoint.
 *
 * WHY SEPARATE FROM JwtAuthGuard:
 * - Uses REFRESH_SECRET instead of JWT_SECRET
 * - Longer expiration time (30 days vs 15 min)
 * - Different error handling
 * - Can include additional claims (deviceId, version)
 *
 * USAGE: Only used on /auth/refresh endpoint
 */
@Injectable()
export class RefreshAuthGuard extends AuthGuard('jwt-refresh') {
  private readonly logger = new Logger(RefreshAuthGuard.name);

  handleRequest(err: any, user: any, info: any): any {
    // Refresh token expired - user must login again
    if (info?.name === 'TokenExpiredError') {
      this.logger.warn('Refresh token expired - user must re-authenticate');
      throw new UnauthorizedException({
        message: 'Refresh token has expired. Please login again.',
        code: ERROR_CODES.REFRESH_TOKEN_EXPIRED,
      });
    }

    // Invalid refresh token format
    if (info?.name === 'JsonWebTokenError') {
      this.logger.warn('Invalid refresh token format');
      throw new UnauthorizedException({
        message: 'Invalid refresh token',
        code: ERROR_CODES.REFRESH_TOKEN_INVALID,
      });
    }

    // No refresh token or other error
    if (err || !user) {
      this.logger.warn('Refresh token validation failed');
      throw (
        err ||
        new UnauthorizedException({
          message: 'Valid refresh token required',
          code: ERROR_CODES.REFRESH_TOKEN_INVALID,
        })
      );
    }

    this.logger.debug(`Refresh token validated for user: ${user.email}`);
    return user;
  }
}
