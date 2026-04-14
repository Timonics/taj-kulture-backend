import { IsBoolean, IsNumber, IsString, IsOptional, IsObject } from 'class-validator';

export class PlatformSettingsDto {
  @IsObject()
  @IsOptional()
  commission?: {
    rate: number;
    type: 'percentage' | 'fixed';
    minimum?: number;
  };

  @IsObject()
  @IsOptional()
  shipping?: {
    defaultRate: number;
    freeShippingThreshold?: number;
    zones?: Array<{
      name: string;
      rate: number;
      cities: string[];
    }>;
  };

  @IsObject()
  @IsOptional()
  features?: {
    allowVendorRegistration: boolean;
    requireVendorApproval: boolean;
    enableReviews: boolean;
    enableWishlist: boolean;
  };

  @IsObject()
  @IsOptional()
  email?: {
    orderConfirmation: boolean;
    shippingUpdate: boolean;
    newsletter: boolean;
    promotionalEmails: boolean;
  };
}