import { HttpStatus } from '@nestjs/common';
import { DomainException } from './domain.exception';
import { ERROR_CODES } from '../constants/error-codes.constants';

export class UnauthorizedException extends DomainException {
  constructor(message?: string, details?: any) {
    super(
      message || 'Unauthorized access',
      ERROR_CODES.UNAUTHORIZED,
      HttpStatus.UNAUTHORIZED,
      details,
    );
  }
}

export class InvalidCredentialsException extends DomainException {
  constructor(message?: string, details?: any) {
    super(
      message || 'Invalid email or password',
      ERROR_CODES.INVALID_CREDENTIALS,
      HttpStatus.UNAUTHORIZED,
      details,
    );
  }
}

export class TokenExpiredException extends DomainException {
  constructor(tokenType?: string, details?: any) {
    super(
      tokenType ? `${tokenType} token has expired` : 'Token has expired',
      ERROR_CODES.TOKEN_EXPIRED,
      HttpStatus.UNAUTHORIZED,
      { tokenType, ...details },
    );
  }
}

export class InvalidTokenException extends DomainException {
  constructor(message?: string, details?: any) {
    super(
      message || 'Invalid or malformed token',
      ERROR_CODES.INVALID_TOKEN,
      HttpStatus.UNAUTHORIZED,
      details,
    );
  }
}

export class EmailNotVerifiedException extends DomainException {
  constructor(email?: string, details?: any) {
    super(
      email ? `Email ${email} is not verified` : 'Email not verified',
      ERROR_CODES.EMAIL_NOT_VERIFIED,
      HttpStatus.FORBIDDEN,
      { email, ...details },
    );
  }
}

export class AccountLockedException extends DomainException {
  constructor(reason?: string, details?: any) {
    super(
      reason ? `Account locked: ${reason}` : 'Account locked',
      ERROR_CODES.ACCOUNT_LOCKED,
      HttpStatus.FORBIDDEN,
      { reason, ...details },
    );
  }
}

export class TooManyLoginAttemptsException extends DomainException {
  constructor(retryAfterSeconds?: number, details?: any) {
    super(
      `Too many login attempts. Try again in ${retryAfterSeconds || 60} seconds`,
      ERROR_CODES.TOO_MANY_ATTEMPTS,
      HttpStatus.TOO_MANY_REQUESTS,
      { retryAfterSeconds, ...details },
    );
  }
}

export class GoogleAuthFailedException extends DomainException {
  constructor(reason?: string, details?: any) {
    super(
      reason ? `Google authentication failed: ${reason}` : 'Google authentication failed',
      ERROR_CODES.GOOGLE_AUTH_FAILED,
      HttpStatus.BAD_REQUEST,
      { reason, ...details },
    );
  }
}