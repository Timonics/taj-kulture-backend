import { Expose, Type } from 'class-transformer';

export class CategoryResponseDto {
  @Expose()
  id: string;

  @Expose()
  name: string;

  @Expose()
  slug: string;

  @Expose()
  description: string | null;

  @Expose()
  image: string | null;

  @Expose()
  icon: string | null;

  @Expose()
  level: number;

  @Expose()
  path: string | null;

  @Expose()
  pathIds: string[];

  @Expose()
  metaTitle: string | null;

  @Expose()
  metaDescription: string | null;

  @Expose()
  sortOrder: number;

  @Expose()
  isActive: boolean;

  @Expose()
  isFeatured: boolean;

  @Expose()
  productCount: number;

  @Expose()
  @Type(() => CategoryResponseDto)
  parent?: CategoryResponseDto | null;

  @Expose()
  @Type(() => CategoryResponseDto)
  children?: CategoryResponseDto[];

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;
}