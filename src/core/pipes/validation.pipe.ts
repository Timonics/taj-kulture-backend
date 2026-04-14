import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ERROR_CODES } from '../constants/error-codes.constants'; 

/**
 * CUSTOM VALIDATION PIPE
 *
 * Enhanced validation pipe that formats errors with your error codes.
 *
 * NOTE: This REPLACES NestJS default ValidationPipe
 * Register in main.ts: app.useGlobalPipes(new CustomValidationPipe())
 */
@Injectable()
export class CustomValidationPipe implements PipeTransform<any> {
  async transform(value: any, { metatype }: ArgumentMetadata) {
    if (!metatype || !this.toValidate(metatype)) {
      return value;
    }

    const object = plainToInstance(metatype, value);
    const errors = await validate(object);

    if (errors.length > 0) {
      const messages = errors.flatMap((error) => {
        if (error.constraints) {
          return Object.values(error.constraints);
        }
        return [`${error.property} is invalid`];
      });

      throw new BadRequestException({
        message: 'Validation failed',
        code: ERROR_CODES.VALIDATION_FAILED,
        errors: messages,
      });
    }

    return object;
  }

  private toValidate(metatype: any): boolean {
    const types = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }
}
