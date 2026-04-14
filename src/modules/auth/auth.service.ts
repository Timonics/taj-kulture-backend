import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  Logger,
  Inject,
} from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { addDays } from 'date-fns';
import { PrismaService } from '../../shared/database/prisma.service';
import { EventBus } from '../../shared/events/event-bus.service';
import { ICacheService } from '../../shared/cache/cache.interface';
import { RegisterRequestDto, LoginRequestDto } from './dto/requests';
import { UserResponseDto } from './dto/responses';
import {
  UserNotFoundException,
  InvalidCredentialsException,
  EmailConflictException,
  UsernameConflictException,
  EmailNotVerifiedException,
  TokenExpiredException,
  InvalidTokenException,
} from '../../core/exceptions';
import { USER_EVENTS } from '../../shared/events/event-types';
import { CACHE_KEYS } from '../../core/constants/app.constants';
import { ILogger } from 'src/shared/logger/logger.interface';
import { LoggerService } from 'src/shared/logger/logger.service';
import { EnvironmentService } from 'src/config/env/env.service';

// Token response interface (internal use only - not exposed to client)
interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * AUTH SERVICE
 *
 * Core authentication logic including registration, login, token management,
 * email verification, and password reset flows.
 *
 * SECURITY FEATURES:
 * - Passwords hashed with bcrypt (10 rounds)
 * - Refresh token rotation (one-time use)
 * - Rate limiting on login attempts
 * - Email verification required for protected routes
 * - Tokens stored as HttpOnly cookies (not returned in responses)
 *
 * EVENT-DRIVEN:
 * - Emits events for side effects (email sending, notifications)
 * - Decouples auth logic from email/notification services
 */
@Injectable()
export class AuthService {
  private readonly logger: ILogger;

  constructor(
    private prisma: PrismaService,
    logger: LoggerService,
    private env: EnvironmentService,
    private eventBus: EventBus,
    private jwtService: JwtService,
    @Inject('CACHE_SERVICE') private cache: ICacheService,
  ) {
    this.logger = logger.child(AuthService.name);
  }

  // ============================================================
  // PUBLIC METHODS - Used by Controller
  // ============================================================

  /**
   * Register a new user
   *
   * @param registerDto - User registration data
   * @returns User object and tokens (tokens also set as cookies via controller)
   *
   * FLOW:
   * 1. Check if email already exists
   * 2. Check if username already exists
   * 3. Hash password with bcrypt
   * 4. Create user in database
   * 5. Generate email verification token
   * 6. Emit event to send verification email
   * 7. Generate access and refresh tokens
   * 8. Return user with tokens
   */
  async register(
    registerDto: RegisterRequestDto,
  ): Promise<{ user: UserResponseDto; tokens: TokenPair }> {
    const { email, username, password, firstName, lastName } = registerDto;
    const normalizedEmail = email.toLowerCase().trim();
    const normalizedUsername = username.toLowerCase().trim();

    this.logger.debug(`Registration attempt for email: ${normalizedEmail}`);

    // ============================================================
    // CHECK FOR EXISTING USER
    // ============================================================
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: normalizedEmail }, { username: normalizedUsername }],
      },
    });

    if (existingUser) {
      if (existingUser.email === normalizedEmail) {
        this.logger.debug(
          `Registration failed - email already exists: ${normalizedEmail}`,
        );
        throw new EmailConflictException(normalizedEmail);
      }
      if (existingUser.username === normalizedUsername) {
        this.logger.debug(
          `Registration failed - username already exists: ${normalizedUsername}`,
        );
        throw new UsernameConflictException(normalizedUsername);
      }
    }

    // ============================================================
    // HASH PASSWORD
    // ============================================================
    const saltRounds = this.env.get('BCRYPT_ROUNDS') || 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // ============================================================
    // CREATE USER
    // ============================================================
    const user = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        username: normalizedUsername,
        password: hashedPassword,
        firstName: firstName || null,
        lastName: lastName || null,
        role: 'CUSTOMER',
        isEmailVerified: false,
      },
    });

    this.logger.debug(`User created successfully: ${user.id} (${user.email})`);

    // ============================================================
    // GENERATE EMAIL VERIFICATION TOKEN
    // ============================================================
    const verificationToken = this.generateEmailVerificationToken(user);
    const verificationExpires = addDays(new Date(), 1);

    // Store verification token in database
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken: verificationToken,
        emailVerificationExpires: verificationExpires,
      },
    });

    // ============================================================
    // EMIT EVENT FOR VERIFICATION EMAIL
    // ============================================================
    // This is handled asynchronously by an event listener
    this.eventBus.emit({
      name: USER_EVENTS.REGISTERED,
      payload: {
        userId: user.id,
        email: user.email,
        name: user.firstName || user.username,
        verificationToken,
        registrationMethod: 'email',
      },
    });

    this.logger.debug(`Verification email event emitted for: ${user.email}`);

    // ============================================================
    // GENERATE TOKENS
    // ============================================================
    const tokens = await this.generateTokenPair(user);

    // ============================================================
    // RETURN USER (WITHOUT PASSWORD)
    // ============================================================
    const { password: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword as UserResponseDto,
      tokens,
    };
  }

  /**
   * Authenticate user with email and password
   *
   * @param loginDto - User login credentials
   * @returns User object and tokens (tokens also set as cookies via controller)
   *
   * FLOW:
   * 1. Find user by email
   * 2. Verify password with bcrypt
   * 3. Check if email is verified
   * 4. Generate new tokens
   * 5. Store refresh token in database
   * 6. Clear rate limiting cache on success
   */
  async login(
    loginDto: LoginRequestDto,
  ): Promise<{ user: UserResponseDto; tokens: TokenPair }> {
    const { email, password } = loginDto;
    const normalizedEmail = email.toLowerCase().trim();

    this.logger.debug(`Login attempt for email: ${normalizedEmail}`);

    // ============================================================
    // FIND USER BY EMAIL
    // ============================================================
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      this.logger.debug(`Login failed - user not found: ${normalizedEmail}`);
      throw new InvalidCredentialsException();
    }

    // ============================================================
    // VERIFY PASSWORD
    // ============================================================
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      this.logger.debug(
        `Login failed - invalid password for: ${normalizedEmail}`,
      );
      throw new InvalidCredentialsException();
    }

    // ============================================================
    // CHECK EMAIL VERIFICATION
    // ============================================================
    if (!user.isEmailVerified) {
      this.logger.debug(
        `Login failed - email not verified: ${normalizedEmail}`,
      );
      throw new EmailNotVerifiedException(normalizedEmail);
    }

    // ============================================================
    // CLEAR RATE LIMITING CACHE
    // ============================================================
    const rateLimitKey = CACHE_KEYS.USER_LOGIN_ATTEMPTS(normalizedEmail);
    await this.cache.delete(rateLimitKey).catch(() => {
      this.logger.warn(`Failed to clear rate limit for: ${normalizedEmail}`);
    });

    // ============================================================
    // GENERATE TOKENS
    // ============================================================
    const tokens = await this.generateTokenPair(user);

    this.logger.debug(`Login successful for: ${user.email}`);

    // ============================================================
    // RETURN USER (WITHOUT PASSWORD)
    // ============================================================
    const { password: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword as UserResponseDto,
      tokens,
    };
  }

  /**
   * Refresh access token using refresh token
   *
   * @param refreshToken - The refresh token from cookie
   * @returns New token pair (old refresh token is invalidated - rotation)
   *
   * SECURITY: Refresh token rotation
   * - Each refresh request generates a NEW refresh token
   * - Old refresh token is invalidated (one-time use)
   * - Prevents token replay attacks
   */
  async refreshTokens(refreshToken: string): Promise<TokenPair> {
    this.logger.debug('Refresh token rotation requested');

    try {
      // ============================================================
      // VERIFY REFRESH TOKEN
      // ============================================================
      const refreshSecret = this.env.get('JWT_REFRESH_SECRET');

      if (!refreshSecret) {
        throw new Error('JWT_REFRESH_SECRET not configured');
      }

      const payload = this.jwtService.verify(refreshToken, {
        secret: refreshSecret,
      });

      // ============================================================
      // FIND USER WITH THIS REFRESH TOKEN
      // ============================================================
      const user = await this.prisma.user.findFirst({
        where: {
          id: payload.sub,
          refreshToken: refreshToken, // Must match stored token
        },
      });

      if (!user) {
        this.logger.warn(
          `Refresh token mismatch or user not found: ${payload.sub}`,
        );
        throw new UnauthorizedException('Invalid refresh token');
      }

      // ============================================================
      // GENERATE NEW TOKENS (ROTATION)
      // ============================================================
      const newTokens = await this.generateTokenPair(user);

      this.logger.debug(`Tokens refreshed for user: ${user.email}`);

      return newTokens;
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        this.logger.warn('Refresh token expired');
        throw new TokenExpiredException('refresh');
      }
      if (error.name === 'JsonWebTokenError') {
        this.logger.warn('Invalid refresh token format');
        throw new InvalidTokenException('Refresh token is malformed');
      }

      this.logger.error(`Refresh token error: ${error.message}`);
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  /**
   * Logout user - invalidate refresh token
   *
   * @param userId - ID of user to logout
   *
   * FLOW:
   * 1. Clear refresh token from database
   * 2. Controller will clear cookies
   */
  async logout(userId: string): Promise<void> {
    this.logger.debug(`Logout requested for user: ${userId}`);

    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });

    this.logger.debug(`User logged out: ${userId}`);
  }

  /**
   * Verify email address with token
   *
   * @param token - Email verification token from email link
   * @returns Success message
   *
   * FLOW:
   * 1. Verify JWT token
   * 2. Check token purpose is 'email-verification'
   * 3. Find user with matching token and not expired
   * 4. Mark email as verified
   * 5. Clear verification token from database
   */
  async verifyEmail(token: string): Promise<void> {
    this.logger.debug('Email verification attempted');

    try {
      const jwtSecret = this.env.get('JWT_SECRET');

      if (!jwtSecret) {
        throw new Error('JWT_SECRET not configured');
      }

      // Verify token
      const payload = this.jwtService.verify(token, {
        secret: jwtSecret,
      });

      // Check token purpose
      if (payload.purpose !== 'email-verification') {
        this.logger.warn('Invalid token purpose for email verification');
        throw new BadRequestException('Invalid verification token');
      }

      // Find user with this token (not expired)
      const user = await this.prisma.user.findFirst({
        where: {
          email: payload.email,
          emailVerificationToken: token,
          emailVerificationExpires: { gt: new Date() },
        },
      });

      if (!user) {
        this.logger.warn(
          `Email verification failed - user not found or token expired for: ${payload.email}`,
        );
        throw new BadRequestException('Invalid or expired verification token');
      }

      // Mark email as verified and clear token
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          isEmailVerified: true,
          emailVerificationToken: null,
          emailVerificationExpires: null,
        },
      });

      this.logger.debug(`Email verified successfully for: ${user.email}`);

      // Emit event for welcome email
      this.eventBus.emit({
        name: USER_EVENTS.VERIFIED,
        payload: {
          userId: user.id,
          email: user.email,
          name: user.firstName || user.username,
          verifiedAt: new Date(),
        },
      });
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        this.logger.warn('Email verification token expired');
        throw new BadRequestException(
          'Verification token has expired. Please request a new one.',
        );
      }
      if (error.name === 'JsonWebTokenError') {
        this.logger.warn('Invalid email verification token format');
        throw new BadRequestException('Invalid verification token');
      }

      throw error;
    }
  }

  /**
   * Resend verification email
   *
   * @param email - User's email address
   *
   * FLOW:
   * 1. Find user by email
   * 2. Check if email is already verified
   * 3. Generate new verification token
   * 4. Store token in database
   * 5. Emit event to send email
   */
  async resendVerificationEmail(email: string): Promise<void> {
    const normalizedEmail = email.toLowerCase().trim();
    this.logger.debug(`Resend verification requested for: ${normalizedEmail}`);

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      // Don't reveal that email doesn't exist (security)
      this.logger.debug(
        `Resend verification - email not found: ${normalizedEmail}`,
      );
      return;
    }

    if (user.isEmailVerified) {
      this.logger.debug(
        `Resend verification - email already verified: ${normalizedEmail}`,
      );
      throw new BadRequestException('Email is already verified');
    }

    // Generate new verification token
    const verificationToken = this.generateEmailVerificationToken(user);
    const verificationExpires = addDays(new Date(), 1);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken: verificationToken,
        emailVerificationExpires: verificationExpires,
      },
    });

    // Emit event to send email
    this.eventBus.emit({
      name: USER_EVENTS.REGISTERED,
      payload: {
        userId: user.id,
        email: user.email,
        name: user.firstName || user.username,
        verificationToken,
        registrationMethod: 'email-resend',
      },
    });

    this.logger.debug(`Verification email resent to: ${user.email}`);
  }

  /**
   * Initiate password reset - send reset email
   *
   * @param email - User's email address
   *
   * FLOW:
   * 1. Find user by email (don't reveal if not found)
   * 2. Generate password reset token
   * 3. Store token in database
   * 4. Emit event to send reset email
   */
  async forgotPassword(email: string): Promise<void> {
    const normalizedEmail = email.toLowerCase().trim();
    this.logger.debug(`Password reset requested for: ${normalizedEmail}`);

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // Don't reveal that email doesn't exist (security)
    if (!user) {
      this.logger.debug(`Password reset - email not found: ${normalizedEmail}`);
      return;
    }

    // Generate password reset token
    const resetToken = this.generatePasswordResetToken(user);
    const resetExpires = addDays(new Date(), 1); // 24 hours

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires,
      },
    });

    // Emit event to send reset email
    this.eventBus.emit({
      name: USER_EVENTS.PASSWORD_RESET_REQUESTED,
      payload: {
        userId: user.id,
        email: user.email,
        name: user.firstName || user.username,
        resetToken,
        expiresAt: resetExpires,
      },
    });

    this.logger.debug(`Password reset email sent to: ${user.email}`);
  }

  /**
   * Reset password using token
   *
   * @param token - Password reset token from email
   * @param newPassword - New password to set
   *
   * FLOW:
   * 1. Verify JWT token
   * 2. Check token purpose is 'password-reset'
   * 3. Find user with matching token and not expired
   * 4. Hash new password
   * 5. Update user password
   * 6. Clear reset token and invalidate refresh tokens
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    this.logger.debug('Password reset attempted');

    try {
      const jwtSecret = this.env.get('JWT_SECRET');

      if (!jwtSecret) {
        throw new Error('JWT_SECRET not configured');
      }

      // Verify token
      const payload = this.jwtService.verify(token, {
        secret: jwtSecret,
      });

      // Check token purpose
      if (payload.purpose !== 'password-reset') {
        this.logger.warn('Invalid token purpose for password reset');
        throw new BadRequestException('Invalid reset token');
      }

      // Find user with this token (not expired)
      const user = await this.prisma.user.findFirst({
        where: {
          email: payload.email,
          passwordResetToken: token,
          passwordResetExpires: { gt: new Date() },
        },
      });

      if (!user) {
        this.logger.warn(
          `Password reset failed - user not found or token expired for: ${payload.email}`,
        );
        throw new BadRequestException('Invalid or expired reset token');
      }

      // Hash new password
      const saltRounds = this.env.get('BCRYPT_ROUNDS') || 10;
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

      // Update user password and clear reset token
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          passwordResetToken: null,
          passwordResetExpires: null,
          refreshToken: null, // Invalidate all sessions
        },
      });

      this.logger.debug(`Password reset successful for: ${user.email}`);

      // Emit event for password changed notification
      this.eventBus.emit({
        name: USER_EVENTS.PASSWORD_CHANGED,
        payload: {
          userId: user.id,
          changedAt: new Date(),
        },
      });
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        this.logger.warn('Password reset token expired');
        throw new BadRequestException(
          'Reset token has expired. Please request a new one.',
        );
      }
      if (error.name === 'JsonWebTokenError') {
        this.logger.warn('Invalid password reset token format');
        throw new BadRequestException('Invalid reset token');
      }

      throw error;
    }
  }

  /**
   * Change password for authenticated user
   *
   * @param userId - ID of authenticated user
   * @param currentPassword - User's current password
   * @param newPassword - New password to set
   *
   * FLOW:
   * 1. Find user by ID
   * 2. Verify current password
   * 3. Hash new password
   * 4. Update password
   * 5. Invalidate refresh tokens (force re-login)
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    this.logger.debug(`Password change requested for user: ${userId}`);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UserNotFoundException(userId);
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password,
    );

    if (!isPasswordValid) {
      this.logger.warn(
        `Password change failed - incorrect current password for user: ${userId}`,
      );
      throw new InvalidCredentialsException('Current password is incorrect');
    }

    // Hash new password
    const saltRounds = this.env.get('BCRYPT_ROUNDS') || 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password and invalidate refresh tokens
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        refreshToken: null, // Force re-login on all devices
      },
    });

    this.logger.debug(`Password changed successfully for user: ${userId}`);

    // Emit event for password changed notification
    this.eventBus.emit({
      name: USER_EVENTS.PASSWORD_CHANGED,
      payload: {
        userId: user.id,
        changedAt: new Date(),
      },
    });
  }

  // ============================================================
  // PRIVATE HELPER METHODS
  // ============================================================

  /**
   * Generate JWT token pair (access + refresh)
   *
   * @param user - User object from database
   * @returns Access token, refresh token, and expiration
   *
   * TOKEN DIFFERENCES:
   * - Access Token: Short-lived (15 min), used for API auth
   * - Refresh Token: Long-lived (30 days), used to get new access tokens
   * - Different secrets for security isolation
   */
  private async generateTokenPair(user: any): Promise<TokenPair> {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    // Get configuration values with fallbacks
    const jwtSecret = this.env.get('JWT_SECRET');
    const jwtExpiresIn = this.env.get('JWT_EXPIRES_IN') || '15m';
    const refreshSecret = this.env.get('JWT_REFRESH_SECRET');
    const refreshExpiresIn = this.env.get('JWT_REFRESH_EXPIRES_IN') || '30d';

    if (!jwtSecret || !refreshSecret) {
      throw new Error('JWT secrets not configured');
    }

    // Generate access token (short-lived)
    const accessToken = this.jwtService.sign(payload, {
      secret: jwtSecret,
      expiresIn: jwtExpiresIn,
    } as JwtSignOptions);

    // Generate refresh token (long-lived)
    const refreshToken = this.jwtService.sign(payload, {
      secret: refreshSecret,
      expiresIn: refreshExpiresIn,
    } as JwtSignOptions);

    // Store refresh token in database for validation and revocation
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken },
    });

    // Calculate expiration time in seconds
    const decoded = this.jwtService.decode(accessToken) as any;
    const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);

    return {
      accessToken,
      refreshToken,
      expiresIn,
    };
  }

  /**
   * Generate email verification token
   *
   * @param user - User object
   * @returns JWT token for email verification
   */
  private generateEmailVerificationToken(user: any): string {
    const jwtSecret = this.env.get('JWT_SECRET');

    if (!jwtSecret) {
      throw new Error('JWT_SECRET not configured');
    }

    return this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        purpose: 'email-verification',
      },
      {
        secret: jwtSecret,
        expiresIn: '24h',
      },
    );
  }

  /**
   * Generate password reset token
   *
   * @param user - User object
   * @returns JWT token for password reset
   */
  private generatePasswordResetToken(user: any): string {
    const jwtSecret = this.env.get('JWT_SECRET');

    if (!jwtSecret) {
      throw new Error('JWT_SECRET not configured');
    }

    return this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        purpose: 'password-reset',
      },
      {
        secret: jwtSecret,
        expiresIn: '1h',
      },
    );
  }
}
