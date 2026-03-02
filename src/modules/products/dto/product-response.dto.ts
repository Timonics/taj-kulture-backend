import { Expose, Type } from 'class-transformer';
import { ProductStatus } from 'generated/prisma/client';

class VendorInfoDto {
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

class CategoryInfoDto {
  @Expose()
  id: string;

  @Expose()
  name: string;

  @Expose()
  slug: string;
}

class ProductImageDto {
  @Expose()
  url: string;

  @Expose()
  alt: string | null;

  @Expose()
  isPrimary: boolean;

  @Expose()
  sortOrder: number;
}

class ProductFeatureDto {
  @Expose()
  description: string;

  @Expose()
  sortOrder: number;
}

class ProductMaterialDto {
  @Expose()
  name: string;

  @Expose()
  value: string;
}

class ProductSpecificationDto {
  @Expose()
  key: string;

  @Expose()
  value: string;
}

class ProductColorDto {
  @Expose()
  id: string;

  @Expose()
  colorId: string;

  @Expose()
  name: string;

  @Expose()
  hex: string;
}

class ProductSizeDto {
  @Expose()
  id: string;

  @Expose()
  sizeId: string;

  @Expose()
  name: string;

  @Expose()
  stock: number;

  @Expose()
  isPopular: boolean;
}

export class ProductResponseDto {
  @Expose()
  id: string;

  @Expose()
  name: string;

  @Expose()
  slug: string;

  @Expose()
  description: string;

  @Expose()
  price: number;

  @Expose()
  originalPrice: number | null;

  @Expose()
  discount: number | null;

  @Expose()
  stock: number;

  @Expose()
  sku: string | null;

  @Expose()
  brand: string | null;

  @Expose()
  rating: number;

  @Expose()
  reviewCount: number;

  @Expose()
  status: ProductStatus;

  @Expose()
  isFeatured: boolean;

  @Expose()
  delivery: any;

  @Expose()
  @Type(() => VendorInfoDto)
  vendor?: VendorInfoDto;

  @Expose()
  @Type(() => CategoryInfoDto)
  category?: CategoryInfoDto | null;

  @Expose()
  @Type(() => ProductImageDto)
  images?: ProductImageDto[];

  @Expose()
  @Type(() => ProductFeatureDto)
  features?: ProductFeatureDto[];

  @Expose()
  @Type(() => ProductMaterialDto)
  materials?: ProductMaterialDto[];

  @Expose()
  @Type(() => ProductSpecificationDto)
  specifications?: ProductSpecificationDto[];

  @Expose()
  @Type(() => ProductColorDto)
  colors?: ProductColorDto[];

  @Expose()
  @Type(() => ProductSizeDto)
  sizes?: ProductSizeDto[];

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;
}