import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  ParseIntPipe,
  DefaultValuePipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { WishlistService } from './wishlist.service';
import { AddToWishlistDto, BatchWishlistDto } from './dto';
import { CurrentUser } from '../../core/decorators/current-user.decorator';

@Controller('wishlist')
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  /**
   * Get user's wishlist
   */
  @Get()
  async getWishlist(
    @CurrentUser('id') userId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('sort') sort?: 'recent' | 'price-asc' | 'price-desc',
  ) {
    const result = await this.wishlistService.getUserWishlist(userId, page, limit, sort);
    return {
      success: true,
      data: result.data,
      stats: result.stats,
      meta: result.meta,
    };
  }

  /**
   * Add product to wishlist
   */
  @Post()
  async addToWishlist(
    @CurrentUser('id') userId: string,
    @Body() addDto: AddToWishlistDto,
  ) {
    const item = await this.wishlistService.addToWishlist(userId, addDto);
    return {
      success: true,
      message: 'Product added to wishlist',
      data: item,
    };
  }

  /**
   * Remove product from wishlist
   */
  @Delete(':productId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeFromWishlist(
    @CurrentUser('id') userId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    await this.wishlistService.removeFromWishlist(userId, productId);
    return {
      success: true,
      message: 'Product removed from wishlist',
    };
  }

  /**
   * Check if product is in wishlist
   */
  @Get('check/:productId')
  async checkInWishlist(
    @CurrentUser('id') userId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    const isInWishlist = await this.wishlistService.isInWishlist(userId, productId);
    return {
      success: true,
      data: { isInWishlist },
    };
  }

  /**
   * Batch check products in wishlist
   */
  @Post('check/batch')
  async batchCheckWishlist(
    @CurrentUser('id') userId: string,
    @Body() batchDto: BatchWishlistDto,
  ) {
    const results = await this.wishlistService.batchCheckWishlist(userId, batchDto.productIds);
    return {
      success: true,
      data: results,
    };
  }

  /**
   * Batch add products to wishlist
   */
  @Post('batch')
  async batchAddToWishlist(
    @CurrentUser('id') userId: string,
    @Body() batchDto: BatchWishlistDto,
  ) {
    const result = await this.wishlistService.batchAddToWishlist(userId, batchDto);
    return {
      success: true,
      message: `Added ${result.added} items to wishlist`,
      data: result,
    };
  }

  /**
   * Batch remove products from wishlist
   */
  @Delete('batch')
  @HttpCode(HttpStatus.OK)
  async batchRemoveFromWishlist(
    @CurrentUser('id') userId: string,
    @Body() batchDto: BatchWishlistDto,
  ) {
    const result = await this.wishlistService.batchRemoveFromWishlist(userId, batchDto);
    return {
      success: true,
      message: `Removed ${result.removed} items from wishlist`,
      data: result,
    };
  }

  /**
   * Clear entire wishlist
   */
  @Delete()
  @HttpCode(HttpStatus.OK)
  async clearWishlist(@CurrentUser('id') userId: string) {
    const result = await this.wishlistService.clearWishlist(userId);
    return {
      success: true,
      message: `Cleared ${result.removed} items from wishlist`,
    };
  }

  /**
   * Move item to cart
   */
  @Post(':productId/move-to-cart')
  async moveToCart(
    @CurrentUser('id') userId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Query('quantity') quantity = 1,
  ) {
    await this.wishlistService.moveToCart(userId, productId, quantity);
    return {
      success: true,
      message: 'Item moved to cart',
    };
  }

  /**
   * Move all items to cart
   */
  @Post('move-all-to-cart')
  async moveAllToCart(@CurrentUser('id') userId: string) {
    const result = await this.wishlistService.moveAllToCart(userId);
    return {
      success: true,
      message: `Moved ${result.moved} items to cart`,
    };
  }

  /**
   * Get wishlist statistics
   */
  @Get('stats')
  async getStats(@CurrentUser('id') userId: string) {
    const stats = await this.wishlistService.getWishlistStats(userId);
    return {
      success: true,
      data: stats,
    };
  }
}