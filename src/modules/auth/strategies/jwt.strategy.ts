import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { PrismaService } from '../../../shared/database/prisma.service';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { EnvironmentService } from 'src/config/env/env.service';
import { ILogger } from 'src/shared/logger/logger.interface';
import { LoggerService } from 'src/shared/logger/logger.service';

/**
 * JWT STRATEGY
 *
 * Validates access tokens from cookies or Authorization header.
 *
 * TOKEN EXTRACTION PRIORITY:
 * 1. Cookie (httpOnly) - Primary for web browsers (most secure)
 * 2. Authorization header - Fallback for mobile apps (can't use cookies)
 *
 * VALIDATION PROCESS:
 * 1. Extract token from cookie or header
 * 2. Verify signature using JWT_SECRET
 * 3. Check expiration (reject expired tokens)
 * 4. Decode payload to get user ID
 * 5. Fetch user from database (ensure still exists)
 * 6. Attach user object to request.user
 *
 * SECURITY:
 * - Verifies user still exists (account might be deleted)
 * - Checks email verification status
 * - No sensitive data stored in token (only user ID)
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly logger: ILogger;

  constructor(
    private env: EnvironmentService,
    logger: LoggerService,
    private prisma: PrismaService,
  ) {
    // Get secret with fallback and ensure it's not undefined
    const jwtSecret = env.get('JWT_SECRET');

    if (!jwtSecret) {
      throw new Error('JWT_SECRET is not defined in environment variables');
    }
    super({
      // Custom token extractor that checks cookies first, then headers
      jwtFromRequest: ExtractJwt.fromExtractors([
        // Extractor 1: Cookie (primary for web)
        (request: Request) => {
          let token: string | null = null;

          if (request?.cookies) {
            token = request.cookies['accessToken'];
            if (token) {
              this.logger.debug('✅ Token extracted from cookie');
            }
          }
          return token;
        },
        // Extractor 2: Authorization header (fallback for mobile)
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false, // Reject expired tokens (don't ignore)
      secretOrKey: jwtSecret,
    });
    this.logger = logger.child(JwtStrategy.name);
  }

  /**
   * Validate JWT payload and return user object
   *
   * @param payload - Decoded JWT payload (contains user ID, email, role)
   * @returns User object (attached to request.user)
   *
   * WHY FETCH USER FROM DATABASE:
   * - User might have been deleted after token was issued
   * - User role might have changed
   * - Email verification status might have changed
   * - Token doesn't contain this dynamic data
   */
  async validate(payload: JwtPayload) {
    this.logger.debug(`Validating JWT for user ID: ${payload.sub}`);

    // Fetch fresh user data from database
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        firstName: true,
        lastName: true,
        avatar: true,
        isEmailVerified: true,
      },
    });

    // User no longer exists (account deleted)
    if (!user) {
      this.logger.warn(`User not found for ID: ${payload.sub}`);
      throw new UnauthorizedException('User no longer exists');
    }

    // Email not verified - prevent access to protected routes
    if (!user.isEmailVerified) {
      this.logger.warn(`Unverified email attempted access: ${user.email}`);
      throw new UnauthorizedException(
        'Please verify your email before accessing this resource',
      );
    }

    this.logger.debug(
      `JWT validated successfully for: ${user.email} (role: ${user.role})`,
    );

    // Return user object - attaches to request.user automatically
    return user;
  }
}
