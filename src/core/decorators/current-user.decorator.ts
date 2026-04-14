import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from 'generated/prisma/client';

/**
 * CURRENT USER DECORATOR
 *
 * Injects the currently authenticated user (or specific user property) into a route handler.
 *
 * WHY NEEDED: Eliminates repetitive code like:
 *   const user = req.user;
 *   const userId = req.user.id;
 *
 * @example
 * // Get full user object
 * -@Get('profile')
 * getProfile(@CurrentUser() user: UserDto) { ... }
 *
 * // Get only user ID
 * -@Post('orders')
 * createOrder(@CurrentUser('id') userId: string) { ... }
 */
export const CurrentUser = createParamDecorator(
  (data: keyof User | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    // If a specific property is requested (e.g., 'id'), return only that
    if (data && user) {
      return user[data];
    }

    // Otherwise return the full user object
    return user;
  },
);
