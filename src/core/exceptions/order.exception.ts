// src/core/exceptions/order.exception.ts
import { HttpStatus } from '@nestjs/common';
import { DomainException } from './domain.exception';
import { ERROR_CODES } from '../constants/error-codes.constants';

// Your existing exceptions
export class OrderNotFoundException extends DomainException {
  constructor(message?: string, details?: any) {
    super(
      message || 'Order not found',
      ERROR_CODES.ORDER_NOT_FOUND,
      HttpStatus.NOT_FOUND,
      details,
    );
  }
}

export class OrderInvalidStatusException extends DomainException {
  constructor(message?: string, details?: any) {
    super(
      message || 'Invalid order status',
      ERROR_CODES.ORDER_INVALID_STATUS,
      HttpStatus.BAD_REQUEST,
      details,
    );
  }
}

// New exceptions from enhanced system
export class OrderCannotCancelException extends DomainException {
  constructor(orderId?: string, currentStatus?: string, details?: any) {
    super(
      currentStatus 
        ? `Cannot cancel order in ${currentStatus} status`
        : 'Cannot cancel this order',
      ERROR_CODES.ORDER_CANNOT_CANCEL,
      HttpStatus.BAD_REQUEST,
      { orderId, currentStatus, ...details },
    );
  }
}

export class OrderPaymentFailedException extends DomainException {
  constructor(orderId?: string, reason?: string, details?: any) {
    super(
      reason ? `Payment failed: ${reason}` : 'Payment failed',
      ERROR_CODES.ORDER_PAYMENT_FAILED,
      HttpStatus.BAD_REQUEST,
      { orderId, reason, ...details },
    );
  }
}

export class EmptyCartException extends DomainException {
  constructor(details?: any) {
    super(
      'Cannot create order with empty cart',
      ERROR_CODES.ORDER_EMPTY_CART,
      HttpStatus.BAD_REQUEST,
      details,
    );
  }
}

export class InsufficientStockException extends DomainException {
  constructor(items?: Array<{ productId: string; name: string; requested: number; available: number }>, details?: any) {
    super(
      'Some items have insufficient stock',
      ERROR_CODES.ORDER_INSUFFICIENT_STOCK,
      HttpStatus.CONFLICT,
      { items, ...details },
    );
  }
}

export class OrderNotOwnerException extends DomainException {
  constructor(orderId?: string, userId?: string, details?: any) {
    super(
      'You do not have permission to access this order',
      ERROR_CODES.ORDER_NOT_OWNER,
      HttpStatus.FORBIDDEN,
      { orderId, userId, ...details },
    );
  }
}