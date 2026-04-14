/**
 * FILE VALIDATION PIPE
 *
 * Validates uploaded files before processing.
 *
 * WHY SEPARATE PIPE:
 * - Reusable across multiple upload endpoints
 * - Centralized validation logic
 * - Consistent error messages
 */

import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { ERROR_CODES } from '../../../core/constants/error-codes.constants';

export interface FileValidationOptions {
  maxSize: number;
  allowedMimeTypes: string[];
}

@Injectable()
export class FileValidationPipe implements PipeTransform {
  constructor(private options: FileValidationOptions) {}

  transform(file: Express.Multer.File): Express.Multer.File {
    if (!file) {
      throw new BadRequestException({
        message: 'No file provided',
        code: ERROR_CODES.VALIDATION_FAILED,
      });
    }

    // Check file size
    if (file.size > this.options.maxSize) {
      throw new BadRequestException({
        message: `File too large. Max size: ${this.options.maxSize / (1024 * 1024)}MB`,
        code: ERROR_CODES.VALIDATION_FAILED,
        details: { maxSize: this.options.maxSize, actualSize: file.size },
      });
    }

    // Check MIME type
    if (!this.options.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException({
        message: `Invalid file type. Allowed: ${this.options.allowedMimeTypes.join(', ')}`,
        code: ERROR_CODES.VALIDATION_FAILED,
        details: { allowedTypes: this.options.allowedMimeTypes, receivedType: file.mimetype },
      });
    }

    return file;
  }
}