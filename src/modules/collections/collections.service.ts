import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  Logger,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';
import { slugify } from '../../shared/utils/slugify';
import { User, UserRole, CollectionType } from 'generated/prisma/client';
import { ICacheService } from 'src/shared/cache/cache.interface';
import { CACHE_KEYS } from 'src/core/constants/app.constants';

@Injectable()
export class CollectionsService {
  private readonly logger = new Logger(CollectionsService.name);

  constructor(
    private prisma: PrismaService,
    @Inject('CACHE_SERVICE') private cache: ICacheService,
  ) {}

  async getVendorIdFromUser(user: User): Promise<string | null> {
    if (user.role === UserRole.ADMIN) {
      return null; // Admin doesn't need a vendor ID for collection operations
    }

    const vendor = await this.prisma.vendor.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });

    if (!vendor) {
      throw new ForbiddenException(
        'You must be a vendor to create collections',
      );
    }

    return vendor.id;
  }

  async create(user: User, createCollectionDto: CreateCollectionDto) {
    const vendorId = await this.getVendorIdFromUser(user);

    const {
      name,
      slug: providedSlug,
      products,
      vendors,
      tags,
      categoryIds,
      ...rest
    } = createCollectionDto;

    // Generate slug if not provided
    const slug = providedSlug || slugify(name);

    // Check slug uniqueness
    const existing = await this.prisma.collection.findUnique({
      where: { slug },
    });
    if (existing) {
      throw new ConflictException('Collection with this slug already exists');
    }

    // Validate product IDs if provided (vendors can only use their own products unless admin)
    if (products && products.length > 0) {
      const productIds = products.map((p) => p.productId);

      // Check all products exist
      const existingProducts = await this.prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, vendorId: true },
      });

      if (existingProducts.length !== productIds.length) {
        throw new NotFoundException('One or more products not found');
      }

      // If not admin, ensure all products belong to this vendor
      if (user.role !== UserRole.ADMIN) {
        const invalidProducts = existingProducts.filter(
          (p) => p.vendorId !== vendorId,
        );
        if (invalidProducts.length > 0) {
          throw new ForbiddenException(
            'You can only add your own products to collections',
          );
        }
      }
    }

    // Validate vendor IDs if provided (admin only)
    if (vendors && vendors.length > 0 && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'Only admins can add multiple vendors to a collection',
      );
    }

    if (vendors && vendors.length > 0) {
      const vendorIds = vendors.map((v) => v.vendorId);
      const existingVendors = await this.prisma.vendor.findMany({
        where: { id: { in: vendorIds } },
      });
      if (existingVendors.length !== vendorIds.length) {
        throw new NotFoundException('One or more vendors not found');
      }
    }

    // Validate category IDs if provided
    if (categoryIds && categoryIds.length > 0) {
      const existingCategories = await this.prisma.category.findMany({
        where: { id: { in: categoryIds } },
      });
      if (existingCategories.length !== categoryIds.length) {
        throw new NotFoundException('One or more categories not found');
      }
    }

    // Use transaction to create collection and all nested relations
    return this.prisma.$transaction(async (tx) => {
      // Create the collection
      const collection = await tx.collection.create({
        data: {
          vendorId, // null for admin collections
          name,
          slug,
          ...rest,
          // Ensure type is set if not provided
          type: rest.type || CollectionType.CURATED,
        },
      });

      // Add products if provided
      if (products && products.length > 0) {
        await tx.collectionItem.createMany({
          data: products.map((item) => ({
            collectionId: collection.id,
            productId: item.productId,
            isFeatured: item.isFeatured ?? false,
            sortOrder: item.sortOrder ?? 0,
          })),
        });
      }

      // Add vendors if provided (admin only)
      if (vendors && vendors.length > 0) {
        await tx.collectionVendor.createMany({
          data: vendors.map((v) => ({
            collectionId: collection.id,
            vendorId: v.vendorId,
            name: v.name!,
            isVerified: v.isVerified ?? false,
          })),
        });
      }

      // Add tags if provided
      if (tags && tags.length > 0) {
        await tx.collectionTag.createMany({
          data: tags.map((tag) => ({
            collectionId: collection.id,
            tag,
          })),
        });
      }

      // Add categories if provided
      if (categoryIds && categoryIds.length > 0) {
        await tx.collectionCategory.createMany({
          data: categoryIds.map((categoryId) => ({
            collectionId: collection.id,
            categoryId,
          })),
        });
      }

      // Update itemsCount
      if (products && products.length > 0) {
        await tx.collection.update({
          where: { id: collection.id },
          data: { itemsCount: products.length },
        });
      }

      await this.cache.deleteByTag(CACHE_KEYS.COLLECTIONS());

      // Return created collection with all relations
      return tx.collection.findUnique({
        where: { id: collection.id },
        include: {
          vendor: true,
          products: {
            include: {
              product: {
                include: {
                  images: { where: { isPrimary: true }, take: 1 },
                },
              },
            },
          },
          vendors: { include: { vendor: true } },
          tags: true,
          categories: { include: { category: true } },
        },
      });
    });
  }

  async findAll(query: any) {
    const cacheKey = CACHE_KEYS.COLLECTIONS(query);
    return await this.cache.getOrSet(
      cacheKey,
      async () => {
        const {
          page = 1,
          limit = 20,
          type,
          vendorId,
          isFeatured,
          isLimited,
          search,
          sortBy = 'createdAt',
          sortOrder = 'desc',
        } = query;

        const where: any = {
          // Only show published collections by default
          isPublished: true,
        };

        if (type) where.type = type;
        if (vendorId) where.vendorId = vendorId;
        if (isFeatured !== undefined) where.isFeatured = isFeatured === 'true';
        if (isLimited !== undefined) where.isLimited = isLimited === 'true';

        if (search) {
          where.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
            { story: { contains: search, mode: 'insensitive' } },
          ];
        }

        // For admin views, we might want to include unpublished
        // We'll handle that in the controller with a separate param

        const [collections, total] = await Promise.all([
          this.prisma.collection.findMany({
            where,
            include: {
              vendor: {
                select: { id: true, name: true, slug: true, logo: true },
              },
              tags: true,
              _count: {
                select: { products: true },
              },
            },
            orderBy: { [sortBy]: sortOrder },
            skip: (page - 1) * limit,
            take: +limit,
          }),
          this.prisma.collection.count({ where }),
        ]);

        return {
          data: collections,
          meta: { total, page, limit, pages: Math.ceil(total / limit) },
        };
      },
      {
        ttl: 300,
        tags: [CACHE_KEYS.COLLECTIONS(query), CACHE_KEYS.COLLECTIONS()],
      },
    );
  }

  async findOne(slug: string) {
    const cacheKey = CACHE_KEYS.COLLECTION(slug);

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        const collection = await this.prisma.collection.findUnique({
          where: { slug },
          include: {
            vendor: true,
            products: {
              orderBy: [{ isFeatured: 'desc' }, { sortOrder: 'asc' }],
              include: {
                product: {
                  include: {
                    vendor: { select: { id: true, name: true, slug: true } },
                    images: { orderBy: { sortOrder: 'asc' } },
                    category: true,
                  },
                },
              },
            },
            vendors: {
              include: {
                vendor: {
                  include: {
                    _count: {
                      select: { products: true, followers: true },
                    },
                  },
                },
              },
            },
            tags: true,
            categories: { include: { category: true } },
          },
        });

        if (!collection) {
          throw new NotFoundException('Collection not found');
        }

        // Format the response to make it cleaner
        return {
          ...collection,
          products: collection.products.map((item) => ({
            ...item.product,
            isFeatured: item.isFeatured,
            sortOrder: item.sortOrder,
          })),
        };
      },
      {
        ttl: 600,
        tags: [CACHE_KEYS.COLLECTION(slug)],
      },
    );
  }

  async update(
    user: User,
    id: string,
    updateCollectionDto: UpdateCollectionDto,
  ) {
    const collection = await this.prisma.collection.findUnique({
      where: { id },
      include: {
        products: true,
        vendors: true,
        tags: true,
        categories: true,
      },
    });

    if (!collection) {
      throw new NotFoundException('Collection not found');
    }

    // Check permissions
    if (user.role !== UserRole.ADMIN) {
      const vendorId = await this.getVendorIdFromUser(user);
      if (collection.vendorId !== vendorId) {
        throw new ForbiddenException(
          'You can only update your own collections',
        );
      }
    }

    const {
      name,
      slug: newSlug,
      products,
      vendors,
      tags,
      categoryIds,
      ...rest
    } = updateCollectionDto;

    // Handle slug change
    if (newSlug && newSlug !== collection.slug) {
      const existing = await this.prisma.collection.findUnique({
        where: { slug: newSlug },
      });
      if (existing) {
        throw new ConflictException('Collection with this slug already exists');
      }
    }

    // If name changed and no slug provided, generate new slug
    let finalSlug = newSlug;
    if (name && name !== collection.name && !newSlug) {
      finalSlug = slugify(name);
      const existing = await this.prisma.collection.findUnique({
        where: { slug: finalSlug },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException('Generated slug already exists');
      }
    }

    // Validate products if provided (similar to create)
    if (products) {
      // Similar validation as in create...
      // (We'll implement this similarly to create method)
    }

    // Use transaction for update
    return this.prisma.$transaction(async (tx) => {
      // Update basic info
      await tx.collection.update({
        where: { id },
        data: {
          name,
          slug: finalSlug,
          ...rest,
        },
      });

      // Replace products if provided
      if (products !== undefined) {
        await tx.collectionItem.deleteMany({ where: { collectionId: id } });
        if (products.length > 0) {
          await tx.collectionItem.createMany({
            data: products.map((item) => ({
              collectionId: id,
              productId: item.productId,
              isFeatured: item.isFeatured ?? false,
              sortOrder: item.sortOrder ?? 0,
            })),
          });
        }
      }

      // Replace vendors if provided (admin only)
      if (vendors !== undefined) {
        if (vendors.length > 0 && user.role !== UserRole.ADMIN) {
          throw new ForbiddenException('Only admins can update vendors');
        }
        await tx.collectionVendor.deleteMany({ where: { collectionId: id } });
        if (vendors.length > 0) {
          await tx.collectionVendor.createMany({
            data: vendors.map((v) => ({
              collectionId: id,
              vendorId: v.vendorId,
              name: v.name!,
              isVerified: v.isVerified ?? false,
            })),
          });
        }
      }

      // Replace tags if provided
      if (tags !== undefined) {
        await tx.collectionTag.deleteMany({ where: { collectionId: id } });
        if (tags.length > 0) {
          await tx.collectionTag.createMany({
            data: tags.map((tag) => ({
              collectionId: id,
              tag,
            })),
          });
        }
      }

      // Replace categories if provided
      if (categoryIds !== undefined) {
        await tx.collectionCategory.deleteMany({ where: { collectionId: id } });
        if (categoryIds.length > 0) {
          await tx.collectionCategory.createMany({
            data: categoryIds.map((categoryId) => ({
              collectionId: id,
              categoryId,
            })),
          });
        }
      }

      // Update itemsCount based on new products
      if (products !== undefined) {
        await tx.collection.update({
          where: { id },
          data: { itemsCount: products.length },
        });
      }

      await Promise.all([
        this.cache.delete(CACHE_KEYS.COLLECTION(collection.slug)),
        this.cache.deleteByTag(CACHE_KEYS.COLLECTIONS()),
      ]);

      // Return updated collection
      return tx.collection.findUnique({
        where: { id },
        include: {
          vendor: true,
          products: { include: { product: true } },
          vendors: { include: { vendor: true } },
          tags: true,
          categories: { include: { category: true } },
        },
      });
    });
  }

  async remove(user: User, id: string) {
    const collection = await this.prisma.collection.findUnique({
      where: { id },
    });

    if (!collection) {
      throw new NotFoundException('Collection not found');
    }

    // Check permissions
    if (user.role !== UserRole.ADMIN) {
      const vendorId = await this.getVendorIdFromUser(user);
      if (collection.vendorId !== vendorId) {
        throw new ForbiddenException(
          'You can only delete your own collections',
        );
      }
    }

    // Delete (cascading deletes handled by Prisma schema)
    await this.prisma.collection.delete({ where: { id } });

    await Promise.all([
      this.cache.delete(CACHE_KEYS.COLLECTION(collection.slug)),
      this.cache.deleteByTag(CACHE_KEYS.COLLECTIONS()),
    ]);

    return { message: 'Collection deleted successfully' };
  }

  async adminUpdate(
    id: string,
    data: { isFeatured?: boolean; isPublished?: boolean },
  ) {
    const collection = await this.prisma.collection.findUnique({
      where: { id },
    });

    if (!collection) {
      throw new NotFoundException('Collection not found');
    }

    await Promise.all([
      this.cache.delete(CACHE_KEYS.COLLECTION(collection.slug)),
      this.cache.deleteByTag(CACHE_KEYS.COLLECTIONS()),
    ]);

    return this.prisma.collection.update({
      where: { id },
      data,
    });
  }
}
