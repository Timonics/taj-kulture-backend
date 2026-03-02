import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  private readonly HEADER_NAME = 'X-Correlation-Id';

  use(req: Request, res: Response, next: NextFunction) {
    const correlationId = req.headers[this.HEADER_NAME.toLowerCase()] as string || uuidv4();
    
    // Attach to request object for use in controllers/services
    req['correlationId'] = correlationId;
    
    // Set response header
    res.setHeader(this.HEADER_NAME, correlationId);
    
    next();
  }
}