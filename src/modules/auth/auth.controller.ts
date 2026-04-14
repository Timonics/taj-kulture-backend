/**
 * AUTH CONTROLLER
 *
 * Handles all authentication-related HTTP endpoints.
 *
 * SECURITY FEATURES:
 * - Tokens set as HttpOnly cookies (not accessible via JavaScript)
 * - Secure flag in production (HTTPS only)
 * - SameSite=Lax for CSRF protection
 * - Refresh token rotation
 * - Rate limiting on login
 *
 * RESPONSE FORMAT:
 * - Success: { success: true, data: {...}, meta: {...} }
 * - Error: Handled by global exception filter
 */

import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Get,
  Res,
  Req,
  Query,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { AuthService } from './auth.service';
import {
  RegisterRequestDto,
  LoginRequestDto,
  ForgotPasswordRequestDto,
  ResetPasswordRequestDto,
  VerifyEmailRequestDto,
  ResendVerificationRequestDto,
  ChangePasswordRequestDto,
} from './dto/requests';
import { AuthResponseDto, MessageResponseDto } from './dto/responses';
import { CurrentUser } from 'src/core/decorators/current-user.decorator';
import { Public } from 'src/core/decorators/public.decorator';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { User } from 'generated/prisma/client';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ============================================================
  // PUBLIC ENDPOINTS (No authentication required)
  // ============================================================

  /**
   * User Registration
   *
   * @param registerDto - User registration data
   * @param response - Express response object (for setting cookies)
   * @returns User data (tokens set as HttpOnly cookies)
   *
   * @example
   * POST /api/auth/register
   * Body: { email, username, password, firstName?, lastName? }
   */
  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() registerDto: RegisterRequestDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ success: boolean; data: AuthResponseDto; meta: any }> {
    const { user, tokens } = await this.authService.register(registerDto);

    // Set tokens as secure HttpOnly cookies
    this.setAuthCookies(response, tokens);

    return {
      success: true,
      data: { user },
      meta: {
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * User Login
   *
   * @param loginDto - User login credentials
   * @param response - Express response object (for setting cookies)
   * @returns User data (tokens set as HttpOnly cookies)
   *
   * @example
   * POST /api/auth/login
   * Body: { email, password }
   */
  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginRequestDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto> {
    const { user, tokens } = await this.authService.login(loginDto);

    // Set tokens as secure HttpOnly cookies
    this.setAuthCookies(response, tokens);

    return { user };
  }

  /**
   * Refresh Access Token
   *
   * Uses refresh token from cookie (not request body!)
   * Implements refresh token rotation (old token invalidated)
   *
   * @param request - Express request object (contains refresh token cookie)
   * @param response - Express response object (for setting new cookies)
   *
   * @example
   * POST /api/auth/refresh
   * Cookie: refreshToken=eyJhbGciOiJIUzI1NiIs...
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<string> {
    // Extract refresh token from cookie (not from body!)
    const refreshToken = request.cookies?.refreshToken;

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not found');
    }

    const tokens = await this.authService.refreshTokens(refreshToken);

    // Set new tokens as HttpOnly cookies
    this.setAuthCookies(response, tokens);

    return 'Tokens refreshed successfully';
  }

  /**
   * User Logout
   *
   * Clears authentication cookies and invalidates refresh token
   *
   * @param userId - Current authenticated user ID (from JWT)
   * @param response - Express response object (for clearing cookies)
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser('id') userId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<string> {
    await this.authService.logout(userId);

    // Clear authentication cookies
    this.clearAuthCookies(response);

    return 'Logged out successfully';
  }

  /**
   * Get Current User Profile
   *
   * @param user - Current authenticated user (from JWT strategy)
   * @returns User profile data
   */
  @Get('profile')
  async getProfile(@CurrentUser() user: Omit<User, 'password'>): Promise<any> {
    return user;
  }

  /**
   * Verify Email Address
   *
   * User clicks link from email: /auth/verify-email?token=xxx
   *
   * @param query - Contains verification token
   */
  @Public()
  @Get('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Query() query: VerifyEmailRequestDto): Promise<string> {
    await this.authService.verifyEmail(query.token);

    return 'Email verified successfully';
  }

  /**
   * Resend Verification Email
   *
   * @param body - Contains email address
   */
  @Public()
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  async resendVerification(
    @Body() body: ResendVerificationRequestDto,
  ): Promise<string> {
    await this.authService.resendVerificationEmail(body.email);

    return 'If an account exists with this email, a verification link has been sent';
  }

  /**
   * Forgot Password - Send Reset Link
   *
   * @param body - Contains email address
   */
  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(
    @Body() body: ForgotPasswordRequestDto,
  ): Promise<string> {
    await this.authService.forgotPassword(body.email);

    return 'If an account exists with this email, a password reset link has been sent';
  }

  /**
   * Reset Password
   *
   * @param body - Contains token and new password
   */
  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() body: ResetPasswordRequestDto): Promise<string> {
    // Validate passwords match
    if (body.newPassword !== body.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    await this.authService.resetPassword(body.token, body.newPassword);

    return 'Password reset successfully';
  }

  /**
   * Change Password (Authenticated User)
   *
   * @param userId - Current authenticated user ID
   * @param body - Contains current and new password
   */
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser('id') userId: string,
    @Body() body: ChangePasswordRequestDto,
  ): Promise<string> {
    // Validate new passwords match
    if (body.newPassword !== body.confirmPassword) {
      throw new BadRequestException('New passwords do not match');
    }

    await this.authService.changePassword(
      userId,
      body.currentPassword,
      body.newPassword,
    );

    return 'Password changed successfully';
  }

  // ============================================================
  // PRIVATE HELPER METHODS
  // ============================================================

  /**
   * Set authentication cookies with security best practices
   *
   * SECURITY SETTINGS:
   * - httpOnly: true - Prevents XSS access to tokens
   * - secure: true - Only sent over HTTPS in production
   * - sameSite: 'lax' - Protects against CSRF while allowing navigation
   * - path: '/' - Available across the entire site
   *
   * @param response - Express response object
   * @param tokens - Token pair to set as cookies
   */
  private setAuthCookies(
    response: Response,
    tokens: { accessToken: string; refreshToken: string; expiresIn: number },
  ): void {
    const isProduction = process.env.NODE_ENV === 'production';

    // Access token - short lived (15 minutes)
    response.cookie('accessToken', tokens.accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000, // 15 minutes
      path: '/',
    });

    // Refresh token - long lived (30 days)
    response.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      path: '/',
    });
  }

  /**
   * Clear authentication cookies on logout
   *
   * @param response - Express response object
   */
  private clearAuthCookies(response: Response): void {
    response.clearCookie('accessToken', { path: '/' });
    response.clearCookie('refreshToken', { path: '/' });
  }
}
