import { IsUUID, IsOptional, IsString } from 'class-validator';

export class AddToWishlistDto {
  @IsUUID()
  productId: string;

  @IsString()
  @IsOptional()
  notes?: string;
}