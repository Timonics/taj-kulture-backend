// src/core/exceptions/user.exception.ts
import { HttpStatus } from '@nestjs/common';
import { DomainException } from './domain.exception';
import { ERROR_CODES } from '../constants/error-codes.constants';

// Your existing exceptions
export class UserNotFoundException extends DomainException {
  constructor(message?: string, details?: any) {
    super(
      message || 'User not found',
      ERROR_CODES.USER_NOT_FOUND,
      HttpStatus.NOT_FOUND,
      details,
    );
  }
}

export class EmailConflictException extends DomainException {
  constructor(message?: string, details?: any) {
    super(
      message || 'Email already registered',
      ERROR_CODES.EMAIL_CONFLICT,
      HttpStatus.CONFLICT,
      details,
    );
  }
}

export class UsernameConflictException extends DomainException {
  constructor(message?: string, details?: any) {
    super(
      message || 'Username already taken',
      ERROR_CODES.USERNAME_CONFLICT,
      HttpStatus.CONFLICT,
      details,
    );
  }
}

export class UserFollowConflictException extends DomainException {
  constructor(message?: string, details?: any) {
    super(
      message || 'Already following this user',
      ERROR_CODES.USER_FOLLOW_CONFLICT,
      HttpStatus.CONFLICT,
      details,
    );
  }
}

// New exceptions from enhanced system
export class CannotFollowSelfException extends DomainException {
  constructor(details?: any) {
    super(
      'You cannot follow yourself',
      ERROR_CODES.USER_CANNOT_FOLLOW_SELF,
      HttpStatus.BAD_REQUEST,
      details,
    );
  }
}

export class NotFollowingException extends DomainException {
  constructor(targetUserId?: string, details?: any) {
    super(
      'You are not following this user',
      ERROR_CODES.USER_NOT_FOLLOWING,
      HttpStatus.BAD_REQUEST,
      { targetUserId, ...details },
    );
  }
}

export class UserEmailSendFailedException extends DomainException {
  constructor(email?: string, reason?: string, details?: any) {
    super(
      `Failed to send email to ${email || 'user'}`,
      ERROR_CODES.USER_EMAIL_SEND_FAILED,
      HttpStatus.INTERNAL_SERVER_ERROR,
      { email, reason, ...details },
    );
  }
}

export class UserInvalidIdException extends DomainException {
  constructor(userId?: string, details?: any) {
    super(
      `Invalid user ID format: ${userId}`,
      ERROR_CODES.USER_INVALID_ID,
      HttpStatus.BAD_REQUEST,
      { userId, ...details },
    );
  }
}