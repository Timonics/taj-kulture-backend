/**
 * ADMIN UPDATE VENDOR REQUEST DTO
 *
 * Admin can verify, feature, or change verification status.
 */

import { IsBoolean, IsOptional, IsEnum } from 'class-validator';
import { VerificationStatus } from '../../../../../generated/prisma/client';

export class AdminUpdateVendorRequestDto {
  @IsBoolean()
  @IsOptional()
  isVerified?: boolean;

  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean;

  @IsEnum(VerificationStatus)
  @IsOptional()
  verificationStatus?: VerificationStatus;
}