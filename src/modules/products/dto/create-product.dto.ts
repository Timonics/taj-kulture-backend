import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
  IsInt,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsUrl,
  MinLength,
  MaxLength,
  IsObject,
  IsEnum,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ProductStatus } from 'generated/prisma/client';

class ProductImageDto {
  @IsUrl()
  @IsNotEmpty()
  url: string;

  @IsString()
  @IsOptional()
  key?: string;

  @IsString()
  @IsOptional()
  alt?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;

  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;

  @IsString()
  @IsOptional()
  colorId?: string; // link to color variant
}

class ProductFeatureDto {
  @IsString()
  @IsNotEmpty()
  description: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;
}

class ProductMaterialDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  value: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;
}

class ProductSpecificationDto {
  @IsString()
  @IsNotEmpty()
  key: string;

  @IsString()
  @IsNotEmpty()
  value: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;
}

class ProductColorDto {
  @IsString()
  @IsNotEmpty()
  colorId: string; // unique identifier (e.g., 'red')

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  hex: string;
}

class ProductSizeDto {
  @IsString()
  @IsNotEmpty()
  sizeId: string; // e.g., 's', 'm', 'l'

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsInt()
  @Min(0)
  stock: number;

  @IsBoolean()
  @IsOptional()
  isPopular?: boolean;
}

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  slug?: string; // auto-generate if not provided

  @IsString()
  @IsNotEmpty()
  @MinLength(20)
  @MaxLength(5000)
  description: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  originalPrice?: number;

  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  discount?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  cost?: number;

  @IsInt()
  @Min(0)
  stock: number;

  @IsString()
  @IsOptional()
  sku?: string;

  @IsString()
  @IsOptional()
  barcode?: string;

  @IsString()
  @IsOptional()
  categoryId?: string;

  @IsString()
  @IsOptional()
  brand?: string;

  @IsObject()
  @IsOptional()
  delivery?: Record<string, any>; // JSON field

  @IsEnum(ProductStatus)
  @IsOptional()
  status?: ProductStatus;

  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean;

  @IsBoolean()
  @IsOptional()
  isPublished?: boolean;

  @IsBoolean()
  @IsOptional()
  collectionFeatured?: boolean;

  // Nested relations
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductImageDto)
  @IsOptional()
  images?: ProductImageDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductFeatureDto)
  @IsOptional()
  features?: ProductFeatureDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductMaterialDto)
  @IsOptional()
  materials?: ProductMaterialDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductSpecificationDto)
  @IsOptional()
  specifications?: ProductSpecificationDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductColorDto)
  @IsOptional()
  colors?: ProductColorDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductSizeDto)
  @IsOptional()
  sizes?: ProductSizeDto[];
}
