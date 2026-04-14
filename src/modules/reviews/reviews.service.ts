import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/shared/database/prisma.service';
import { EventBus } from 'src/shared/events/event-bus.service';
import { PRODUCT_EVENTS, VENDOR_EVENTS } from 'src/shared/events/event-types';
import {
  CreateProductReviewDto,
  CreateVendorReviewDto,
  UpdateReviewDto,
  ModerateReviewDto,
} from './dto';
import {
  ReviewResponseDto,
  ProductReviewResponseDto,
  VendorReviewResponseDto,
} from './dto/review-response.dto';
import { OrderStatus, PaymentStatus } from 'generated/prisma/client';
import { ProductNotFoundException } from 'src/core/exceptions';

@Injectable()
export class ReviewsService {
  constructor(
    private prisma: PrismaService,
    private eventBus: EventBus,
  ) {}

  /**
   * Check if user is eligible to review a product (must have purchased and delivered)
   */
  private async canUserReviewProduct(
    userId: string,
    productId: string,
  ): Promise<boolean> {
    const order = await this.prisma.order.findFirst({
      where: {
        userId,
        status: OrderStatus.DELIVERED,
        paymentStatus: PaymentStatus.COMPLETED,
        items: {
          some: {
            productId,
          },
        },
      },
    });
    return !!order;
  }

  /**
   * Check if user is eligible to review a vendor (must have purchased from them)
   */
  private async canUserReviewVendor(
    userId: string,
    vendorId: string,
  ): Promise<boolean> {
    const order = await this.prisma.order.findFirst({
      where: {
        userId,
        status: OrderStatus.DELIVERED,
        paymentStatus: PaymentStatus.COMPLETED,
        items: {
          some: {
            vendorId,
          },
        },
      },
    });
    return !!order;
  }

  /**
   * Create a product review
   */
  async createProductReview(
    userId: string,
    createReviewDto: CreateProductReviewDto,
  ): Promise<ProductReviewResponseDto> {
    const { productId, rating, title, comment, images } = createReviewDto;

    // Check if product exists
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { vendor: true },
    });
    if (!product) {
      throw new ProductNotFoundException();
    }

    // Check if user has already reviewed this product
    const existingReview = await this.prisma.review.findFirst({
      where: {
        productId,
        userId,
      },
    });
    if (existingReview) {
      throw new BadRequestException('You have already reviewed this product');
    }

    // Check if user is eligible to review (must have purchased)
    const canReview = await this.canUserReviewProduct(userId, productId);
    if (!canReview) {
      throw new BadRequestException(
        'You can only review products you have purchased and received',
      );
    }

    // Get user details
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, firstName: true, lastName: true, avatar: true },
    });

    // Create review
    const review = await this.prisma.review.create({
      data: {
        productId,
        userId,
        userName: user?.firstName || user?.username || 'Anonymous',
        userAvatar: user?.avatar,
        rating,
        title: title || null,
        comment: comment || null,
        images: images || [],
        verified: true,
      },
    });

    // Update product rating
    await this.updateProductRating(productId);

    // Get the created review with user
    const reviewWithUser = await this.prisma.review.findUnique({
      where: { id: review.id },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
      },
    });

    // Emit event for product review
    this.eventBus.emit({
      name: PRODUCT_EVENTS.REVIEWED,
      payload: {
        reviewId: review.id,
        productId: review.productId,
        productName: product.name,
        userId: review.userId,
        userName: review.userName,
        rating: review.rating,
        reviewTitle: review.title || undefined,
        createdAt: review.createdAt,
      },
    });

    return new ProductReviewResponseDto({
      ...reviewWithUser,
      productId: review.productId,
      productName: product.name,
    });
  }

  /**
   * Create a vendor review
   */
  async createVendorReview(
    userId: string,
    createReviewDto: CreateVendorReviewDto,
  ): Promise<VendorReviewResponseDto> {
    const { vendorId, rating, title, comment, images } = createReviewDto;

    // Check if vendor exists
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: vendorId },
      include: { user: true },
    });
    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    // Check if user has already reviewed this vendor
    const existingReview = await this.prisma.vendorReview.findFirst({
      where: {
        vendorId,
        userId,
      },
    });
    if (existingReview) {
      throw new BadRequestException('You have already reviewed this vendor');
    }

    // Check if user is eligible to review (must have purchased from vendor)
    const canReview = await this.canUserReviewVendor(userId, vendorId);
    if (!canReview) {
      throw new BadRequestException(
        'You can only review vendors you have purchased from',
      );
    }

    // Get user details
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, firstName: true, lastName: true, avatar: true },
    });

    // Create vendor review
    const review = await this.prisma.vendorReview.create({
      data: {
        vendorId,
        userId,
        userName: user?.firstName || user?.username || 'Anonymous',
        rating,
        comment: comment || title || '',
      },
    });

    // Update vendor rating
    await this.updateVendorRating(vendorId);

    return new VendorReviewResponseDto({
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      images: [],
      helpful: 0,
      notHelpful: 0,
      verified: true,
      isEdited: false,
      user: {
        id: user!.id,
        username: user!.username,
        firstName: user!.firstName,
        lastName: user!.lastName,
        avatar: user!.avatar,
      },
      createdAt: review.createdAt,
      updatedAt: review.createdAt,
      vendorId: review.vendorId,
      vendorName: vendor.name,
    });
  }

  /**
   * Get product reviews with pagination and filters
   */
  async getProductReviews(
    productId: string,
    page = 1,
    limit = 10,
    rating?: number,
    sortBy: 'recent' | 'helpful' | 'rating' = 'recent',
  ) {
    const skip = (page - 1) * limit;

    const where: any = { productId };
    if (rating) {
      where.rating = rating;
    }

    let orderBy: any = {};
    switch (sortBy) {
      case 'recent':
        orderBy = { createdAt: 'desc' };
        break;
      case 'helpful':
        orderBy = { helpful: 'desc' };
        break;
      case 'rating':
        orderBy = { rating: 'desc' };
        break;
    }

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
          helpfulVotes: {
            where: {
              isHelpful: true,
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.review.count({ where }),
    ]);

    const ratingStats = await this.getProductRatingStats(productId);

    return {
      data: reviews.map((review) => new ReviewResponseDto(review)),
      meta: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        ratingStats,
      },
    };
  }

  /**
   * Get vendor reviews with pagination
   */
  async getVendorReviews(vendorId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      this.prisma.vendorReview.findMany({
        where: { vendorId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.vendorReview.count({ where: { vendorId } }),
    ]);

    const ratingStats = await this.getVendorRatingStats(vendorId);

    return {
      data: reviews,
      meta: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        ratingStats,
      },
    };
  }

  /**
   * Get product rating statistics
   */
  async getProductRatingStats(productId: string) {
    const stats = await this.prisma.review.aggregate({
      where: { productId },
      _avg: { rating: true },
      _count: true,
    });

    const distribution = await this.prisma.review.groupBy({
      by: ['rating'],
      where: { productId },
      _count: true,
    });

    return {
      average: stats._avg.rating || 0,
      total: stats._count,
      distribution: distribution.reduce(
        (acc, curr) => {
          acc[curr.rating] = curr._count;
          return acc;
        },
        {} as Record<number, number>,
      ),
    };
  }

  /**
   * Get vendor rating statistics
   */
  async getVendorRatingStats(vendorId: string) {
    const stats = await this.prisma.vendorReview.aggregate({
      where: { vendorId },
      _avg: { rating: true },
      _count: true,
    });

    return {
      average: stats._avg.rating || 0,
      total: stats._count,
    };
  }

  /**
   * Update product rating (denormalized field)
   */
  private async updateProductRating(productId: string) {
    const stats = await this.prisma.review.aggregate({
      where: { productId },
      _avg: { rating: true },
      _count: true,
    });

    await this.prisma.product.update({
      where: { id: productId },
      data: {
        rating: stats._avg.rating || 0,
        reviewCount: stats._count,
      },
    });
  }

  /**
   * Update vendor rating (denormalized field)
   */
  private async updateVendorRating(vendorId: string) {
    const stats = await this.prisma.vendorReview.aggregate({
      where: { vendorId },
      _avg: { rating: true },
      _count: true,
    });

    await this.prisma.vendor.update({
      where: { id: vendorId },
      data: {
        rating: stats._avg.rating || 0,
        reviewCount: stats._count,
      },
    });
  }

  /**
   * Update a review (user can edit their own review)
   */
  async updateReview(
    userId: string,
    reviewId: string,
    updateDto: UpdateReviewDto,
  ): Promise<ReviewResponseDto> {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      include: { user: true },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    if (review.userId !== userId) {
      throw new ForbiddenException('You can only update your own reviews');
    }

    const updated = await this.prisma.review.update({
      where: { id: reviewId },
      data: {
        ...updateDto,
        isEdited: true,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
      },
    });

    // Update product rating if rating changed
    if (updateDto.rating && updateDto.rating !== review.rating) {
      await this.updateProductRating(review.productId);
    }

    return new ReviewResponseDto(updated);
  }

  /**
   * Delete a review (user can delete own, admin can delete any)
   */
  async deleteReview(userId: string, reviewId: string, isAdmin = false) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    if (!isAdmin && review.userId !== userId) {
      throw new ForbiddenException('You can only delete your own reviews');
    }

    await this.prisma.review.delete({
      where: { id: reviewId },
    });

    // Update product rating
    await this.updateProductRating(review.productId);

    return { success: true, message: 'Review deleted successfully' };
  }

  /**
   * Mark a review as helpful or not helpful
   */
  async markHelpful(userId: string, reviewId: string, isHelpful: boolean) {
    // Check if user already voted
    const existingVote = await this.prisma.reviewHelpful.findUnique({
      where: {
        reviewId_userId: {
          reviewId,
          userId,
        },
      },
    });

    if (existingVote) {
      // Update existing vote
      if (existingVote.isHelpful === isHelpful) {
        // Same vote - remove it (toggle off)
        await this.prisma.reviewHelpful.delete({
          where: {
            reviewId_userId: {
              reviewId,
              userId,
            },
          },
        });

        // Decrement counters
        await this.prisma.review.update({
          where: { id: reviewId },
          data: {
            helpful: isHelpful ? { decrement: 1 } : undefined,
            notHelpful: !isHelpful ? { decrement: 1 } : undefined,
          },
        });
      } else {
        // Different vote - update it
        await this.prisma.reviewHelpful.update({
          where: {
            reviewId_userId: {
              reviewId,
              userId,
            },
          },
          data: { isHelpful },
        });

        // Update counters
        await this.prisma.review.update({
          where: { id: reviewId },
          data: {
            helpful: isHelpful ? { increment: 1 } : { decrement: 1 },
            notHelpful: !isHelpful ? { increment: 1 } : { decrement: 1 },
          },
        });
      }
    } else {
      // Create new vote
      await this.prisma.reviewHelpful.create({
        data: {
          reviewId,
          userId,
          isHelpful,
        },
      });

      // Increment counter
      await this.prisma.review.update({
        where: { id: reviewId },
        data: {
          helpful: isHelpful ? { increment: 1 } : undefined,
          notHelpful: !isHelpful ? { increment: 1 } : undefined,
        },
      });
    }

    return { success: true };
  }

  /**
   * Get user's review for a specific product
   */
  async getUserProductReview(userId: string, productId: string) {
    const review = await this.prisma.review.findFirst({
      where: {
        userId,
        productId,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
      },
    });

    return review ? new ReviewResponseDto(review) : null;
  }

  /**
   * Admin: Get flagged reviews for moderation
   */
  async getFlaggedReviews(page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where: {
          OR: [
            { comment: { contains: 'spam', mode: 'insensitive' } },
            { comment: { contains: 'offensive', mode: 'insensitive' } },
          ],
        },
        include: {
          user: true,
          product: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.review.count({
        where: {
          OR: [
            { comment: { contains: 'spam', mode: 'insensitive' } },
            { comment: { contains: 'offensive', mode: 'insensitive' } },
          ],
        },
      }),
    ]);

    return {
      data: reviews,
      meta: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Admin: Moderate a review
   */
  async moderateReview(reviewId: string, moderateDto: ModerateReviewDto) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    if (!moderateDto.isApproved) {
      // Hide/delete review
      await this.prisma.review.update({
        where: { id: reviewId },
        data: {
          comment: '[This review has been removed by moderation]',
          images: [],
        },
      });
    }

    return {
      success: true,
      message: moderateDto.isApproved ? 'Review approved' : 'Review removed',
    };
  }
}