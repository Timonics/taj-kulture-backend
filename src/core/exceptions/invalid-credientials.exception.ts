import { HttpStatus } from '@nestjs/common';
import { BusinessException } from './business.exception';

export class InvalidCredentialsException extends BusinessException {
  constructor(message?: string) {
    super(
      message || 'Invalid email or password',
      'INVALID_CREDENTIALS',
      HttpStatus.UNAUTHORIZED,
    );
  }
}
