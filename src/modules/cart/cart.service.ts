import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { User } from 'generated/prisma/client';
import { CACHE_KEYS } from 'src/core/constants/app.constants';
import { ICacheService } from 'src/shared/cache/cache.interface';
import { ICart } from './interfaces/cart.interface';
import { CartItemNotFoundException, ProductNotFoundException } from 'src/core/exceptions';

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);
  private readonly CART_TTL = 60 * 60 * 24 * 7; // 7 days in seconds

  constructor(
    private prisma: PrismaService,
    @Inject('CACHE_SERVICE') private cache: ICacheService,
  ) {}

  // ============ MAIN CART METHODS ============

  async getCart(user: User) {
    const cacheKey = CACHE_KEYS.CART(user.id);

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        const cart = await this.prisma.cart.findUnique({
          where: { userId: user.id },
          include: {
            items: {
              include: {
                product: {
                  include: {
                    images: {
                      where: { isPrimary: true },
                      take: 1,
                    },
                    vendor: {
                      select: {
                        id: true,
                        name: true,
                        slug: true,
                      },
                    },
                  },
                },
              },
            },
          },
        });

        if (!cart) {
          // Create empty cart if none exists
          return this.createEmptyCart(user);
        }

        // Calculate totals (ensure they're correct)
        const calculatedCart = this.calculateCartTotals(cart);

        return calculatedCart;
      },
      {
        ttl: this.CART_TTL,
        tags: [CACHE_KEYS.CART(user.id)],
      },
    );
  }

  async addToCart(user: User, dto: AddToCartDto) {
    const { productId, quantity, selectedSize, selectedColor } = dto;

    // Get product with current price and stock
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        sizes: true,
        colors: true,
      },
    });

    if (!product) {
      throw new ProductNotFoundException();
    }

    // Check if product is published and in stock
    if (product.status !== 'PUBLISHED' || !product.isPublished) {
      throw new BadRequestException('Product is not available');
    }

    // Validate stock
    await this.validateStock(product, quantity, selectedSize);

    // Get or create cart
    let cart = await this.prisma.cart.findUnique({
      where: { userId: user.id },
    });

    if (!cart) {
      cart = await this.prisma.cart.create({
        data: { userId: user.id },
      });
    }

    // Check if item already exists in cart with same variants
    const existingItem = await this.prisma.cartItem.findFirst({
      where: {
        cartId: cart.id,
        productId,
        selectedSize: selectedSize || null,
        selectedColor: selectedColor || null,
      },
    });

    let updatedCart;

    if (existingItem) {
      // Update existing item
      const newQuantity = existingItem.quantity + quantity;

      // Validate stock again for total quantity
      await this.validateStock(product, newQuantity, selectedSize);

      updatedCart = await this.prisma.$transaction(async (tx) => {
        await tx.cartItem.update({
          where: { id: existingItem.id },
          data: {
            quantity: newQuantity,
            total: product.price * newQuantity,
          },
        });

        return this.recalculateCart(tx, cart.id);
      });
    } else {
      // Create new item
      updatedCart = await this.prisma.$transaction(async (tx) => {
        await tx.cartItem.create({
          data: {
            cartId: cart.id,
            productId,
            quantity,
            selectedSize,
            selectedColor,
            price: product.price,
            total: product.price * quantity,
          },
        });

        return this.recalculateCart(tx, cart.id);
      });
    }

    // Invalidate cache
    await this.cache.deleteByTag(CACHE_KEYS.CART(user.id));

    return updatedCart;
  }

  async updateCartItem(user: User, itemId: string, dto: UpdateCartItemDto) {
    const { quantity } = dto;

    // Get cart item with product
    const cartItem = await this.prisma.cartItem.findUnique({
      where: { id: itemId },
      include: {
        cart: true,
        product: {
          include: { sizes: true },
        },
      },
    });

    if (!cartItem) {
      throw new CartItemNotFoundException('Cart item not found');
    }

    // Verify cart belongs to user
    if (cartItem.cart.userId !== user.id) {
      throw new BadRequestException('Cart item does not belong to you');
    }

    if (quantity === 0) {
      // Remove item if quantity is 0
      return this.removeFromCart(user, itemId);
    }

    // Validate stock
    await this.validateStock(cartItem.product, quantity, cartItem.selectedSize);

    // Update quantity
    const updatedCart = await this.prisma.$transaction(async (tx) => {
      await tx.cartItem.update({
        where: { id: itemId },
        data: {
          quantity,
          total: cartItem.product.price * quantity,
        },
      });

      return this.recalculateCart(tx, cartItem.cartId);
    });

    // Invalidate cache
    await this.cache.deleteByTag(CACHE_KEYS.CART(user.id));

    return updatedCart;
  }

  async removeFromCart(user: User, itemId: string) {
    const cartItem = await this.prisma.cartItem.findUnique({
      where: { id: itemId },
      include: { cart: true },
    });

    if (!cartItem) {
      throw new CartItemNotFoundException('Cart item not found');
    }

    if (cartItem.cart.userId !== user.id) {
      throw new BadRequestException('Cart item does not belong to you');
    }

    const updatedCart = await this.prisma.$transaction(async (tx) => {
      await tx.cartItem.delete({
        where: { id: itemId },
      });

      return this.recalculateCart(tx, cartItem.cartId);
    });

    // Invalidate cache
    await this.cache.deleteByTag(CACHE_KEYS.CART(user.id));

    return updatedCart;
  }

  async clearCart(user: User) {
    const cart = await this.prisma.cart.findUnique({
      where: { userId: user.id },
    });

    if (!cart) {
      return { message: 'Cart is already empty' };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.cartItem.deleteMany({
        where: { cartId: cart.id },
      });

      await tx.cart.update({
        where: { id: cart.id },
        data: {
          total: 0,
          itemCount: 0,
        },
      });
    });

    // Invalidate cache
    await this.cache.deleteByTag(CACHE_KEYS.CART(user.id));

    return { message: 'Cart cleared successfully' };
  }

  // ============ HELPER METHODS ============

  private async createEmptyCart(user: User): Promise<ICart> {
    const cart = await this.prisma.cart.create({
      data: {
        userId: user.id,
        total: 0,
        itemCount: 0,
      },
      include: {
        items: {
          include: {
            product: {
              include: {
                images: { where: { isPrimary: true }, take: 1 },
                vendor: { select: { id: true, name: true, slug: true } },
              },
            },
          },
        },
      },
    });

    return cart;
  }

  private async validateStock(
    product: any,
    quantity: number,
    selectedSize?: string | null,
  ) {
    // Check overall stock
    if (product.stock < quantity) {
      throw new BadRequestException(
        `Only ${product.stock} items available in stock`,
      );
    }

    // Check size-specific stock if applicable
    if (selectedSize) {
      const size = product.sizes?.find((s) => s.sizeId === selectedSize);
      if (size && size.stock < quantity) {
        throw new BadRequestException(
          `Only ${size.stock} items available in size ${selectedSize}`,
        );
      }
    }
  }

  private async recalculateCart(tx: any, cartId: string) {
    // Get all items with their current prices
    const items = await tx.cartItem.findMany({
      where: { cartId },
      include: {
        product: {
          select: { price: true },
        },
      },
    });

    // Calculate totals
    const itemCount = items.reduce(
      (sum: number, item: any) => sum + item.quantity,
      0,
    );
    const total = items.reduce(
      (sum: number, item: any) => sum + item.product.price * item.quantity,
      0,
    );

    // Update cart
    const updatedCart = await tx.cart.update({
      where: { id: cartId },
      data: {
        total,
        itemCount,
      },
      include: {
        items: {
          include: {
            product: {
              include: {
                images: { where: { isPrimary: true }, take: 1 },
                vendor: { select: { id: true, name: true, slug: true } },
              },
            },
          },
        },
      },
    });

    return updatedCart;
  }

  private calculateCartTotals(cart: any) {
    let total = 0;
    let itemCount = 0;

    for (const item of cart.items) {
      itemCount += item.quantity;
      total += item.product.price * item.quantity;

      // Update item total for consistency
      item.total = item.product.price * item.quantity;
    }

    cart.total = total;
    cart.itemCount = itemCount;

    return cart;
  }

  // ============ MERGE CART (Anonymous → User) ============

  async mergeCart(userId: string, anonymousCartId?: string) {
    if (!anonymousCartId) {
      return this.getCart({ id: userId } as User);
    }

    // Get anonymous cart from Redis or database
    // This assumes you store anonymous carts in Redis with session ID
    const anonymousCart = await this.cache.get(
      CACHE_KEYS.ANONYMOUS_CART(anonymousCartId),
    ) as any;

    if (!anonymousCart) {
      return this.getCart({ id: userId } as User);
    }

    // Merge logic - add anonymous items to user's cart
    for (const item of anonymousCart.items) {
      try {
        await this.addToCart({ id: userId } as User, {
          productId: item.productId,
          quantity: item.quantity,
          selectedSize: item.selectedSize,
          selectedColor: item.selectedColor,
        });
      } catch (error: any) {
        this.logger.warn(
          `Failed to merge item ${item.productId}: ${error.message}`,
        );
        // Continue with other items
      }
    }

    // Delete anonymous cart
    await this.cache.deleteByTag(anonymousCartId);

    return this.getCart({ id: userId } as User);
  }
}
