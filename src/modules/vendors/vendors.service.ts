import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { ApplyVendorDto } from './dto/apply-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { AdminUpdateVendorDto } from './dto/admin-update-vendor.dto';
import { slugify } from '../../shared/utils/slugify';
import { User, VerificationStatus } from 'generated/prisma/client';
import { instanceToPlain } from 'class-transformer';
import { ICacheService } from 'src/shared/cache/cache.interface';
import { CACHE_KEYS } from 'src/core/constants/app.constants';

@Injectable()
export class VendorsService {
  constructor(
    private prisma: PrismaService,
    @Inject('CACHE_SERVICE') private cache: ICacheService,
  ) {}

  async apply(user: User, applyVendorDto: ApplyVendorDto) {
    // Check if user already has a vendor profile
    const existingVendor = await this.prisma.vendor.findUnique({
      where: { userId: user.id },
    });
    if (existingVendor) {
      throw new ConflictException('You already have a vendor profile');
    }

    const {
      name,
      slug: providedSlug,
      categoryIds,
      social,
      policies,
      culturalHeritage,
      ...rest
    } = applyVendorDto;

    // Generate slug if not provided
    const slug = providedSlug || slugify(name);

    // Check slug uniqueness
    const slugExists = await this.prisma.vendor.findUnique({
      where: { slug },
    });
    if (slugExists) {
      throw new ConflictException('Vendor with this slug already exists');
    }

    // If categoryIds provided, verify they exist
    if (categoryIds && categoryIds.length > 0) {
      const categories = await this.prisma.category.findMany({
        where: { id: { in: categoryIds } },
      });
      if (categories.length !== categoryIds.length) {
        throw new BadRequestException('One or more category IDs are invalid');
      }
    }

    const socialPlain = social ? instanceToPlain(social) : {};
    const policiesPlain = policies ? instanceToPlain(policies) : {};
    const culturalHeritagePlain = culturalHeritage
      ? instanceToPlain(culturalHeritage)
      : {};

    // Create vendor with pending status
    const vendor = await this.prisma.vendor.create({
      data: {
        userId: user.id,
        name,
        slug,
        ...rest,
        social: socialPlain,
        policies: policiesPlain,
        culturalHeritage: culturalHeritagePlain,
        verificationStatus: VerificationStatus.PENDING,
        // Connect categories if provided
        categories: categoryIds
          ? {
              create: categoryIds.map((catId) => ({
                category: { connect: { id: catId } },
              })),
            }
          : undefined,
      },
      include: {
        categories: { include: { category: true } },
      },
    });

    // Optionally emit event: vendor.applied
    // await this.eventBus.emit(VENDOR_EVENTS.APPLIED, { vendorId: vendor.id, userId: user.id });

    await this.cache.deleteByTag(CACHE_KEYS.VENDORS());

    return vendor;
  }

  async findAll(query: any) {
    const cacheKey = CACHE_KEYS.VENDORS(query);

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        const {
          page = 1,
          limit = 20,
          isVerified,
          isFeatured,
          categoryId,
          search,
          sortBy = 'rating',
          sortOrder = 'desc',
        } = query;

        const where: any = {};

        if (isVerified !== undefined) where.isVerified = isVerified === 'true';
        if (isFeatured !== undefined) where.isFeatured = isFeatured === 'true';
        if (categoryId) {
          where.categories = {
            some: { categoryId },
          };
        }
        if (search) {
          where.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ];
        }

        const [vendors, total] = await Promise.all([
          this.prisma.vendor.findMany({
            where,
            include: {
              user: { select: { id: true, username: true, avatar: true } },
              categories: { include: { category: true } },
              badges: true,
              _count: {
                select: { products: true, followers: true, reviews: true },
              },
            },
            orderBy: { [sortBy]: sortOrder },
            skip: (page - 1) * limit,
            take: +limit,
          }),
          this.prisma.vendor.count({ where }),
        ]);

        return {
          data: vendors,
          meta: { total, page, limit, pages: Math.ceil(total / limit) },
        };
      },
      {
        ttl: 300,
        tags: [CACHE_KEYS.VENDORS(query), CACHE_KEYS.VENDORS()],
      },
    );
  }

  async findOne(slug: string) {
    const cacheKey = CACHE_KEYS.VENDOR(slug);

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        const vendor = await this.prisma.vendor.findUnique({
          where: { slug },
          include: {
            user: { select: { id: true, username: true, avatar: true } },
            categories: { include: { category: true } },
            badges: true,
            products: {
              where: { status: 'PUBLISHED', isPublished: true },
              take: 8,
              orderBy: { createdAt: 'desc' },
              include: {
                images: { where: { isPrimary: true }, take: 1 },
              },
            },
            reviews: {
              take: 5,
              orderBy: { createdAt: 'desc' },
              include: { user: { select: { username: true, avatar: true } } },
            },
          },
        });

        if (!vendor) {
          throw new NotFoundException('Vendor not found');
        }

        return vendor;
      },
      {
        ttl: 600, // 10 minutes
        tags: [CACHE_KEYS.VENDORS(), CACHE_KEYS.VENDOR(slug)],
      },
    );
  }

  async findMyVendor(userId: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { userId },
      include: {
        categories: { include: { category: true } },
        badges: true,
        products: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: { images: true },
        },
      },
    });

    if (!vendor) {
      throw new NotFoundException('You do not have a vendor profile');
    }

    return vendor;
  }

  async updateMyVendor(userId: string, updateVendorDto: UpdateVendorDto) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { userId },
    });
    if (!vendor) {
      throw new NotFoundException('Vendor profile not found');
    }

    // If trying to change slug, check uniqueness
    if (updateVendorDto.slug && updateVendorDto.slug !== vendor.slug) {
      const slugExists = await this.prisma.vendor.findUnique({
        where: { slug: updateVendorDto.slug },
      });
      if (slugExists) {
        throw new ConflictException('Vendor with this slug already exists');
      }
    }

    // Handle category updates if provided
    const { categoryIds, ...rest } = updateVendorDto;

    // Use transaction to update vendor and categories
    return this.prisma.$transaction(async (tx) => {
      if (categoryIds) {
        // First disconnect all existing categories
        await tx.vendorCategory.deleteMany({
          where: { vendorId: vendor.id },
        });
        // Then connect new ones
        if (categoryIds.length > 0) {
          await tx.vendorCategory.createMany({
            data: categoryIds.map((catId) => ({
              vendorId: vendor.id,
              categoryId: catId,
            })),
          });
        }
      }

      const socialPlain = rest.social ? instanceToPlain(rest.social) : {};
      const policiesPlain = rest.policies ? instanceToPlain(rest.policies) : {};
      const culturalHeritagePlain = rest.culturalHeritage
        ? instanceToPlain(rest.culturalHeritage)
        : {};

      const updated = await tx.vendor.update({
        where: { id: vendor.id },
        data: {
          ...rest,
          social: socialPlain,
          policies: policiesPlain,
          culturalHeritage: culturalHeritagePlain,
        },
        include: {
          categories: { include: { category: true } },
          badges: true,
        },
      });

      await Promise.all([
        this.cache.delete(CACHE_KEYS.VENDOR(vendor.slug)),
        this.cache.delete(CACHE_KEYS.VENDOR_STATS(vendor.id)),
        this.cache.delete(CACHE_KEYS.VENDOR_FOLLOWERS(vendor.id)),
        this.cache.deleteByTag(CACHE_KEYS.VENDORS()),
      ]);

      return updated;
    });
  }

  // Admin endpoints
  async adminUpdate(id: string, adminUpdateDto: AdminUpdateVendorDto) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id },
    });
    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    const updated = await this.prisma.vendor.update({
      where: { id },
      data: adminUpdateDto,
      include: {
        user: true,
        categories: { include: { category: true } },
        badges: true,
      },
    });

    // Emit events if verification status changed
    // if (adminUpdateDto.verificationStatus && adminUpdateDto.verificationStatus !== vendor.verificationStatus) {
    //   await this.eventBus.emit(VENDOR_EVENTS.VERIFICATION_UPDATED, {
    //     vendorId: vendor.id,
    //     status: adminUpdateDto.verificationStatus,
    //   });
    // }

    return updated;
  }

  async deleteVendor(id: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id },
    });
    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    await Promise.all([
      this.cache.delete(CACHE_KEYS.VENDOR(vendor.slug)),
      this.cache.delete(CACHE_KEYS.VENDOR_STATS(vendor.id)),
      this.cache.delete(CACHE_KEYS.VENDOR_FOLLOWERS(vendor.id)),
      this.cache.deleteByTag(CACHE_KEYS.VENDORS()),
    ]);

    // Consider: should we also delete related data? Cascade is set in schema.
    return this.prisma.vendor.delete({ where: { id } });
  }

  // Follow/unfollow
  async follow(vendorId: string, userId: string) {
    // Check if vendor exists
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: vendorId },
    });
    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    // Check if already following
    const existing = await this.prisma.vendorFollow.findUnique({
      where: {
        vendorId_userId: { vendorId, userId },
      },
    });
    if (existing) {
      throw new ConflictException('Already following this vendor');
    }

    await this.prisma.$transaction([
      this.prisma.vendorFollow.create({
        data: { vendorId, userId },
      }),
      this.prisma.vendor.update({
        where: { id: vendorId },
        data: { followersCount: { increment: 1 } },
      }),
    ]);

    return { message: 'Vendor followed successfully' };
  }

  async unfollow(vendorId: string, userId: string) {
    const existing = await this.prisma.vendorFollow.findUnique({
      where: {
        vendorId_userId: { vendorId, userId },
      },
    });
    if (!existing) {
      throw new NotFoundException('Not following this vendor');
    }

    await this.prisma.$transaction([
      this.prisma.vendorFollow.delete({
        where: { id: existing.id },
      }),
      this.prisma.vendor.update({
        where: { id: vendorId },
        data: { followersCount: { decrement: 1 } },
      }),
    ]);

    return { message: 'Vendor unfollowed successfully' };
  }

  // Get followers list
  async getFollowers(vendorId: string, page = 1, limit = 20) {
    const cacheKey = CACHE_KEYS.VENDOR_FOLLOWERS(vendorId);

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        const vendor = await this.prisma.vendor.findUnique({
          where: { id: vendorId },
        });
        if (!vendor) {
          throw new NotFoundException('Vendor not found');
        }

        const [followers, total] = await Promise.all([
          this.prisma.vendorFollow.findMany({
            where: { vendorId },
            include: {
              user: { select: { id: true, username: true, avatar: true } },
            },
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { createdAt: 'desc' },
          }),
          this.prisma.vendorFollow.count({ where: { vendorId } }),
        ]);

        return {
          data: followers.map((f) => f.user),
          meta: { total, page, limit, pages: Math.ceil(total / limit) },
        };
      },
      {
        ttl: 300,
        tags: [
          CACHE_KEYS.VENDOR_FOLLOWERS(vendorId),
          CACHE_KEYS.VENDOR(vendorId),
        ],
      },
    );
  }
}
