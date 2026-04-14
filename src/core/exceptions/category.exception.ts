import { HttpStatus } from '@nestjs/common';
import { DomainException } from './domain.exception';
import { ERROR_CODES } from '../constants/error-codes.constants';

export class CategoryNotFoundException extends DomainException {
  constructor(message?: string, details?: any) {
    super(
      message || 'Category not found',
      ERROR_CODES.CATEGORY_NOT_FOUND,
      HttpStatus.NOT_FOUND,
      details,
    );
  }
}

export class CategoryConflictException extends DomainException {
  constructor(categoryIdOrSlug: string, message?: string, details?: any) {
    super(
      message || `Category with this ${categoryIdOrSlug} already exists`,
      ERROR_CODES.CATEGORY_CONFLICT,
      HttpStatus.CONFLICT,
      { categoryIdOrSlug, ...details },
    );
  }
}

export class CategoryHasChildrenException extends DomainException {
  constructor(categoryId: string, childrenCount?: number, details?: any) {
    super(
      childrenCount 
        ? `Cannot delete category with ${childrenCount} child categories`
        : 'Cannot delete category with child categories',
      ERROR_CODES.CATEGORY_HAS_CHILDREN,
      HttpStatus.BAD_REQUEST,
      { categoryId, childrenCount, ...details },
    );
  }
}

export class CategoryInvalidParentException extends DomainException {
  constructor(parentId?: string, reason?: string, details?: any) {
    super(
      reason || 'Invalid parent category',
      ERROR_CODES.CATEGORY_INVALID_PARENT,
      HttpStatus.BAD_REQUEST,
      { parentId, reason, ...details },
    );
  }
}

export class CategoryCircularReferenceException extends DomainException {
  constructor(categoryId: string, parentId: string, details?: any) {
    super(
      'Circular reference detected in category hierarchy',
      ERROR_CODES.CATEGORY_CIRCULAR_REFERENCE,
      HttpStatus.BAD_REQUEST,
      { categoryId, parentId, ...details },
    );
  }
}