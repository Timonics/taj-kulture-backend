import { Expose, Type } from 'class-transformer';
import { UserRole, VerificationStatus } from 'generated/prisma/client';

class UserInfoDto {
  @Expose()
  id: string;

  @Expose()
  username: string;

  @Expose()
  avatar: string | null;
}

class VendorCategoryDto {
  @Expose()
  id: string;

  @Expose()
  name: string;

  @Expose()
  slug: string;
}

class VendorBadgeDto {
  @Expose()
  type: string;

  @Expose()
  title: string;

  @Expose()
  description: string | null;

  @Expose()
  icon: string | null;
}

export class VendorResponseDto {
  @Expose()
  id: string;

  @Expose()
  name: string;

  @Expose()
  slug: string;

  @Expose()
  logo: string | null;

  @Expose()
  banner: string | null;

  @Expose()
  description: string | null;

  @Expose()
  story: string | null;

  @Expose()
  location: string | null;

  @Expose()
  established: string | null;

  @Expose()
  rating: number;

  @Expose()
  reviewCount: number;

  @Expose()
  followersCount: number;

  @Expose()
  productCount: number;

  @Expose()
  totalSales: number;

  @Expose()
  isVerified: boolean;

  @Expose()
  isFeatured: boolean;

  @Expose()
  deliveryTime: string | null;

  @Expose()
  policies: any; // Json type

  @Expose()
  social: any; // Json type

  @Expose()
  culturalHeritage: any | null;

  @Expose()
  @Type(() => UserInfoDto)
  user?: UserInfoDto;

  @Expose()
  @Type(() => VendorCategoryDto)
  categories?: VendorCategoryDto[];

  @Expose()
  @Type(() => VendorBadgeDto)
  badges?: VendorBadgeDto[];

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;
}