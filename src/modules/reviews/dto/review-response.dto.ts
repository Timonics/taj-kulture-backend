import { Expose, Exclude } from 'class-transformer';

export class ReviewUserDto {
  @Expose()
  id: string;

  @Expose()
  username: string;

  @Expose()
  firstName?: string | null;

  @Expose()
  lastName?: string | null;

  @Expose()
  avatar?: string | null;
}

export class ReviewResponseDto {
  @Expose()
  id: string;

  @Expose()
  rating: number;

  @Expose()
  title?: string | null;

  @Expose()
  comment?: string | null;

  @Expose()
  images: string[];

  @Expose()
  helpful: number;

  @Expose()
  notHelpful: number;

  @Expose()
  verified: boolean;

  @Expose()
  isEdited: boolean;

  @Expose()
  user: ReviewUserDto;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  constructor(partial: any) {
    this.id = partial.id;
    this.rating = partial.rating;
    this.title = partial.title ?? undefined;
    this.comment = partial.comment ?? undefined;
    this.images = partial.images ?? [];
    this.helpful = partial.helpful ?? 0;
    this.notHelpful = partial.notHelpful ?? 0;
    this.verified = partial.verified ?? false;
    this.isEdited = partial.isEdited ?? false;
    this.user = partial.user;
    this.createdAt = partial.createdAt;
    this.updatedAt = partial.updatedAt;
  }
}

export class ProductReviewResponseDto extends ReviewResponseDto {
  @Expose()
  productId: string;

  @Expose()
  productName: string;

  constructor(partial: any) {
    super(partial);
    this.productId = partial.productId;
    this.productName = partial.productName;
  }
}

export class VendorReviewResponseDto extends ReviewResponseDto {
  @Expose()
  vendorId: string;

  @Expose()
  vendorName: string;

  constructor(partial: any) {
    super(partial);
    this.vendorId = partial.vendorId;
    this.vendorName = partial.vendorName;
  }
}