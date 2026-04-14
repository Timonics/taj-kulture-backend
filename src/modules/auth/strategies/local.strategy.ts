import { Injectable, Logger, Inject } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../../shared/database/prisma.service';
import {
  RateLimitExceededException,
  UnauthorizedException,
} from '../../../core/exceptions';
import { ICacheService } from '../../../shared/cache/cache.interface';
import { CACHE_KEYS } from '../../../core/constants/app.constants';
import { User } from 'generated/prisma/client';
import { ILogger } from 'src/shared/logger/logger.interface';
import { LoggerService } from 'src/shared/logger/logger.service';

/**
 * LOCAL STRATEGY
 *
 * Validates email/password credentials for login.
 *
 * HOW IT WORKS:
 * 1. Extracts email and password from request body
 * 2. Validates user exists and password matches
 * 3. Returns user object (passport attaches to request)
 * 4. Throws UnauthorizedException if validation fails
 *
 * RATE LIMITING:
 * - Tracks login attempts per email in Redis
 * - Blocks after 5 failed attempts for 60 seconds
 * - Resets on successful login
 *
 * SECURITY:
 * - Uses bcrypt for password comparison (not plain text)
 * - Rate limiting prevents brute force attacks
 * - Generic error messages (don't reveal if email exists)
 */
@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, 'local') {
  private readonly logger: ILogger;

  constructor(
    private prisma: PrismaService,
    logger: LoggerService,
    @Inject('CACHE_SERVICE') private cache: ICacheService,
  ) {
    // Tell passport to look for 'email' field instead of default 'username'
    super({ usernameField: 'email' });
    this.logger = logger.child(LocalStrategy.name);
  }

  /**
   * Validate user credentials
   *
   * @param email - User's email address
   * @param password - User's password (plain text)
   * @returns User object (without password) if valid
   * @throws RateLimitExceededException - Too many failed attempts
   * @throws UnauthorizedException - Invalid credentials
   */
  async validate(
    email: string,
    password: string,
  ): Promise<Omit<User, 'password'>> {
    const normalizedEmail = email.toLowerCase().trim();
    const cacheKey = CACHE_KEYS.USER_LOGIN_ATTEMPTS(normalizedEmail);

    // ============================================================
    // RATE LIMITING - Prevent brute force attacks
    // ============================================================
    // Track failed attempts in Redis with 60 second TTL
    const attempts = await this.cache.increment(cacheKey, 1);

    // Set expiration on first attempt (60 seconds)
    if (attempts === 1) {
      await this.cache.expire(cacheKey, 60);
    }

    this.logger.debug(
      `Login attempt ${attempts}/5 for email: ${normalizedEmail}`,
    );

    // Block after 5 failed attempts
    if (attempts > 5) {
      const remainingTtl = (await this.cache.getTTL(cacheKey)) || 60;
      this.logger.warn(`Rate limit exceeded for email: ${normalizedEmail}`);

      throw new RateLimitExceededException(
        `Too many login attempts. Try again in ${remainingTtl} seconds.`,
      );
    }

    // ============================================================
    // FIND USER BY EMAIL
    // ============================================================
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // User not found - use generic message (don't reveal email existence)
    if (!user) {
      this.logger.debug(`Login failed - user not found: ${normalizedEmail}`);
      throw new UnauthorizedException('Invalid email or password');
    }

    // ============================================================
    // PASSWORD VALIDATION
    // ============================================================
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      this.logger.debug(
        `Login failed - invalid password for: ${normalizedEmail}`,
      );
      throw new UnauthorizedException('Invalid email or password');
    }

    // ============================================================
    // SUCCESS - Clear rate limit counter
    // ============================================================
    await this.cache.delete(cacheKey);

    this.logger.debug(`Login successful for: ${normalizedEmail}`);

    // Return user without password (passport attaches to request.user)
    const { password: _, ...result } = user;
    return result;
  }
}
