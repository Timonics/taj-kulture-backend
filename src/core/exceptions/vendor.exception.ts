// src/core/exceptions/vendor.exception.ts
import { HttpStatus } from '@nestjs/common';
import { DomainException } from './domain.exception';
import { ERROR_CODES } from '../constants/error-codes.constants';

// Your existing exceptions (updated with new codes)
export class VendorNotFoundException extends DomainException {
  constructor(message?: string, details?: any) {
    super(
      message || 'Vendor not found',
      ERROR_CODES.VENDOR_NOT_FOUND,
      HttpStatus.NOT_FOUND,
      details,
    );
  }
}

export class VendorConflictException extends DomainException {
  constructor(vendorIdOrSlug: string, message?: string, details?: any) {
    super(
      message || `Vendor with this ${vendorIdOrSlug} already exists`,
      ERROR_CODES.VENDOR_CONFLICT,
      HttpStatus.CONFLICT,
      { vendorIdOrSlug, ...details },
    );
  }
}

// New exceptions from enhanced system
export class VendorNotApprovedException extends DomainException {
  constructor(vendorId?: string, status?: string, details?: any) {
    super(
      status 
        ? `Vendor is ${status}. Cannot perform this action.`
        : 'Vendor is not approved',
      ERROR_CODES.VENDOR_NOT_APPROVED,
      HttpStatus.FORBIDDEN,
      { vendorId, status, ...details },
    );
  }
}

export class VendorSuspendedException extends DomainException {
  constructor(vendorId?: string, reason?: string, details?: any) {
    super(
      reason ? `Vendor suspended: ${reason}` : 'Vendor is suspended',
      ERROR_CODES.VENDOR_SUSPENDED,
      HttpStatus.FORBIDDEN,
      { vendorId, reason, ...details },
    );
  }
}

export class VendorPendingApprovalException extends DomainException {
  constructor(vendorId?: string, details?: any) {
    super(
      'Vendor application is pending approval',
      ERROR_CODES.VENDOR_PENDING_APPROVAL,
      HttpStatus.FORBIDDEN,
      { vendorId, ...details },
    );
  }
}

export class VendorSlugTakenException extends DomainException {
  constructor(slug: string, details?: any) {
    super(
      `Vendor slug '${slug}' is already taken`,
      ERROR_CODES.VENDOR_SLUG_TAKEN,
      HttpStatus.CONFLICT,
      { slug, ...details },
    );
  }
}