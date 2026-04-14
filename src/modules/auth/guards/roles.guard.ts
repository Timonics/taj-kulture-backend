import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../../../core/decorators/roles.decorator';
import { UserRole } from '../../../../generated/prisma/client';
import { ERROR_CODES } from '../../../core/constants/error-codes.constants';

/**
 * ROLES GUARD
 *
 * Enforces role-based access control (RBAC).
 *
 * HOW IT WORKS:
 * 1. Checks if route has @Roles() decorator
 * 2. If no roles specified, allows access
 * 3. If roles specified, checks if user.role matches any allowed role
 * 4. Throws ForbiddenException if no match
 *
 * @example
 * -@Roles('ADMIN', 'MODERATOR')
 * -@Delete('users/:id')
 * -async deleteUser() { ... } // Only ADMIN or MODERATOR can delete users
 *
 * PRIORITY ORDER:
 * 1. Route-level decorator (highest priority)
 * 2. Controller-level decorator
 * 3. No decorator = any authenticated user
 */
@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Get required roles from decorator (if any)
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [
        context.getHandler(), // Check method-level decorator first
        context.getClass(), // Then check class-level decorator
      ],
    );

    // No roles required - allow access (authentication already done)
    if (!requiredRoles || requiredRoles.length === 0) {
      this.logger.debug('No roles required - access granted');
      return true;
    }

    // Get authenticated user from request
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      this.logger.error('Roles guard called without authenticated user');
      throw new ForbiddenException({
        message: 'User not authenticated',
        code: ERROR_CODES.SYS_FORBIDDEN,
      });
    }

    // Check if user's role is in the allowed roles list
    const hasRequiredRole = requiredRoles.includes(user.role);

    if (!hasRequiredRole) {
      this.logger.warn(
        `Access denied for user ${user.id} (role: ${user.role}). Required roles: ${requiredRoles.join(', ')}`,
      );

      throw new ForbiddenException({
        message: `Access denied. Required role: ${requiredRoles.join(' or ')}`,
        code: ERROR_CODES.SYS_FORBIDDEN,
        details: {
          userRole: user.role,
          requiredRoles: requiredRoles,
        },
      });
    }

    this.logger.debug(
      `Role check passed for user ${user.id} (role: ${user.role})`,
    );
    return true;
  }
}
