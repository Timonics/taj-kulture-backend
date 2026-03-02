import { HttpStatus } from '@nestjs/common';
import { BusinessException } from './business.exception';

export class ProductOutOfStockException extends BusinessException {
  constructor(productId: string) {
    super(
      `Product ${productId} is out of stock`,
      'PRODUCT_OUT_OF_STOCK',
      HttpStatus.CONFLICT,
      { productId },
    );
  }
}
