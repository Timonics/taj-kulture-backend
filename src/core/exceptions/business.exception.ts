import { HttpException, HttpStatus } from "@nestjs/common";
import { ERROR_CODES } from "../constants/error-codes.constants";

export class BusinessException extends HttpException {
  constructor(
    message: string,
    code: keyof typeof ERROR_CODES | string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    details?: any,
  ) {
    super(
      {
        message,
        code: ERROR_CODES[code] || code,
        details,
        timestamp: new Date().toISOString(),
      },
      status,
    );
  }
}