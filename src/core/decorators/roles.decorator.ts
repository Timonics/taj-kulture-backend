import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../../generated/prisma/client';

export const ROLES_KEY = 'roles';

/**
 * ROLES DECORATOR
 *
 * Specifies which user roles are allowed to access a route.
 *
 * WHY NEEDED: Different users have different permissions:
 * - CUSTOMER: Can view products, place orders
 * - VENDOR: Can manage their own products
 * - ADMIN: Can manage everything
 * - MODERATOR: Can moderate reviews, content
 *
 * @example
 * -@Roles('ADMIN', 'MODERATOR')
 * -@Delete('reviews/:id')
 * async deleteReview() { ... }
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
