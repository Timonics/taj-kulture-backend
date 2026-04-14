import { IsUUID, IsString, IsOptional, IsBoolean, IsEnum } from 'class-validator';
import { VerificationStatus } from 'generated/prisma/client';

export class VendorModerationDto {
  @IsEnum(VerificationStatus)
  status: VerificationStatus;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class VendorApprovalDto {
  @IsBoolean()
  approved: boolean;

  @IsString()
  @IsOptional()
  rejectionReason?: string;
}