import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  private logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl, ip, body } = req;
    const userAgent = req.get('user-agent') || '';
    const correlationId = req['correlationId'];

    // Start time
    const startTime = Date.now();

    // Log when response finishes
    res.on('finish', () => {
      const { statusCode } = res;
      const contentLength = res.get('content-length');
      const responseTime = Date.now() - startTime;

      const logMessage = {
        correlationId,
        method,
        url: originalUrl,
        statusCode,
        contentLength,
        responseTime: `${responseTime}ms`,
        userAgent,
        ip,
        // Don't log passwords
        body: body?.password ? { ...body, password: '[REDACTED]' } : body,
      };

      if (statusCode >= 500) {
        this.logger.error(JSON.stringify(logMessage));
      } else if (statusCode >= 400) {
        this.logger.warn(JSON.stringify(logMessage));
      } else {
        this.logger.log(JSON.stringify(logMessage));
      }
    });

    next();
  }
}