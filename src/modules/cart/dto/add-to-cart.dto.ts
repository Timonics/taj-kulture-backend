import { IsInt, Min, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class AddToCartDto {
  @IsString()
  productId: string;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  quantity: number = 1;

  @IsString()
  @IsOptional()
  selectedSize?: string;

  @IsString()
  @IsOptional()
  selectedColor?: string;
}
