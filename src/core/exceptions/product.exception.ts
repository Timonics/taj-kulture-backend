// src/core/exceptions/product.exception.ts
import { HttpStatus } from '@nestjs/common';
import { DomainException } from './domain.exception';
import { ERROR_CODES } from '../constants/error-codes.constants';

// Your existing exceptions
export class ProductNotFoundException extends DomainException {
  constructor(message?: string, details?: any) {
    super(
      message || 'Product not found',
      ERROR_CODES.PRODUCT_NOT_FOUND,
      HttpStatus.NOT_FOUND,
      details,
    );
  }
}

export class ProductOutOfStockException extends DomainException {
  constructor(productId?: string, message?: string, details?: any) {
    const defaultMessage = productId 
      ? `Product ${productId} is out of stock`
      : 'Product is out of stock';
    super(
      message || defaultMessage,
      ERROR_CODES.PRODUCT_OUT_OF_STOCK,
      HttpStatus.CONFLICT,
      { productId, ...details },
    );
  }
}

export class ProductConflictException extends DomainException {
  constructor(productIdOrSlug: string, message?: string, details?: any) {
    super(
      message || `Product with this ${productIdOrSlug} already exists`,
      ERROR_CODES.PRODUCT_CONFLICT,
      HttpStatus.CONFLICT,
      { productIdOrSlug, ...details },
    );
  }
}

// New exceptions from enhanced system
export class ProductUnauthorizedException extends DomainException {
  constructor(productId?: string, vendorId?: string, details?: any) {
    super(
      'You do not have permission to modify this product',
      ERROR_CODES.PRODUCT_UNAUTHORIZED,
      HttpStatus.FORBIDDEN,
      { productId, vendorId, ...details },
    );
  }
}

export class ProductInvalidPriceException extends DomainException {
  constructor(price?: number, details?: any) {
    super(
      `Invalid product price: ${price}`,
      ERROR_CODES.PRODUCT_INVALID_PRICE,
      HttpStatus.BAD_REQUEST,
      { price, ...details },
    );
  }
}

export class ProductInvalidVariantException extends DomainException {
  constructor(variant?: string, reason?: string, details?: any) {
    super(
      reason ? `Invalid variant: ${reason}` : 'Invalid product variant',
      ERROR_CODES.PRODUCT_VARIANT_INVALID,
      HttpStatus.BAD_REQUEST,
      { variant, reason, ...details },
    );
  }
}

export class ProductImageUploadFailedException extends DomainException {
  constructor(productId?: string, reason?: string, details?: any) {
    super(
      `Failed to upload product image: ${reason || 'unknown error'}`,
      ERROR_CODES.PRODUCT_IMAGE_UPLOAD_FAILED,
      HttpStatus.INTERNAL_SERVER_ERROR,
      { productId, reason, ...details },
    );
  }
}