import {
  IsString,
  IsInt,
  Min,
  Max,
  IsOptional,
  IsArray,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateReviewDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  comment?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  images?: string[];
}

export class CreateProductReviewDto extends CreateReviewDto {
  @IsUUID()
  productId: string;
}

export class CreateVendorReviewDto extends CreateReviewDto {
  @IsUUID()
  vendorId: string;
}
