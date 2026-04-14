import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * PUBLIC DECORATOR
 *
 * Marks a route as publicly accessible (no authentication required).
 *
 * WHY NEEDED: By default, all routes are protected by JwtAuthGuard.
 * This decorator allows specific routes to bypass authentication.
 *
 * @example
 * -@Public()
 * -@Post('register')
 * async register() { ... }
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
