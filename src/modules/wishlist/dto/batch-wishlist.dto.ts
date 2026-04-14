import { IsArray, IsUUID, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class BatchWishlistDto {
  @IsArray()
  @IsUUID('4', { each: true })
  @Type(() => String)
  productIds: string[];
}

export class BatchWishlistResponseDto {
  added: number;
  removed: number;
  failed: Array<{ productId: string; reason: string }>;
}
