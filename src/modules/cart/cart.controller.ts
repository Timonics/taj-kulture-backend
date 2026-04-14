import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { User } from 'generated/prisma/client';
import { CartResponseDto } from './dto/cart-response.dto';
import { CurrentUser } from 'src/core/decorators/current-user.decorator';
// import { Serialize } from 'src/core/interceptors/serialize.interceptor';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('cart')
@UseGuards(JwtAuthGuard)
// @Serialize(CartResponseDto)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  async getCart(@CurrentUser() user: User) {
    return this.cartService.getCart(user);
  }

  @Post('items')
  @HttpCode(HttpStatus.OK)
  async addToCart(@CurrentUser() user: User, @Body() dto: AddToCartDto) {
    return this.cartService.addToCart(user, dto);
  }

  @Patch('items/:itemId')
  async updateCartItem(
    @CurrentUser() user: User,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.cartService.updateCartItem(user, itemId, dto);
  }

  @Delete('items/:itemId')
  async removeFromCart(@CurrentUser() user: User, @Param('itemId') itemId: string) {
    return this.cartService.removeFromCart(user, itemId);
  }

  @Delete()
  async clearCart(@CurrentUser() user: User) {
    return this.cartService.clearCart(user);
  }

  // For anonymous cart merge after login
  @Post('merge')
  @HttpCode(HttpStatus.OK)
  async mergeCart(
    @CurrentUser() user: User,
    @Body('anonymousCartId') anonymousCartId?: string,
  ) {
    return this.cartService.mergeCart(user.id, anonymousCartId);
  }
}
