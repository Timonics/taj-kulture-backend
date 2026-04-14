import { Expose, Type } from 'class-transformer';
import { CollectionType } from 'generated/prisma/client';

class VendorSummaryDto {
  @Expose()
  id: string;

  @Expose()
  name: string;

  @Expose()
  slug: string;

  @Expose()
  logo: string | null;

  @Expose()
  isVerified: boolean;
}

class ProductSummaryDto {
  @Expose()
  id: string;

  @Expose()
  name: string;

  @Expose()
  slug: string;

  @Expose()
  price: number;

  @Expose()
  images?: { url: string; isPrimary: boolean }[];
}

class CollectionTagDto {
  @Expose()
  tag: string;
}

export class CollectionResponseDto {
  @Expose()
  id: string;

  @Expose()
  name: string;

  @Expose()
  slug: string;

  @Expose()
  description: string;

  @Expose()
  story: string | null;

  @Expose()
  banner: string | null;

  @Expose()
  thumbnail: string | null;

  @Expose()
  curator: string | null;

  @Expose()
  type: CollectionType;

  @Expose()
  isFeatured: boolean;

  @Expose()
  isLimited: boolean;

  @Expose()
  isPublished: boolean;

  @Expose()
  launchDate: Date | null;

  @Expose()
  endDate: Date | null;

  @Expose()
  seasonal: string | null;

  @Expose()
  itemsCount: number;

  @Expose()
  followersCount: number;

  @Expose()
  rating: number;

  @Expose()
  @Type(() => VendorSummaryDto)
  vendors?: VendorSummaryDto[]; // from CollectionVendor

  @Expose()
  @Type(() => ProductSummaryDto)
  products?: ProductSummaryDto[];

  @Expose()
  @Type(() => CollectionTagDto)
  tags?: CollectionTagDto[];

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;
}

class CollectionMetaDto {
  @Expose()
  total: number;

  @Expose()
  page: number;

  @Expose()
  limit: number;

  @Expose()
  pages: number;
}

export class CollectionsResponseDto {
  @Expose()
  data: CollectionResponseDto[] | string;

  @Expose()
  meta: CollectionMetaDto;
}
