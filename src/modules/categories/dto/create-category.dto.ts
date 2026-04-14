import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  MaxLength,
  IsBoolean,
  IsInt,
  Min,
  Max,
  IsUrl,
} from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  slug?: string; // if not provided, generate from name

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsUrl()
  @IsOptional()
  image?: string;

  @IsString()
  @IsOptional()
  icon?: string;

  @IsOptional()
  parentId?: string;

  // Metadata (optional)
  @IsString()
  @IsOptional()
  @MaxLength(255)
  metaTitle?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  metaDescription?: string;

  // Display settings
  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean;
}