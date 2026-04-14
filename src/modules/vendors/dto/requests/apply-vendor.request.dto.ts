import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUrl,
  IsArray,
  ValidateNested,
  IsObject,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

class SocialLinksDto {
  @IsUrl()
  @IsOptional()
  instagram?: string;

  @IsUrl()
  @IsOptional()
  twitter?: string;

  @IsUrl()
  @IsOptional()
  facebook?: string;

  @IsUrl()
  @IsOptional()
  youtube?: string;

  @IsUrl()
  @IsOptional()
  website?: string;
}

class PoliciesDto {
  @IsString()
  @IsOptional()
  shipping?: string;

  @IsString()
  @IsOptional()
  returns?: string;

  @IsString()
  @IsOptional()
  sustainability?: string;
}

class CulturalHeritageDto {
  @IsString()
  @IsOptional()
  region?: string;

  @IsString()
  @IsOptional()
  craftType?: string;

  @IsString()
  @IsOptional()
  artisanSupport?: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class ApplyVendorRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  slug?: string; // if not provided, generate from name

  @IsUrl()
  @IsOptional()
  logo?: string;

  @IsUrl()
  @IsOptional()
  banner?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  story?: string;

  @IsString()
  @IsOptional()
  location?: string;

  @IsString()
  @IsOptional()
  established?: string; // e.g., "2015"

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  categoryIds?: string[]; // IDs of categories the vendor belongs to

  @IsObject()
  @ValidateNested()
  @Type(() => SocialLinksDto)
  @IsOptional()
  social?: SocialLinksDto;

  @IsObject()
  @ValidateNested()
  @Type(() => PoliciesDto)
  @IsOptional()
  policies?: PoliciesDto;

  @IsObject()
  @ValidateNested()
  @Type(() => CulturalHeritageDto)
  @IsOptional()
  culturalHeritage?: CulturalHeritageDto;
}