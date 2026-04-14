// Base exception (export as both names for compatibility)
export { DomainException } from './domain.exception';

// Domain exceptions - all your existing ones plus new ones
export * from './auth.exception';
export * from './user.exception';
export * from './vendor.exception';
export * from './product.exception';
export * from './order.exception';
export * from './category.exception';
export * from './cart.exception';
export * from './collection.exception';
export * from './system.exception';

// Error codes (both new and legacy)
export { ERROR_CODES, ERROR_CODES_LEGACY } from '../constants/error-codes.constants';
export type { ErrorCode } from '../constants/error-codes.constants';