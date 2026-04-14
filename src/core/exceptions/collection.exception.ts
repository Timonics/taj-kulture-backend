import { HttpStatus } from '@nestjs/common';
import { DomainException } from './domain.exception';
import { ERROR_CODES } from '../constants/error-codes.constants';

export class CollectionNotFoundException extends DomainException {
  constructor(message?: string, details?: any) {
    super(
      message || 'Collection not found',
      ERROR_CODES.COLLECTION_NOT_FOUND,
      HttpStatus.NOT_FOUND,
      details,
    );
  }
}

export class CollectionConflictException extends DomainException {
  constructor(collectionIdOrSlug: string, message?: string, details?: any) {
    super(
      message || `Collection with this ${collectionIdOrSlug} already exists`,
      ERROR_CODES.COLLECTION_CONFLICT,
      HttpStatus.CONFLICT,
      { collectionIdOrSlug, ...details },
    );
  }
}

// New exceptions
export class CollectionUnauthorizedException extends DomainException {
  constructor(collectionId?: string, userId?: string, details?: any) {
    super(
      'You do not have permission to modify this collection',
      ERROR_CODES.COLLECTION_UNAUTHORIZED,
      HttpStatus.FORBIDDEN,
      { collectionId, userId, ...details },
    );
  }
}