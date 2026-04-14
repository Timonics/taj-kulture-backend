import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import {
  CreateOrderDto,
  UpdateOrderStatusDto,
  InitializePaymentDto,
} from './dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from 'src/core/decorators/current-user.decorator';
import { UserRole } from 'generated/prisma/client';
import { Roles } from 'src/core/decorators/roles.decorator';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  async createOrder(
    @CurrentUser('id') userId: string,
    @Body() createOrderDto: CreateOrderDto,
  ) {
    const order = await this.ordersService.createOrder(userId, createOrderDto);
    return {
      success: true,
      message: 'Order created successfully',
      data: order,
    };
  }

  @Post(':id/payment')
  async initializePayment(
    @Param('id') orderId: string,
    @CurrentUser('id') userId: string,
    @Body() initPaymentDto: InitializePaymentDto,
  ) {
    const result = await this.ordersService.initializePayment(
      orderId,
      initPaymentDto.gateway,
      userId,
    );
    return {
      success: true,
      data: result,
    };
  }

  @Get('callback')
  async paymentCallback(
    @Query('reference') reference: string,
    @Query('gateway') gateway: 'paystack' | 'flutterwave',
  ) {
    const result = await this.ordersService.verifyPayment(reference, gateway);
    return {
      success: true,
      data: result,
    };
  }

  @Get()
  async CurrentUserOrders(
    @CurrentUser('id') userId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    const result = await this.ordersService.getUserOrders(
      userId,
      +page,
      +limit,
    );
    return {
      success: true,
      data: result.data,
      meta: result.meta,
    };
  }

  @Get('vendor')
  @Roles(UserRole.VENDOR)
  async getVendorOrders(
    @CurrentUser('id') userId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    const result = await this.ordersService.getVendorOrdersByUser(
      userId,
      +page,
      +limit,
    );
    return {
      success: true,
      data: result.data,
      meta: result.meta,
    };
  }

  @Get(':id')
  async getOrder(
    @Param('id') orderId: string,
    @CurrentUser('id') userId: string,
  ) {
    const order = await this.ordersService.getOrderById(orderId, userId);
    return {
      success: true,
      data: order,
    };
  }

  @Patch(':id/status')
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  async updateOrderStatus(
    @Param('id') orderId: string,
    @CurrentUser('id') userId: string,
    @Body() updateStatusDto: UpdateOrderStatusDto,
  ) {
    const order = await this.ordersService.updateOrderStatus(
      orderId,
      updateStatusDto,
      userId,
    );
    return {
      success: true,
      message: 'Order status updated',
      data: order,
    };
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelOrder(
    @Param('id') orderId: string,
    @CurrentUser('id') userId: string,
  ) {
    const order = await this.ordersService.cancelOrder(orderId, userId);
    return {
      success: true,
      message: 'Order cancelled successfully',
      data: order,
    };
  }
}
