// src/modules/reviews/reviews.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Delete,
  Param,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { UserRole } from 'generated/prisma/enums';
import { CurrentUser } from 'src/core/decorators/current-user.decorator';
import { Roles } from 'src/core/decorators/roles.decorator';
import {
  CreateProductReviewDto,
  CreateVendorReviewDto,
} from './dto/create-review.dto';
import { ModerateReviewDto } from './dto/moderate-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { ParseIdPipe } from 'src/core/pipes/parse-id.pipe';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  // ============ PRODUCT REVIEWS ============

  @Post('product')
  async createProductReview(
    @CurrentUser('id') userId: string,
    @Body() createReviewDto: CreateProductReviewDto,
  ) {
    const review = await this.reviewsService.createProductReview(
      userId,
      createReviewDto,
    );
    return {
      success: true,
      message: 'Review submitted successfully',
      data: review,
    };
  }

  @Get('product/:productId')
  async getProductReviews(
    @Param('productId', ParseIdPipe) productId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('rating') rating?: number,
    @Query('sort') sort?: 'recent' | 'helpful' | 'rating',
  ) {
    const result = await this.reviewsService.getProductReviews(
      productId,
      page,
      limit,
      rating,
      sort,
    );
    return {
      success: true,
      data: result.data,
      meta: result.meta,
    };
  }

  @Get('product/:productId/rating-stats')
  async getProductRatingStats(
    @Param('productId', ParseIdPipe) productId: string,
  ) {
    const stats = await this.reviewsService.getProductRatingStats(productId);
    return {
      success: true,
      data: stats,
    };
  }

  @Get('product/:productId/user')
  async CurrentUserProductReview(
    @CurrentUser('id') userId: string,
    @Param('productId', ParseIdPipe) productId: string,
  ) {
    const review = await this.reviewsService.getUserProductReview(
      userId,
      productId,
    );
    return {
      success: true,
      data: review,
    };
  }

  // ============ VENDOR REVIEWS ============

  @Post('vendor')
  async createVendorReview(
    @CurrentUser('id') userId: string,
    @Body() createReviewDto: CreateVendorReviewDto,
  ) {
    const review = await this.reviewsService.createVendorReview(
      userId,
      createReviewDto,
    );
    return {
      success: true,
      message: 'Vendor review submitted successfully',
      data: review,
    };
  }

  @Get('vendor/:vendorId')
  async getVendorReviews(
    @Param('vendorId', ParseIdPipe) vendorId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    const result = await this.reviewsService.getVendorReviews(
      vendorId,
      page,
      limit,
    );
    return {
      success: true,
      data: result.data,
      meta: result.meta,
    };
  }

  @Get('vendor/:vendorId/rating-stats')
  async getVendorRatingStats(
    @Param('vendorId', ParseIdPipe) vendorId: string,
  ) {
    const stats = await this.reviewsService.getVendorRatingStats(vendorId);
    return {
      success: true,
      data: stats,
    };
  }

  // ============ REVIEW INTERACTIONS ============

  @Patch(':reviewId')
  async updateReview(
    @CurrentUser('id') userId: string,
    @Param('reviewId', ParseIdPipe) reviewId: string,
    @Body() updateDto: UpdateReviewDto,
  ) {
    const review = await this.reviewsService.updateReview(
      userId,
      reviewId,
      updateDto,
    );
    return {
      success: true,
      message: 'Review updated successfully',
      data: review,
    };
  }

  @Delete(':reviewId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteReview(
    @CurrentUser('id') userId: string,
    @Param('reviewId', ParseIdPipe) reviewId: string,
  ) {
    await this.reviewsService.deleteReview(userId, reviewId);
    return {
      success: true,
      message: 'Review deleted successfully',
    };
  }

  @Post(':reviewId/helpful')
  @HttpCode(HttpStatus.OK)
  async markHelpful(
    @CurrentUser('id') userId: string,
    @Param('reviewId', ParseIdPipe) reviewId: string,
  ) {
    await this.reviewsService.markHelpful(userId, reviewId, true);
    return {
      success: true,
      message: 'Marked as helpful',
    };
  }

  @Post(':reviewId/not-helpful')
  @HttpCode(HttpStatus.OK)
  async markNotHelpful(
    @CurrentUser('id') userId: string,
    @Param('reviewId', ParseIdPipe) reviewId: string,
  ) {
    await this.reviewsService.markHelpful(userId, reviewId, false);
    return {
      success: true,
      message: 'Marked as not helpful',
    };
  }

  // ============ ADMIN ROUTES ============

  @Get('admin/flagged')
  @Roles(UserRole.ADMIN)
  async getFlaggedReviews(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    const result = await this.reviewsService.getFlaggedReviews(page, limit);
    return {
      success: true,
      data: result.data,
      meta: result.meta,
    };
  }

  @Post('admin/:reviewId/moderate')
  @Roles(UserRole.ADMIN)
  async moderateReview(
    @Param('reviewId', ParseIdPipe) reviewId: string,
    @Body() moderateDto: ModerateReviewDto,
  ) {
    const result = await this.reviewsService.moderateReview(
      reviewId,
      moderateDto,
    );
    return {
      success: true,
      message: result.message,
    };
  }
}
