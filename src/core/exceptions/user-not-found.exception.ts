import { HttpStatus } from '@nestjs/common';
import { BusinessException } from './business.exception';

export class UserNotFoundException extends BusinessException {
  constructor(message?: string, details?: any) {
    super(
      message || 'User not found',
      'USER_NOT_FOUND',
      HttpStatus.NOT_FOUND,
      details,
    );
  }
}
