import { HttpStatus } from '@nestjs/common';
import { DomainException } from './domain.exception';
import { ERROR_CODES } from '../constants/error-codes.constants';

// Your existing exceptions
export class RateLimitExceededException extends DomainException {
  constructor(message?: string, details?: any) {
    super(
      message || 'Too many requests, please try again later.',
      ERROR_CODES.RATE_LIMIT_EXCEEDED,
      HttpStatus.TOO_MANY_REQUESTS,
      details,
    );
  }
}

// New exceptions
export class ValidationFailedException extends DomainException {
  constructor(errors?: string[], details?: any) {
    super(
      'Validation failed',
      ERROR_CODES.VALIDATION_FAILED,
      HttpStatus.BAD_REQUEST,
      { validationErrors: errors, ...details },
    );
  }
}

export class InvalidInputException extends DomainException {
  constructor(field?: string, reason?: string, details?: any) {
    super(
      reason ? `Invalid input for ${field || 'field'}: ${reason}` : 'Invalid input',
      ERROR_CODES.INVALID_INPUT,
      HttpStatus.BAD_REQUEST,
      { field, reason, ...details },
    );
  }
}

export class InternalServerException extends DomainException {
  constructor(message?: string, details?: any) {
    super(
      message || 'Internal server error',
      ERROR_CODES.INTERNAL_ERROR,
      HttpStatus.INTERNAL_SERVER_ERROR,
      details,
    );
  }
}

export class DatabaseException extends DomainException {
  constructor(operation?: string, error?: string, details?: any) {
    super(
      `Database error${operation ? ` during ${operation}` : ''}`,
      ERROR_CODES.DATABASE_ERROR,
      HttpStatus.INTERNAL_SERVER_ERROR,
      { operation, dbError: error, ...details },
    );
  }
}

export class QueueException extends DomainException {
  constructor(queueName?: string, jobId?: string, error?: string, details?: any) {
    super(
      `Queue error${queueName ? ` in ${queueName}` : ''}`,
      ERROR_CODES.QUEUE_ERROR,
      HttpStatus.INTERNAL_SERVER_ERROR,
      { queueName, jobId, queueError: error, ...details },
    );
  }
}

export class CacheException extends DomainException {
  constructor(operation?: string, key?: string, error?: string, details?: any) {
    super(
      `Cache error${operation ? ` during ${operation}` : ''}`,
      ERROR_CODES.SYS_CACHE_ERROR,
      HttpStatus.INTERNAL_SERVER_ERROR,
      { operation, key, cacheError: error, ...details },
    );
  }
}