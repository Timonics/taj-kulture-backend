import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../shared/database/prisma.service';
import type {
  RegisterDto,
  LoginDto,
  AuthResponseDto,
  TokenResponseDto,
} from './dto';
import * as bcrypt from 'bcrypt';
import { User } from 'generated/prisma/client';
import { ConfigService } from '@nestjs/config';
import { UserResponseDto } from '../users/dto';
import { UsersService } from '../users/users.service';
import { UserNotFoundException } from 'src/core/exceptions/user-not-found.exception';
import { InvalidCredentialsException } from 'src/core/exceptions/invalid-credientials.exception';
import { EmailService } from 'src/shared/email/email.service';
import { addDays } from 'date-fns';
import { USER_EVENTS } from 'src/shared/events/event-types';
import { EventBus } from 'src/shared/events/event-bus.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private userService: UsersService,
    private eventBus: EventBus,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  private sanitizeUser(user: User): Omit<UserResponseDto, 'password'> {
    const { password: _, ...result } = user;
    return result;
  }

  async validateUser(
    email: string,
    password: string,
  ): Promise<Omit<UserResponseDto, 'password'> | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (user && (await bcrypt.compare(password, user.password))) {
      return this.sanitizeUser(user);
    }
    return null;
  }

  async validateGoogleUser(googleUser: any): Promise<any> {
    const { email, firstName, lastName, avatar, googleId } = googleUser;

    // Check if user exists
    let user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Create new user from Google data
      user = await this.prisma.user.create({
        data: {
          email,
          firstName,
          lastName,
          avatar,
          googleId,
          username:
            email.split('@')[0] + '_' + Math.floor(Math.random() * 1000),
          password: '', // Google users don't have password
          isEmailVerified: true, // Google emails are verified
          role: 'CUSTOMER',
        },
      });
    } else if (!user.googleId) {
      // Link Google account to existing user
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          googleId,
          isEmailVerified: true,
        },
      });
    }

    const { password: _, ...result } = user;
    return result;
  }

  async refreshTokens(refreshToken: string): Promise<TokenResponseDto> {
    try {
      // Verify refresh token
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
      });

      // Find user with this refresh token
      const user = await this.prisma.user.findFirst({
        where: {
          id: payload.sub,
          refreshToken: refreshToken,
        },
      });

      if (!user) {
        throw new UserNotFoundException();
      }

      // Generate new tokens
      return this.generateTokenPair(user);
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    const user = await this.userService.create(registerDto);

    // Generate JWT
    const tokens = await this.generateTokenPair(user);

    return {
      user: this.sanitizeUser(user as User),
      tokens,
    };
  }

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const { email, password } = loginDto;

    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UserNotFoundException();
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new InvalidCredentialsException();
    }

    // Generate JWT
    const tokens = await this.generateTokenPair(user);

    return {
      user: this.sanitizeUser(user),
      tokens,
    };
  }

  async verifyEmail(token: string): Promise<string> {
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get('JWT_SECRET'),
      });

      if (payload.purpose !== 'email-verification') {
        throw new BadRequestException('Invalid verification token');
      }

      const user = await this.prisma.user.findFirst({
        where: {
          email: payload.email,
          emailVerificationToken: token,
          emailVerificationExpires: { gt: new Date() },
        },
      });

      if (!user) {
        throw new UserNotFoundException();
      }

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          isEmailVerified: true,
          emailVerificationToken: null,
          emailVerificationExpires: null,
        },
      });

      return 'Email verified successfully';
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new BadRequestException('Verification token has expired');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new BadRequestException('Invalid verification token');
      }
      throw new UnauthorizedException(
        'Invalid or expired email verification token',
      );
    }
  }

  async resendVerificationEmail(email: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UserNotFoundException();
    }

    if (user.isEmailVerified) {
      throw new BadRequestException('Email is already verified');
    }

    const verificationToken = this.jwtService.sign(
      {
        email: user.email,
        purpose: 'email-verification',
      },
      {
        secret: this.configService.get('JWT_SECRET'),
        expiresIn: '24h',
      },
    );

    const verificationExpires = addDays(new Date(), 1);

    // Update user with new token
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken: verificationToken,
        emailVerificationExpires: verificationExpires,
      },
    });

    // Emit event to send new email
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

    return 'Verification email resent successfully';
  }

  async logout(userId: string): Promise<void> {
    // Clear refresh token
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
  }

  private async generateTokenPair(user: any): Promise<TokenResponseDto> {
    const payload = { sub: user.id, email: user.email, role: user.role };

    // Generate access token (short-lived)
    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_SECRET'),
      expiresIn: this.configService.get('JWT_EXPIRES_IN') || '15m',
    });

    // Generate refresh token (long-lived)
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN') || '30d',
    });

    // Store refresh token in database (for invalidation)
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken },
    });

    // Get expiration time
    const decoded = this.jwtService.decode(accessToken) as any;
    const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);

    return {
      accessToken,
      refreshToken,
      expiresIn,
    };
  }
}
