import {
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class OrderItemDto {
  @IsUUID()
  productId: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsString()
  @IsOptional()
  selectedSize?: string;

  @IsString()
  @IsOptional()
  selectedColor?: string;
}

export class CreateOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @IsUUID()
  @IsOptional()
  addressId?: string;

  @IsString()
  @IsOptional()
  shippingAddress?: any;

  @IsString()
  @IsOptional()
  customerNotes?: string;
}
