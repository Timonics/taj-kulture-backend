// src/modules/wishlist/wishlist.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { EventBus } from '../../shared/events/event-bus.service';
import { USER_EVENTS } from '../../shared/events/event-types';
import {
  AddToWishlistDto,
  BatchWishlistDto,
  WishlistResponseDto,
  WishlistStatsDto,
} from './dto';

@Injectable()
export class WishlistService {
  constructor(
    private prisma: PrismaService,
    private eventBus: EventBus,
  ) {}

  /**
   * Add product to wishlist
   */
  async addToWishlist(
    userId: string,
    addDto: AddToWishlistDto,
  ): Promise<WishlistResponseDto> {
    const { productId, notes } = addDto;

    // Check if product exists
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        images: {
          where: { isPrimary: true },
          take: 1,
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Check if product is published
    if (!product.isPublished || product.status !== 'PUBLISHED') {
      throw new BadRequestException('Product is not available');
    }

    // Check if already in wishlist
    const existing = await this.prisma.wishlistItem.findUnique({
      where: {
        userId_productId: {
          userId,
          productId,
        },
      },
    });

    if (existing) {
      throw new ConflictException('Product already in wishlist');
    }

    // Add to wishlist
    const wishlistItem = await this.prisma.wishlistItem.create({
      data: {
        userId,
        productId,
      },
    });

    // Emit event
    this.eventBus.emit({
      name: USER_EVENTS.WISHLIST_ADDED,
      payload: {
        userId,
        productId,
        productName: product.name,
        timestamp: new Date(),
      },
    });

    // Get full item with product details for response
    return this.getWishlistItemWithProduct(wishlistItem.id, product);
  }

  /**
   * Remove product from wishlist
   */
  async removeFromWishlist(userId: string, productId: string): Promise<void> {
    const wishlistItem = await this.prisma.wishlistItem.findUnique({
      where: {
        userId_productId: {
          userId,
          productId,
        },
      },
      include: {
        product: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!wishlistItem) {
      throw new NotFoundException('Product not found in wishlist');
    }

    await this.prisma.wishlistItem.delete({
      where: {
        userId_productId: {
          userId,
          productId,
        },
      },
    });

    // Emit event
    this.eventBus.emit({
      name: USER_EVENTS.WISHLIST_REMOVED,
      payload: {
        userId,
        productId,
        productName: wishlistItem.product.name,
        timestamp: new Date(),
      },
    });
  }

  /**
   * Get user's wishlist with pagination
   */
  async getUserWishlist(
    userId: string,
    page = 1,
    limit = 20,
    sortBy: 'recent' | 'price-asc' | 'price-desc' = 'recent',
  ) {
    const skip = (page - 1) * limit;

    let orderBy: any = {};
    switch (sortBy) {
      case 'recent':
        orderBy = { createdAt: 'desc' };
        break;
      case 'price-asc':
        orderBy = { product: { price: 'asc' } };
        break;
      case 'price-desc':
        orderBy = { product: { price: 'desc' } };
        break;
    }

    const [items, total] = await Promise.all([
      this.prisma.wishlistItem.findMany({
        where: { userId },
        include: {
          product: {
            include: {
              vendor: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
              images: {
                where: { isPrimary: true },
                take: 1,
              },
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.wishlistItem.count({ where: { userId } }),
    ]);

    const data = items.map((item) => this.mapToWishlistResponse(item));

    // Get stats
    const stats = await this.getWishlistStats(userId);

    return {
      data,
      stats,
      meta: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Check if product is in user's wishlist
   */
  async isInWishlist(userId: string, productId: string): Promise<boolean> {
    const item = await this.prisma.wishlistItem.findUnique({
      where: {
        userId_productId: {
          userId,
          productId,
        },
      },
    });
    return !!item;
  }

  /**
   * Batch check which products are in wishlist
   */
  async batchCheckWishlist(
    userId: string,
    productIds: string[],
  ): Promise<Record<string, boolean>> {
    const items = await this.prisma.wishlistItem.findMany({
      where: {
        userId,
        productId: { in: productIds },
      },
      select: { productId: true },
    });

    const wishlistMap: Record<string, boolean> = {};
    productIds.forEach((id) => {
      wishlistMap[id] = false;
    });
    items.forEach((item) => {
      wishlistMap[item.productId] = true;
    });

    return wishlistMap;
  }

  /**
   * Batch add products to wishlist
   */
  async batchAddToWishlist(
    userId: string,
    batchDto: BatchWishlistDto,
  ): Promise<{
    added: number;
    failed: Array<{ productId: string; reason: string }>;
  }> {
    const { productIds } = batchDto;
    let added = 0;
    const failed: Array<{ productId: string; reason: string }> = [];

    // Get existing wishlist items
    const existing = await this.prisma.wishlistItem.findMany({
      where: {
        userId,
        productId: { in: productIds },
      },
      select: { productId: true },
    });
    const existingSet = new Set(existing.map((e) => e.productId));

    // Get valid products
    const products = await this.prisma.product.findMany({
      where: {
        id: { in: productIds },
        isPublished: true,
        status: 'PUBLISHED',
      },
      select: { id: true, name: true },
    });
    const validProductSet = new Set(products.map((p) => p.id));

    for (const productId of productIds) {
      if (existingSet.has(productId)) {
        failed.push({ productId, reason: 'Already in wishlist' });
        continue;
      }

      if (!validProductSet.has(productId)) {
        failed.push({ productId, reason: 'Product not available' });
        continue;
      }

      await this.prisma.wishlistItem.create({
        data: { userId, productId },
      });
      added++;
    }

    return { added, failed };
  }

  /**
   * Batch remove products from wishlist
   */
  async batchRemoveFromWishlist(
    userId: string,
    batchDto: BatchWishlistDto,
  ): Promise<{
    removed: number;
    failed: Array<{ productId: string; reason: string }>;
  }> {
    const { productIds } = batchDto;
    let removed = 0;
    const failed: Array<{ productId: string; reason: string }> = [];

    for (const productId of productIds) {
      const item = await this.prisma.wishlistItem.findUnique({
        where: {
          userId_productId: {
            userId,
            productId,
          },
        },
      });

      if (!item) {
        failed.push({ productId, reason: 'Not in wishlist' });
        continue;
      }

      await this.prisma.wishlistItem.delete({
        where: {
          userId_productId: {
            userId,
            productId,
          },
        },
      });
      removed++;
    }

    return { removed, failed };
  }

  /**
   * Clear entire wishlist
   */
  async clearWishlist(userId: string): Promise<{ removed: number }> {
    const result = await this.prisma.wishlistItem.deleteMany({
      where: { userId },
    });

    return { removed: result.count };
  }

  /**
   * Move wishlist item to cart
   */
  async moveToCart(
    userId: string,
    productId: string,
    quantity = 1,
  ): Promise<void> {
    // Check if product is in wishlist
    const wishlistItem = await this.prisma.wishlistItem.findUnique({
      where: {
        userId_productId: {
          userId,
          productId,
        },
      },
      include: {
        product: true,
      },
    });

    if (!wishlistItem) {
      throw new NotFoundException('Product not found in wishlist');
    }

    // Get or create cart
    let cart = await this.prisma.cart.findUnique({
      where: { userId },
    });

    if (!cart) {
      cart = await this.prisma.cart.create({
        data: { userId },
      });
    }

    // Check if product already in cart
    const existingCartItem = await this.prisma.cartItem.findUnique({
      where: {
        cartId_productId_selectedSize_selectedColor: {
          cartId: cart.id,
          productId,
          selectedSize: '',
          selectedColor: '',
        },
      },
    });

    if (existingCartItem) {
      // Update quantity
      await this.prisma.cartItem.update({
        where: { id: existingCartItem.id },
        data: {
          quantity: existingCartItem.quantity + quantity,
          total:
            (existingCartItem.quantity + quantity) * existingCartItem.price,
        },
      });
    } else {
      // Add new cart item
      await this.prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId,
          quantity,
          price: wishlistItem.product.price,
          total: wishlistItem.product.price * quantity,
        },
      });
    }

    // Update cart totals
    await this.updateCartTotals(cart.id);

    // Remove from wishlist
    await this.removeFromWishlist(userId, productId);
  }

  /**
   * Move all wishlist items to cart
   */
  async moveAllToCart(userId: string): Promise<{ moved: number }> {
    const wishlistItems = await this.prisma.wishlistItem.findMany({
      where: { userId },
      include: { product: true },
    });

    if (wishlistItems.length === 0) {
      return { moved: 0 };
    }

    // Get or create cart
    let cart = await this.prisma.cart.findUnique({
      where: { userId },
    });

    if (!cart) {
      cart = await this.prisma.cart.create({
        data: { userId },
      });
    }

    let moved = 0;

    for (const item of wishlistItems) {
      const existingCartItem = await this.prisma.cartItem.findUnique({
        where: {
          cartId_productId_selectedSize_selectedColor: {
            cartId: cart.id,
            productId: item.productId,
            selectedSize: '',
            selectedColor: '',
          },
        },
      });

      if (existingCartItem) {
        await this.prisma.cartItem.update({
          where: { id: existingCartItem.id },
          data: {
            quantity: existingCartItem.quantity + 1,
            total: (existingCartItem.quantity + 1) * existingCartItem.price,
          },
        });
      } else {
        await this.prisma.cartItem.create({
          data: {
            cartId: cart.id,
            productId: item.productId,
            quantity: 1,
            price: item.product.price,
            total: item.product.price,
          },
        });
      }
      moved++;
    }

    // Update cart totals
    await this.updateCartTotals(cart.id);

    // Clear wishlist
    await this.clearWishlist(userId);

    return { moved };
  }

  /**
   * Get wishlist statistics
   */
  async getWishlistStats(userId: string): Promise<WishlistStatsDto> {
    const items = await this.prisma.wishlistItem.findMany({
      where: { userId },
      include: {
        product: true,
      },
    });

    let totalValue = 0;
    let itemsOnSale = 0;
    let outOfStock = 0;

    for (const item of items) {
      totalValue += item.product.price;
      if (item.product.discount && item.product.discount > 0) {
        itemsOnSale++;
      }
      if (item.product.stock <= 0 || item.product.status !== 'PUBLISHED') {
        outOfStock++;
      }
    }

    return {
      totalItems: items.length,
      totalValue,
      itemsOnSale,
      outOfStock,
    };
  }

  /**
   * Private helper methods
   */
  private async getWishlistItemWithProduct(
    itemId: string,
    product: any,
  ): Promise<WishlistResponseDto> {
    const item = await this.prisma.wishlistItem.findUnique({
      where: { id: itemId },
    });

    return this.mapToWishlistResponse({
      ...item,
      product,
      vendor: product.vendor,
      images: product.images,
    });
  }

  private async updateCartTotals(cartId: string): Promise<void> {
    const items = await this.prisma.cartItem.findMany({
      where: { cartId },
    });

    const total = items.reduce((sum, item) => sum + item.total, 0);
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

    await this.prisma.cart.update({
      where: { id: cartId },
      data: { total, itemCount },
    });
  }

  private mapToWishlistResponse(item: any): WishlistResponseDto {
    const primaryImage = item.product.images?.[0];

    return new WishlistResponseDto({
      id: item.id,
      userId: item.userId,
      productId: item.productId,
      notes: item.notes,
      product: {
        id: item.product.id,
        name: item.product.name,
        slug: item.product.slug,
        price: item.product.price,
        originalPrice: item.product.originalPrice,
        discount: item.product.discount,
        image: primaryImage?.url,
        inStock: item.product.stock > 0 && item.product.status === 'PUBLISHED',
        vendorId: item.product.vendor.id,
        vendorName: item.product.vendor.name,
        vendorSlug: item.product.vendor.slug,
      },
      createdAt: item.createdAt,
    });
  }
}
