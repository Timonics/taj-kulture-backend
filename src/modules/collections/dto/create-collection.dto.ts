import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsUrl,
  IsDateString,
  IsInt,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CollectionType } from 'generated/prisma/client';

class CollectionItemDto {
  @IsString()
  productId: string;

  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean;

  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;
}

class CollectionVendorDto {
  @IsString()
  vendorId: string;

  @IsString()
  @IsOptional()
  name?: string; // optional display name

  @IsBoolean()
  @IsOptional()
  isVerified?: boolean;
}

export class CreateCollectionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  slug?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description: string;

  @IsString()
  @IsOptional()
  @MaxLength(5000)
  story?: string;

  @IsUrl()
  @IsOptional()
  banner?: string;

  @IsUrl()
  @IsOptional()
  thumbnail?: string;

  @IsString()
  @IsOptional()
  curator?: string;

  @IsString()
  @IsOptional()
  curatorId?: string;

  @IsEnum(CollectionType)
  @IsOptional()
  type?: CollectionType;

  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean;

  @IsBoolean()
  @IsOptional()
  isLimited?: boolean;

  @IsBoolean()
  @IsOptional()
  isPublished?: boolean;

  @IsDateString()
  @IsOptional()
  launchDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsString()
  @IsOptional()
  seasonal?: string;

  // Relations
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CollectionItemDto)
  @IsOptional()
  products?: CollectionItemDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CollectionVendorDto)
  @IsOptional()
  vendors?: CollectionVendorDto[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[]; // simple strings

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  categoryIds?: string[];
}
