import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';

/**
 * COOKIE PARSER MIDDLEWARE
 *
 * Parses cookies from the incoming request and attaches them to `req.cookies`.
 *
 * WHY NEEDED:
 * - Authentication uses HttpOnly cookies (accessToken, refreshToken)
 * - Without this middleware, `req.cookies` will be undefined
 * - Enables reading tokens from cookies in guards and strategies
 *
 * HOW TO USE:
 * 1. Register in AppModule.configure() after CorrelationIdMiddleware
 * 2. Then you can access req.cookies in any route/guard
 *
 * @example
 * // In AppModule
 * consumer
 *   .apply(CorrelationIdMiddleware)
 *   .forRoutes('*')
 *   .apply(CookieParserMiddleware)
 *   .forRoutes('*');
 *
 * // Then in JwtStrategy:
 * const token = req.cookies?.accessToken;
 */
@Injectable()
export class CookieParserMiddleware implements NestMiddleware {
  private readonly cookieParser = cookieParser();

  use(req: Request, res: Response, next: NextFunction): void {
    this.cookieParser(req, res, next);
  }
}
