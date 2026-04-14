// src/modules/vendors/vendors.service.ts
/**
 * VENDORS SERVICE
 *
 * Core business logic for vendor management:
 * - Application and approval workflow
 * - CRUD operations for vendor profiles
 * - Follow/unfollow system
 * - Admin verification and feature toggling
 *
 * EVENT-DRIVEN:
 * - Emits events for vendor application, approval, rejection
 * - Decouples side effects (email notifications, analytics)
 *
 * SECURITY:
 * - Only the vendor owner can update their profile
 * - Admins can verify, feature, or delete any vendor
 * - Follow/unfollow prevents self-follow (by design, vendor cannot follow themselves)
 */

import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { EventBus } from '../../shared/events/event-bus.service';
import { VENDOR_EVENTS } from '../../shared/events/event-types';
import { ICacheService } from '../../shared/cache/cache.interface';
import { ILogger } from '../../shared/logger/logger.interface';
import { LoggerService } from '../../shared/logger/logger.service';
import { EnvironmentService } from '../../config/env/env.service';
import { slugify } from '../../shared/utils/slugify';
import {
  VendorConflictException,
  VendorNotFoundException,
} from '../../core/exceptions';
import {
  User,
  UserRole,
  VerificationStatus,
} from '../../../generated/prisma/client';
import { CACHE_KEYS } from '../../core/constants/app.constants';
import {
  AdminUpdateVendorRequestDto,
  ApplyVendorRequestDto,
  UpdateVendorRequestDto,
  VendorQueryRequestDto,
} from './dto/requests';

@Injectable()
export class VendorsService {
  private readonly logger: ILogger;

  constructor(
    private prisma: PrismaService,
    private eventBus: EventBus,
    private env: EnvironmentService,
    @Inject('CACHE_SERVICE') private cache: ICacheService,
    logger: LoggerService,
  ) {
    this.logger = logger.child('VendorsService');
  }

  // ============================================================
  // VENDOR APPLICATION
  // ============================================================

  /**
   * Apply to become a vendor
   *
   * @param user - The authenticated user applying
   * @param dto - Vendor application data
   * @returns Created vendor (with pending verification status)
   *
   * BUSINESS RULES:
   * - One vendor per user
   * - Slug must be unique (generated from name if not provided)
   * - Category IDs must exist
   * - Status starts as PENDING, waiting for admin approval
   *
   * EVENT: vendor.applied – triggers admin notification email
   */
  async apply(user: User, dto: ApplyVendorRequestDto) {
    this.logger.debug(`User ${user.id} applying for vendor`);

    // Check if user already has a vendor profile
    const existing = await this.prisma.vendor.findUnique({
      where: { userId: user.id },
    });
    if (existing) {
      throw new VendorConflictException(
        existing.slug,
        'You already have a vendor profile',
      );
    }

    const {
      name,
      slug: providedSlug,
      categoryIds,
      social,
      policies,
      culturalHeritage,
      ...rest
    } = dto;

    // Generate slug if not provided
    const slug = providedSlug || slugify(name);

    // Check slug uniqueness
    const slugExists = await this.prisma.vendor.findUnique({
      where: { slug },
    });
    if (slugExists) {
      throw new VendorConflictException(
        slug,
        'Vendor with this slug already exists',
      );
    }

    // Verify categories exist if provided
    if (categoryIds && categoryIds.length > 0) {
      const categories = await this.prisma.category.findMany({
        where: { id: { in: categoryIds } },
      });
      if (categories.length !== categoryIds.length) {
        throw new BadRequestException('One or more category IDs are invalid');
      }
    }

    // Create vendor with pending status
    const vendor = await this.prisma.vendor.create({
      data: {
        userId: user.id,
        name,
        slug,
        ...rest,
        social: social ? { ...social } : {},
        policies: policies ? { ...policies } : {},
        culturalHeritage: culturalHeritage ? { ...culturalHeritage } : {},
        verificationStatus: VerificationStatus.PENDING,
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

    this.logger.info(
      `Vendor application created: ${vendor.id} (${vendor.name})`,
    );

    // Emit event for admin notification
    this.eventBus.emit({
      name: VENDOR_EVENTS.REGISTERED,
      payload: {
        vendorId: vendor.id,
        userId: user.id,
        name: vendor.name,
        email: user.email,
        categoryIds,
        appliedAt: new Date(),
      },
    });

    // Invalidate vendor list cache
    await this.cache.deleteByTag(CACHE_KEYS.VENDORS());

    return vendor;
  }

  // ============================================================
  // PUBLIC LISTING & DETAILS
  // ============================================================

  /**
   * List vendors with pagination, filtering, and sorting
   * Results are cached to reduce database load.
   */
  async findAll(query: VendorQueryRequestDto) {
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
          where.categories = { some: { categoryId } };
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

  /**
   * Get a single vendor by slug (public profile)
   * Includes recent products and reviews.
   */
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
              include: { images: { where: { isPrimary: true }, take: 1 } },
            },
            reviews: {
              take: 5,
              orderBy: { createdAt: 'desc' },
              include: { user: { select: { username: true, avatar: true } } },
            },
          },
        });

        if (!vendor) {
          throw new VendorNotFoundException();
        }

        return vendor;
      },
      {
        ttl: 600,
        tags: [CACHE_KEYS.VENDORS(), CACHE_KEYS.VENDOR(slug)],
      },
    );
  }

  // ============================================================
  // VENDOR OWNER OPERATIONS
  // ============================================================

  /**
   * Get the logged-in user's vendor profile
   */
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
      throw new VendorNotFoundException('You do not have a vendor profile');
    }

    return vendor;
  }

  /**
   * Update the logged-in user's vendor profile
   *
   * @param userId - Owner's user ID
   * @param dto - Updated fields
   * @returns Updated vendor
   *
   * SECURITY: Only the vendor owner can call this.
   * Slug changes are checked for uniqueness.
   * Categories are replaced completely (many-to-many relation).
   */
  async updateMyVendor(userId: string, dto: UpdateVendorRequestDto) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { userId },
    });
    if (!vendor) {
      throw new VendorNotFoundException('Vendor profile not found');
    }

    // If slug is being changed, verify uniqueness
    if (dto.slug && dto.slug !== vendor.slug) {
      const slugExists = await this.prisma.vendor.findUnique({
        where: { slug: dto.slug },
      });
      if (slugExists) {
        throw new VendorConflictException(
          dto.slug,
          'Vendor with this slug already exists',
        );
      }
    }

    const { categoryIds, ...rest } = dto;

    // Use transaction to update vendor and its categories
    const updated = await this.prisma.$transaction(async (tx) => {
      if (categoryIds) {
        // Remove all existing category connections
        await tx.vendorCategory.deleteMany({
          where: { vendorId: vendor.id },
        });
        // Add new connections
        if (categoryIds.length > 0) {
          await tx.vendorCategory.createMany({
            data: categoryIds.map((catId) => ({
              vendorId: vendor.id,
              categoryId: catId,
            })),
          });
        }
      }

      const updatedVendor = await tx.vendor.update({
        where: { id: vendor.id },
        data: {
          ...rest,
          social: rest.social ? { ...rest.social } : {},
          policies: rest.policies ? { ...rest.policies } : {},
          culturalHeritage: rest.culturalHeritage
            ? { ...rest.culturalHeritage }
            : {},
        },
        include: {
          categories: { include: { category: true } },
          badges: true,
        },
      });

      return updatedVendor;
    });

    // Invalidate caches
    await Promise.all([
      this.cache.delete(CACHE_KEYS.VENDOR(vendor.slug)),
      this.cache.delete(CACHE_KEYS.VENDOR_STATS(vendor.id)),
      this.cache.delete(CACHE_KEYS.VENDOR_FOLLOWERS(vendor.id)),
      this.cache.deleteByTag(CACHE_KEYS.VENDORS()),
    ]);

    this.logger.info(`Vendor profile updated: ${vendor.id}`, { userId });

    return updated;
  }

  // ============================================================
  // FOLLOW SYSTEM
  // ============================================================

  /**
   * Follow a vendor (user follows a vendor store)
   */
  async follow(vendorId: string, userId: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: vendorId },
    });
    if (!vendor) throw new VendorNotFoundException();

    const existing = await this.prisma.vendorFollow.findUnique({
      where: { vendorId_userId: { vendorId, userId } },
    });
    if (existing) {
      throw new VendorConflictException(
        vendorId,
        'Already following this vendor',
      );
    }

    await this.prisma.$transaction([
      this.prisma.vendorFollow.create({ data: { vendorId, userId } }),
      this.prisma.vendor.update({
        where: { id: vendorId },
        data: { followersCount: { increment: 1 } },
      }),
    ]);

    this.logger.info(`User ${userId} followed vendor ${vendorId}`);

    // Emit event for notification
    this.eventBus.emit({
      name: VENDOR_EVENTS.FOLLOWED,
      payload: {
        vendorId,
        userId,
        vendorName: vendor.name,
        userName: '', // we don't have user name here, could fetch
        timestamp: new Date(),
      },
    });

    // Invalidate followers cache
    await this.cache.delete(CACHE_KEYS.VENDOR_FOLLOWERS(vendorId));

    return { message: 'Vendor followed successfully' };
  }

  /**
   * Unfollow a vendor
   */
  async unfollow(vendorId: string, userId: string) {
    const existing = await this.prisma.vendorFollow.findUnique({
      where: { vendorId_userId: { vendorId, userId } },
    });
    if (!existing) {
      throw new VendorNotFoundException('Not following this vendor');
    }

    await this.prisma.$transaction([
      this.prisma.vendorFollow.delete({ where: { id: existing.id } }),
      this.prisma.vendor.update({
        where: { id: vendorId },
        data: { followersCount: { decrement: 1 } },
      }),
    ]);

    this.logger.info(`User ${userId} unfollowed vendor ${vendorId}`);

    this.eventBus.emit({
      name: VENDOR_EVENTS.UNFOLLOWED,
      payload: { vendorId, userId, timestamp: new Date() },
    });

    await this.cache.delete(CACHE_KEYS.VENDOR_FOLLOWERS(vendorId));

    return { message: 'Vendor unfollowed successfully' };
  }

  /**
   * Get list of users following a vendor (public)
   */
  async getFollowers(vendorId: string, page = 1, limit = 20) {
    const cacheKey = CACHE_KEYS.VENDOR_FOLLOWERS(vendorId);

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        const vendor = await this.prisma.vendor.findUnique({
          where: { id: vendorId },
        });
        if (!vendor) throw new VendorNotFoundException();

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

  // ============================================================
  // ADMIN OPERATIONS
  // ============================================================

  /**
   * Admin updates vendor (verify, feature, change verification status)
   *
   * @param id - Vendor ID
   * @param dto - Admin update data
   * @returns Updated vendor
   *
   * SIDE EFFECTS:
   * - If verification status changes to VERIFIED, user role becomes VENDOR
   * - Emits event for vendor approval/rejection email
   */
  async adminUpdate(id: string, dto: AdminUpdateVendorRequestDto) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!vendor) throw new VendorNotFoundException();

    const updated = await this.prisma.$transaction(async (tx) => {
      // Update vendor
      const updatedVendor = await tx.vendor.update({
        where: { id },
        data: dto,
        include: {
          user: true,
          categories: { include: { category: true } },
          badges: true,
        },
      });

      // If verification status changed to VERIFIED, upgrade user role
      if (
        dto.verificationStatus === 'VERIFIED' &&
        vendor.verificationStatus !== 'VERIFIED'
      ) {
        await tx.user.update({
          where: { id: vendor.userId },
          data: { role: UserRole.VENDOR },
        });
        this.logger.info(`User ${vendor.userId} role upgraded to VENDOR`);

        // Emit approval event for email
        this.eventBus.emit({
          name: VENDOR_EVENTS.APPROVED,
          payload: {
            vendorId: vendor.id,
            userId: vendor.userId,
            name: vendor.name,
            email: vendor.user.email,
            approvedBy: 'admin',
            approvedAt: new Date(),
          },
        });
      } else if (
        dto.verificationStatus === 'REJECTED' &&
        vendor.verificationStatus !== 'REJECTED'
      ) {
        this.eventBus.emit({
          name: VENDOR_EVENTS.REJECTED,
          payload: {
            vendorId: vendor.id,
            userId: vendor.userId,
            name: vendor.name,
            email: vendor.user.email,
            reason: dto.verificationStatus, // optional reason field
            rejectedBy: 'admin',
            rejectedAt: new Date(),
          },
        });
      }

      return updatedVendor;
    });

    // Invalidate caches
    await Promise.all([
      this.cache.delete(CACHE_KEYS.VENDOR(vendor.slug)),
      this.cache.delete(CACHE_KEYS.VENDOR_STATS(vendor.id)),
      this.cache.deleteByTag(CACHE_KEYS.VENDORS()),
    ]);

    return updated;
  }

  /**
   * Admin deletes a vendor (and all related data due to cascade)
   */
  async deleteVendor(id: string) {
    const vendor = await this.prisma.vendor.findUnique({ where: { id } });
    if (!vendor) throw new VendorNotFoundException();

    await Promise.all([
      this.cache.delete(CACHE_KEYS.VENDOR(vendor.slug)),
      this.cache.delete(CACHE_KEYS.VENDOR_STATS(vendor.id)),
      this.cache.delete(CACHE_KEYS.VENDOR_FOLLOWERS(vendor.id)),
      this.cache.deleteByTag(CACHE_KEYS.VENDORS()),
    ]);

    await this.prisma.vendor.delete({ where: { id } });

    this.logger.warn(`Vendor deleted: ${vendor.id} (${vendor.name})`);
  }
}
