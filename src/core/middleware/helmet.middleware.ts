import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';

@Injectable()
export class HelmetMiddleware implements NestMiddleware {
  private helmet = helmet();

  use(req: Request, res: Response, next: NextFunction) {
    this.helmet(req, res, next);
  }
}