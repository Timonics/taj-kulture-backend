import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Logger,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { slugify } from '../../shared/utils/slugify';
import { User, UserRole, ProductStatus } from 'generated/prisma/client';
import { instanceToPlain } from 'class-transformer';
import { UploadService } from 'src/shared/upload/upload.service';
import { ProductResponseDto } from './dto/product-response.dto';
import { ICacheService } from 'src/shared/cache/cache.interface';
import { CACHE_KEYS } from 'src/core/constants/app.constants';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private prisma: PrismaService,
    private uploadService: UploadService,
    @Inject('CACHE_SERVICE') private cache: ICacheService,
  ) {}

  // Helper to ensure user has vendor rights
  private async getVendorFromUser(user: User) {
    if (user.role === UserRole.ADMIN) {
      // Admin can act on behalf of any vendor? For simplicity, allow admin to pass vendorId? We'll handle differently.
      // For now, assume vendor actions require a vendor profile.
      const vendor = await this.prisma.vendor.findUnique({
        where: { userId: user.id },
      });
      if (!vendor) {
        throw new ForbiddenException('You do not have a vendor profile');
      }
      return vendor;
    }
    // If not admin, must have vendor profile
    const vendor = await this.prisma.vendor.findUnique({
      where: { userId: user.id },
    });
    if (!vendor) {
      throw new ForbiddenException('You do not have a vendor profile');
    }
    return vendor;
  }

  async create(
    user: User,
    createProductDto: CreateProductDto,
  ): Promise<ProductResponseDto | null> {
    const vendor = await this.getVendorFromUser(user);

    const {
      name,
      slug: providedSlug,
      categoryId,
      images,
      features,
      materials,
      specifications,
      colors,
      sizes,
      delivery,
      ...rest
    } = createProductDto;

    // Generate slug if not provided
    const slug = providedSlug || slugify(name);

    // Check slug uniqueness
    const existing = await this.prisma.product.findUnique({
      where: { slug },
    });
    if (existing) {
      throw new ConflictException('Product with this slug already exists');
    }

    // If categoryId provided, verify existence
    if (categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: categoryId },
      });
      if (!category) {
        throw new NotFoundException('Category not found');
      }
    }

    // Prepare delivery JSON if provided
    const deliveryPlain = delivery ? instanceToPlain(delivery) : undefined;

    // Use transaction to create product and all nested relations
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          vendorId: vendor.id,
          name,
          slug,
          categoryId,
          delivery: deliveryPlain || {},
          ...rest,
        },
      });

      // Create nested relations if provided
      if (images && images.length > 0) {
        await tx.productImage.createMany({
          data: images.map((img) => ({
            url: img.url,
            key: img.key, // <-- store key
            alt: img.alt,
            sortOrder: img.sortOrder ?? 0,
            isPrimary: img.isPrimary ?? false,
            colorId: img.colorId,
            productId: product.id,
          })),
        });
      }

      if (features && features.length > 0) {
        await tx.productFeature.createMany({
          data: features.map((feat) => ({
            ...feat,
            productId: product.id,
          })),
        });
      }

      if (materials && materials.length > 0) {
        await tx.productMaterial.createMany({
          data: materials.map((mat) => ({
            ...mat,
            productId: product.id,
          })),
        });
      }

      if (specifications && specifications.length > 0) {
        await tx.productSpecification.createMany({
          data: specifications.map((spec) => ({
            ...spec,
            productId: product.id,
          })),
        });
      }

      if (colors && colors.length > 0) {
        await tx.productColor.createMany({
          data: colors.map((col) => ({
            ...col,
            productId: product.id,
          })),
        });
      }

      if (sizes && sizes.length > 0) {
        await tx.productSize.createMany({
          data: sizes.map((sz) => ({
            ...sz,
            productId: product.id,
          })),
        });
      }

      await Promise.all([
        this.cache.deleteByTag(CACHE_KEYS.PRODUCTS()),
        this.cache.deleteByTag(CACHE_KEYS.VENDORS({ id: vendor.id })),
        this.cache.delete(CACHE_KEYS.FEATURED_PRODUCTS),
      ]);

      // Return created product with all relations
      return tx.product.findUnique({
        where: { id: product.id },
        include: {
          vendor: true,
          category: true,
          images: { orderBy: { sortOrder: 'asc' } },
          features: { orderBy: { sortOrder: 'asc' } },
          materials: { orderBy: { sortOrder: 'asc' } },
          specifications: { orderBy: { sortOrder: 'asc' } },
          colors: true,
          sizes: true,
        },
      });
    });
  }

  async findAll(query: any) {
    const cacheKey = CACHE_KEYS.PRODUCTS(query);

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        const {
          page = 1,
          limit = 20,
          categoryId,
          vendorId,
          minPrice,
          maxPrice,
          status,
          isFeatured,
          search,
          sortBy = 'createdAt',
          sortOrder = 'desc',
        } = query;

        const where: any = {};

        if (categoryId) where.categoryId = categoryId;
        if (vendorId) where.vendorId = vendorId;
        if (status) where.status = status;
        if (isFeatured !== undefined) where.isFeatured = isFeatured === 'true';
        if (minPrice !== undefined || maxPrice !== undefined) {
          where.price = {};
          if (minPrice) where.price.gte = +minPrice;
          if (maxPrice) where.price.lte = +maxPrice;
        }
        if (search) {
          where.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
            { brand: { contains: search, mode: 'insensitive' } },
          ];
        }

        // Optionally filter only published products for public endpoints
        // For vendor dashboard, they might want to see drafts etc. We'll handle in controller.

        const [products, total] = await Promise.all([
          this.prisma.product.findMany({
            where,
            include: {
              vendor: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  logo: true,
                  isVerified: true,
                },
              },
              category: { select: { id: true, name: true, slug: true } },
              images: { where: { isPrimary: true }, take: 1 },
              _count: {
                select: { reviews: true },
              },
            },
            orderBy: { [sortBy]: sortOrder },
            skip: (page - 1) * limit,
            take: +limit,
          }),
          this.prisma.product.count({ where }),
        ]);

        return {
          data: products,
          meta: { total, page, limit, pages: Math.ceil(total / limit) },
        };
      },
      {
        ttl: 300,
        tags: [CACHE_KEYS.PRODUCTS()],
      },
    );
  }

  async findOne(slug: string) {
    const cacheKey = CACHE_KEYS.PRODUCT(slug);

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        const product = await this.prisma.product.findUnique({
          where: { slug },
          include: {
            vendor: {
              select: {
                id: true,
                name: true,
                slug: true,
                logo: true,
                isVerified: true,
                rating: true,
                reviewCount: true,
              },
            },
            category: true,
            images: { orderBy: { sortOrder: 'asc' } },
            features: { orderBy: { sortOrder: 'asc' } },
            materials: { orderBy: { sortOrder: 'asc' } },
            specifications: { orderBy: { sortOrder: 'asc' } },
            colors: true,
            sizes: true,
            reviews: {
              take: 5,
              orderBy: { createdAt: 'desc' },
              include: { user: { select: { username: true, avatar: true } } },
            },
          },
        });

        if (!product) {
          throw new NotFoundException('Product not found');
        }

        return product;
      },
      {
        ttl: 600, // 10 minutes for product details
        tags: [CACHE_KEYS.PRODUCT(slug), CACHE_KEYS.PRODUCTS()],
      },
    );
  }

  async update(user: User, id: string, updateProductDto: UpdateProductDto) {
    const vendor = await this.getVendorFromUser(user);

    const product = await this.prisma.product.findUnique({
      where: { id },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Ensure vendor owns this product
    if (product.vendorId !== vendor.id && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('You can only update your own products');
    }

    const {
      name,
      slug: newSlug,
      categoryId,
      images,
      features,
      materials,
      specifications,
      colors,
      sizes,
      delivery,
      ...rest
    } = updateProductDto;

    // Handle slug change
    if (newSlug && newSlug !== product.slug) {
      const existing = await this.prisma.product.findUnique({
        where: { slug: newSlug },
      });
      if (existing) {
        throw new ConflictException('Product with this slug already exists');
      }
    }

    // If name changed and no slug provided, generate new slug
    let finalSlug = newSlug;
    if (name && name !== product.name && !newSlug) {
      finalSlug = slugify(name);
      const existing = await this.prisma.product.findUnique({
        where: { slug: finalSlug },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException('Generated slug already exists');
      }
    }

    // Verify category
    if (categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: categoryId },
      });
      if (!category) {
        throw new NotFoundException('Category not found');
      }
    }

    const deliveryPlain = delivery ? instanceToPlain(delivery) : undefined;

    // Use transaction to update product and all nested relations
    return this.prisma.$transaction(async (tx) => {
      // Update product basic info
      await tx.product.update({
        where: { id },
        data: {
          name,
          slug: finalSlug,
          categoryId,
          delivery: deliveryPlain,
          ...rest,
        },
      });

      if (images !== undefined) {
        // Fetch old images to delete from S3
        const oldImages = await tx.productImage.findMany({
          where: { productId: id },
          select: { key: true },
        });

        // Delete from DB
        await tx.productImage.deleteMany({ where: { productId: id } });

        // Queue S3 deletion (non-blocking)
        if (oldImages.length > 0) {
          const keysToDelete = oldImages
            .map((img) => img.key)
            .filter((key) => key !== null) as string[];
          if (keysToDelete.length > 0) {
            Promise.allSettled(
              keysToDelete.map((key) => this.uploadService.deleteFile(key)),
            ).catch((err) =>
              this.logger.error('Failed to delete old images from S3', err),
            );
          }
        }

        // Create new images
        if (images.length > 0) {
          await tx.productImage.createMany({
            data: images.map((img) => ({
              url: img.url,
              key: img.key,
              alt: img.alt,
              sortOrder: img.sortOrder ?? 0,
              isPrimary: img.isPrimary ?? false,
              colorId: img.colorId,
              productId: id,
            })),
          });
        }
      }

      if (features !== undefined) {
        await tx.productFeature.deleteMany({ where: { productId: id } });
        if (features.length > 0) {
          await tx.productFeature.createMany({
            data: features.map((feat) => ({ ...feat, productId: id })),
          });
        }
      }

      if (materials !== undefined) {
        await tx.productMaterial.deleteMany({ where: { productId: id } });
        if (materials.length > 0) {
          await tx.productMaterial.createMany({
            data: materials.map((mat) => ({ ...mat, productId: id })),
          });
        }
      }

      if (specifications !== undefined) {
        await tx.productSpecification.deleteMany({ where: { productId: id } });
        if (specifications.length > 0) {
          await tx.productSpecification.createMany({
            data: specifications.map((spec) => ({ ...spec, productId: id })),
          });
        }
      }

      if (colors !== undefined) {
        await tx.productColor.deleteMany({ where: { productId: id } });
        if (colors.length > 0) {
          await tx.productColor.createMany({
            data: colors.map((col) => ({ ...col, productId: id })),
          });
        }
      }

      if (sizes !== undefined) {
        await tx.productSize.deleteMany({ where: { productId: id } });
        if (sizes.length > 0) {
          await tx.productSize.createMany({
            data: sizes.map((sz) => ({ ...sz, productId: id })),
          });
        }
      }

      await Promise.all([
        this.cache.delete(CACHE_KEYS.PRODUCT(product.slug)),
        this.cache.delete(CACHE_KEYS.PRODUCT(id)),
        this.cache.deleteByTag(CACHE_KEYS.PRODUCTS()),
        this.cache.deleteByTag(CACHE_KEYS.VENDORS({ id: product.vendorId })),
        this.cache.delete(CACHE_KEYS.FEATURED_PRODUCTS),
      ]);

      // Return updated product with all relations
      return tx.product.findUnique({
        where: { id },
        include: {
          vendor: true,
          category: true,
          images: { orderBy: { sortOrder: 'asc' } },
          features: { orderBy: { sortOrder: 'asc' } },
          materials: { orderBy: { sortOrder: 'asc' } },
          specifications: { orderBy: { sortOrder: 'asc' } },
          colors: true,
          sizes: true,
        },
      });
    });
  }

  async remove(user: User, id: string) {
    const vendor = await this.getVendorFromUser(user);

    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { images: { select: { key: true } } },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (product.vendorId !== vendor.id && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('You can only delete your own products');
    }

    // Delete from DB (cascades to images)
    await this.prisma.product.delete({ where: { id } });

    // Delete images from S3 asynchronously
    const keysToDelete = product.images
      .map((img) => img.key)
      .filter((key) => key !== null) as string[];
    if (keysToDelete.length > 0) {
      Promise.allSettled(
        keysToDelete.map((key) => this.uploadService.deleteFile(key)),
      ).catch((err) =>
        this.logger.error('Failed to delete product images from S3', err),
      );
    }

    await Promise.all([
      this.cache.delete(CACHE_KEYS.PRODUCT(product.slug)),
      this.cache.delete(CACHE_KEYS.PRODUCT(id)),
      this.cache.deleteByTag(CACHE_KEYS.PRODUCTS()),
      this.cache.deleteByTag(CACHE_KEYS.VENDORS({ id: product.vendorId })),
      this.cache.delete(CACHE_KEYS.FEATURED_PRODUCTS),
    ]);

    return { message: 'Product deleted successfully' };
  }

  async getFeaturedProducts() {
    return this.cache.getOrSet(
      CACHE_KEYS.FEATURED_PRODUCTS,
      async () => {
        return this.prisma.product.findMany({
          where: {
            isFeatured: true,
            status: 'PUBLISHED',
            isPublished: true,
          },
          take: 10,
          include: {
            images: { where: { isPrimary: true }, take: 1 },
            vendor: { select: { name: true, slug: true } },
          },
        });
      },
      {
        ttl: 1800, // 30 minutes
        tags: [CACHE_KEYS.PRODUCTS(), CACHE_KEYS.FEATURED_PRODUCTS],
      },
    );
  }

  // Additional method: update stock (e.g., after order)
  async updateStock(id: string, quantity: number) {
    return this.prisma.product.update({
      where: { id },
      data: { stock: { increment: quantity } }, // negative for reduction
    });
  }

  async getVendorIdFromUser(user: User): Promise<string> {
    const vendor = await this.prisma.vendor.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!vendor) {
      throw new ForbiddenException('You are not a vendor');
    }
    return vendor.id;
  }
}
