// src/core/filters/validation-exception.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { ERROR_CODES } from '../constants/error-codes.constants';

@Catch(BadRequestException)
export class ValidationExceptionFilter implements ExceptionFilter {
  catch(exception: BadRequestException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse() as any;

    let validationErrors = [];
    if (exceptionResponse.message && Array.isArray(exceptionResponse.message)) {
      validationErrors = exceptionResponse.message;
    }

    response.status(status).json({
      success: false,
      message: 'Validation failed',
      code: ERROR_CODES.VALIDATION_FAILED,
      errors: validationErrors,
      meta: {
        timestamp: new Date().toISOString(),
        path: request.url,
        correlationId: request['correlationId'],
      },
    });
  }
}