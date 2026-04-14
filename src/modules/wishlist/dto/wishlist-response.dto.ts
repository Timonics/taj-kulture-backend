import { Expose } from 'class-transformer';

export class WishlistProductDto {
  @Expose()
  id: string;

  @Expose()
  name: string;

  @Expose()
  slug: string;

  @Expose()
  price: number;

  @Expose()
  originalPrice?: number | null;

  @Expose()
  discount?: number | null;

  @Expose()
  image?: string | null;

  @Expose()
  inStock: boolean;

  @Expose()
  vendorId: string;

  @Expose()
  vendorName: string;

  @Expose()
  vendorSlug: string;
}

export class WishlistResponseDto {
  @Expose()
  id: string;

  @Expose()
  userId: string;

  @Expose()
  productId: string;

  @Expose()
  notes?: string | null;

  @Expose()
  product: WishlistProductDto;

  @Expose()
  createdAt: Date;

  constructor(partial: any) {
    this.id = partial.id;
    this.userId = partial.userId;
    this.productId = partial.productId;
    this.notes = partial.notes ?? undefined;
    this.product = partial.product;
    this.createdAt = partial.createdAt;
  }
}

export class WishlistStatsDto {
  @Expose()
  totalItems: number;

  @Expose()
  totalValue: number;

  @Expose()
  itemsOnSale: number;

  @Expose()
  outOfStock: number;
}