import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../shared/database/prisma.service';
import { EnvironmentService } from 'src/config/env/env.service';
import { ILogger } from 'src/shared/logger/logger.interface';
import { LoggerService } from 'src/shared/logger/logger.service';

/**
 * GOOGLE OAUTH STRATEGY
 *
 * Handles Google OAuth 2.0 authentication.
 *
 * FLOW:
 * 1. User clicks "Login with Google"
 * 2. Redirect to Google consent screen
 * 3. User approves access
 * 4. Google redirects back with authorization code
 * 5. Exchange code for user profile data
 * 6. Create or update user in database
 * 7. Generate JWT tokens
 *
 * ACCOUNT LINKING:
 * - If email exists without Google ID: Link Google account
 * - If email exists with Google ID: Login normally
 * - If email doesn't exist: Create new account
 *
 * WHY ENABLE_GOOGLE_AUTH FEATURE FLAG:
 * - Google OAuth requires additional setup
 * - Can be disabled if not configured
 * - Graceful fallback to email/password only
 */
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  private readonly logger: ILogger;

  constructor(
    private env: EnvironmentService,
    logger: LoggerService,
    private prisma: PrismaService,
  ) {
    // Check if Google OAuth is enabled
    const isEnabled = env.get('ENABLE_GOOGLE_AUTH') === true;
    const clientId = env.get('GOOGLE_CLIENT_ID');
    const clientSecret = env.get('GOOGLE_CLIENT_SECRET');
    const callbackUrl = env.get('GOOGLE_CALLBACK_URL');

    if (isEnabled && (!clientId || !clientSecret)) {
      throw new Error(
        'Google OAuth enabled but missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET',
      );
    }

    super({
      clientID: clientId,
      clientSecret: clientSecret,
      callbackURL: callbackUrl,
      scope: ['email', 'profile'], // Request email and basic profile info
    } as any);
    this.logger = logger.child(GoogleStrategy.name);
  }

  /**
   * Validate Google user and create/link account
   *
   * @param accessToken - Google access token (not used in our app)
   * @param refreshToken - Google refresh token (not used)
   * @param profile - User profile from Google
   * @param done - Passport callback
   */
  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    this.logger.debug(
      `Google OAuth callback received for email: ${profile.emails?.[0]?.value}`,
    );

    try {
      const { name, emails, photos, id: googleId } = profile;
      const email = emails[0]?.value;
      const firstName = name?.givenName;
      const lastName = name?.familyName;
      const avatar = photos[0]?.value;

      if (!email) {
        throw new UnauthorizedException(
          'Google account must have an email address',
        );
      }

      // Check if user already exists
      let user = await this.prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        // Create new user from Google data
        this.logger.debug(`Creating new user from Google: ${email}`);

        // Generate unique username from email (remove special chars)
        const baseUsername = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_');
        const username = `${baseUsername}_${Math.floor(Math.random() * 10000)}`;

        user = await this.prisma.user.create({
          data: {
            email,
            username,
            firstName,
            lastName,
            avatar,
            googleId,
            password: '', // Google users don't have password
            isEmailVerified: true, // Google emails are verified
            role: 'CUSTOMER',
          },
        });

        this.logger.debug(`New user created from Google: ${email}`);
      } else if (!user.googleId) {
        // Link Google account to existing user
        this.logger.debug(`Linking Google account to existing user: ${email}`);

        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            googleId,
            isEmailVerified: true, // Mark email as verified
            ...(firstName && !user.firstName ? { firstName } : {}),
            ...(lastName && !user.lastName ? { lastName } : {}),
            ...(avatar && !user.avatar ? { avatar } : {}),
          },
        });

        this.logger.debug(`Google account linked for user: ${email}`);
      } else {
        this.logger.debug(`Existing Google user logged in: ${email}`);
      }

      // Return user without password
      const { password: _, ...result } = user;
      done(null, result);
    } catch (error) {
      const errorMessage = error instanceof Error ? '' : '';
      this.logger.error(`Google OAuth failed: ${errorMessage}`);
      done(error, false);
    }
  }
}
