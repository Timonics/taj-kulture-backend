import { HttpStatus } from '@nestjs/common';
import { DomainException } from './domain.exception';
import { ERROR_CODES } from '../constants/error-codes.constants';

export class CartItemNotFoundException extends DomainException {
  constructor(message?: string, details?: any) {
    super(
      message || 'Cart item not found',
      ERROR_CODES.CART_ITEM_NOT_FOUND,
      HttpStatus.NOT_FOUND,
      details,
    );
  }
}

export class CartEmptyException extends DomainException {
  constructor(message?: string, details?: any) {
    super(
      message || 'Cart is empty',
      ERROR_CODES.CART_EMPTY,
      HttpStatus.BAD_REQUEST,
      details,
    );
  }
}

export class CartItemInvalidException extends DomainException {
  constructor(productId?: string, reason?: string, details?: any) {
    super(
      reason || 'Invalid cart item',
      ERROR_CODES.CART_ITEM_INVALID,
      HttpStatus.BAD_REQUEST,
      { productId, reason, ...details },
    );
  }
}