import { Expose, Type } from 'class-transformer';

class CartItemVendorDto {
  @Expose()
  id: string;
  @Expose()
  name: string;
  @Expose()
  slug: string;
}

class CartItemProductDto {
  @Expose()
  id: string;
  @Expose()
  name: string;
  @Expose()
  slug: string;
  @Expose()
  price: number;
  @Expose()
  images?: { url: string; isPrimary: boolean }[];
  @Expose()
  vendor?: CartItemVendorDto;
}

class CartItemDto {
  @Expose()
  id: string;

  @Expose()
  quantity: number;

  @Expose()
  selectedSize: string | null;

  @Expose()
  selectedColor: string | null;

  @Expose()
  price: number; // Snapshot price at time of adding

  @Expose()
  total: number;

  @Expose()
  @Type(() => CartItemProductDto)
  product: CartItemProductDto;
}

export class CartResponseDto {
  @Expose()
  id: string;

  @Expose()
  total: number;

  @Expose()
  itemCount: number;

  @Expose()
  @Type(() => CartItemDto)
  items: CartItemDto[];

  @Expose()
  updatedAt: Date;
}
