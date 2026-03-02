import { IsBoolean, IsOptional, IsEnum } from 'class-validator';
import { VerificationStatus } from 'generated/prisma/client';

export class AdminUpdateVendorDto {
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