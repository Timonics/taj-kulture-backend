import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { PrismaService } from '../../../shared/database/prisma.service';
import { RefreshTokenPayload } from '../interfaces/jwt-payload.interface';
import { EnvironmentService } from 'src/config/env/env.service';
import { ILogger } from 'src/shared/logger/logger.interface';
import { LoggerService } from 'src/shared/logger/logger.service';

/**
 * REFRESH TOKEN STRATEGY
 *
 * Validates refresh tokens for the /auth/refresh endpoint.
 *
 * KEY DIFFERENCES FROM JWT Strategy:
 * - Uses REFRESH_SECRET instead of JWT_SECRET
 * - Longer expiration (30 days vs 15 min)
 * - Validates token exists in database (revocation check)
 * - Returns user AND token for rotation
 *
 * REFRESH TOKEN ROTATION:
 * - Each refresh request generates a NEW refresh token
 * - Old refresh token is invalidated (one-time use)
 * - Prevents token replay attacks
 */
@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  private readonly logger: ILogger;

  constructor(
    private env: EnvironmentService,
    logger: LoggerService,
    private prisma: PrismaService,
  ) {
    // Get secret with fallback and ensure it's not undefined
    const refreshSecret = env.get('JWT_SECRET');

    if (!refreshSecret) {
      throw new Error('JWT_SECRET is not defined in environment variables');
    }
    super({
      // Extract refresh token from cookie only (more secure)
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => {
          const token = request?.cookies?.['refreshToken'];
          if (token) {
            this.logger.debug('✅ Refresh token extracted from cookie');
          } else {
            this.logger.warn('❌ No refresh token found in cookies');
          }
          return token;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: refreshSecret,
    });
    this.logger = logger.child(RefreshTokenStrategy.name);
  }

  /**
   * Validate refresh token payload
   *
   * @param payload - Decoded refresh token payload
   * @returns User object with token for rotation
   */
  async validate(payload: RefreshTokenPayload) {
    this.logger.debug(`Validating refresh token for user ID: ${payload.sub}`);

    // Fetch user from database
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        refreshToken: true, // Need to check if token matches stored one
      },
    });

    // User no longer exists
    if (!user) {
      this.logger.warn(`User not found for refresh token: ${payload.sub}`);
      throw new UnauthorizedException('User no longer exists');
    }

    // Verify the refresh token matches what's stored in database
    // This prevents using a token after it's been rotated
    const requestToken = this.getRequestToken();
    if (user.refreshToken !== requestToken) {
      this.logger.warn(`Refresh token mismatch for user: ${user.email}`);
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    this.logger.debug(`Refresh token validated for user: ${user.email}`);

    // Return user with role for token generation
    return {
      id: user.id,
      email: user.email,
      role: user.role,
    };
  }

  /**
   * Get the raw refresh token from the current request
   * Used for comparing with stored token in database
   */
  private getRequestToken(): string | null {
    const request = this.getRequest();
    return request?.cookies?.['refreshToken'] || null;
  }

  /**
   * Get the current request from context (called by passport)
   */
  private getRequest(): Request | null {
    // This is called during validation - passport stores context
    return (this as any)._request || null;
  }
}
