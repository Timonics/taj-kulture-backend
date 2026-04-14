// src/modules/orders/orders.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/shared/database/prisma.service';
import { EventBus } from 'src/shared/events/event-bus.service';
import { ORDER_EVENTS } from 'src/shared/events/event-types';
import { PaystackService } from './services/paystack.service';
import { FlutterwaveService } from './services/flutterwave.service';
import { CreateOrderDto, UpdateOrderStatusDto } from './dto';
import { OrderStatus, PaymentStatus, UserRole } from 'generated/prisma/client';
import { OrderNotFoundException } from 'src/core/exceptions/order.exception';
import {
  CartEmptyException,
  ProductOutOfStockException,
  UnauthorizedException,
} from 'src/core/exceptions';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private eventBus: EventBus,
    private paystackService: PaystackService,
    private flutterwaveService: FlutterwaveService,
  ) {}

  async createOrder(userId: string, createOrderDto: CreateOrderDto) {
    const { addressId, shippingAddress, customerNotes } = createOrderDto;

    // Get user with cart items
    const cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              include: {
                images: true,
              },
            },
          },
        },
      },
    });

    if (!cart || cart.items.length === 0) {
      throw new CartEmptyException();
    }

    // Calculate totals
    let subtotal = 0;
    const orderItemsData: any[] = [];

    for (const cartItem of cart.items) {
      // Check stock
      if (cartItem.product.stock < cartItem.quantity) {
        throw new ProductOutOfStockException(
          cartItem.productId,
          `${cartItem.product.name} is out of stock. Available: ${cartItem.product.stock}`,
        );
      }

      const itemTotal = cartItem.price * cartItem.quantity;
      subtotal += itemTotal;

      // Get primary image
      const primaryImage =
        cartItem.product.images?.find((img) => img.isPrimary) ||
        cartItem.product.images?.[0];

      orderItemsData.push({
        productId: cartItem.productId,
        vendorId: cartItem.product.vendorId,
        productName: cartItem.product.name,
        productImage: primaryImage?.url || null,
        price: cartItem.price,
        quantity: cartItem.quantity,
        total: itemTotal,
        selectedSize: cartItem.selectedSize,
        selectedColor: cartItem.selectedColor,
      });
    }

    // Calculate shipping and tax
    const shipping = 2000; // Base shipping in NGN
    const tax = subtotal * 0.075; // 7.5% VAT
    const total = subtotal + shipping + tax;

    // Get shipping address
    let finalShippingAddress = shippingAddress;
    if (addressId) {
      const address = await this.prisma.address.findUnique({
        where: { id: addressId },
      });
      if (address) {
        finalShippingAddress = address;
      }
    }

    if (!finalShippingAddress) {
      throw new BadRequestException('Shipping address is required');
    }

    // Generate order number
    const orderNumber = `TAJ-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Get user email for event
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, firstName: true, lastName: true },
    });

    // Create order with transaction to ensure consistency
    const order = await this.prisma.$transaction(async (tx) => {
      // Create order
      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          userId,
          subtotal,
          shipping,
          tax,
          total,
          shippingAddress: finalShippingAddress,
          customerNotes,
          items: {
            create: orderItemsData,
          },
        },
        include: {
          items: true,
        },
      });

      // Update product stock
      for (const cartItem of cart.items) {
        await tx.product.update({
          where: { id: cartItem.productId },
          data: {
            stock: { decrement: cartItem.quantity },
          },
        });
      }

      // Clear cart
      await tx.cartItem.deleteMany({
        where: { cartId: cart.id },
      });

      return newOrder;
    });

    // Emit order created event
    this.eventBus.emit({
      name: ORDER_EVENTS.CREATED,
      payload: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        userId: order.userId,
        userEmail: user?.email || '',
        userName: user?.firstName || user?.lastName || 'Customer',
        items: order.items.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          price: item.price,
        })),
        subtotal: order.subtotal,
        shipping: order.shipping,
        tax: order.tax,
        total: order.total,
        shippingAddress: finalShippingAddress,
        createdAt: order.orderDate,
      },
    });

    return order;
  }

  async initializePayment(
    orderId: string,
    gateway: 'paystack' | 'flutterwave',
    userId: string,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { user: true },
    });

    if (!order) {
      throw new OrderNotFoundException();
    }

    if (order.userId !== userId) {
      throw new UnauthorizedException('Order does not belong to user');
    }

    if (order.paymentStatus !== PaymentStatus.PENDING) {
      throw new BadRequestException('Payment already processed');
    }

    const paymentService =
      gateway === 'paystack' ? this.paystackService : this.flutterwaveService;

    const result = await paymentService.initialize(
      orderId,
      order.total,
      order.user.email,
      { orderId, orderNumber: order.orderNumber },
    );

    return result;
  }

  async verifyPayment(reference: string, gateway: 'paystack' | 'flutterwave') {
    const paymentService =
      gateway === 'paystack' ? this.paystackService : this.flutterwaveService;

    const verification = await paymentService.verify(reference);

    if (verification.success && verification.status === 'success') {
      // Find order by reference in metadata
      const order = await this.prisma.order.findFirst({
        where: {
          paymentId: reference,
        },
      });

      if (order) {
        const updatedOrder = await this.prisma.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: PaymentStatus.COMPLETED,
            paymentId: reference,
            paymentMethod: gateway,
            status: OrderStatus.CONFIRMED,
            // paymentDate: new Date(),
          },
        });

        this.eventBus.emit({
          name: ORDER_EVENTS.PAID,
          payload: {
            orderId: updatedOrder.id,
            orderNumber: updatedOrder.orderNumber,
            userId: updatedOrder.userId,
            userEmail: '', // Will be filled by event handler if needed
            paymentMethod: gateway,
            paymentId: reference,
            paidAt: new Date(),
            amount: updatedOrder.total
          },
        });
      }
    }

    return verification;
  }

  async getUserOrders(userId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where: { userId },
        include: {
          items: true,
        },
        orderBy: { orderDate: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.order.count({ where: { userId } }),
    ]);

    return {
      data: orders,
      meta: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getVendorOrders(vendorId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          items: {
            some: { vendorId },
          },
        },
        include: {
          items: {
            where: { vendorId },
          },
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { orderDate: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.order.count({
        where: {
          items: {
            some: { vendorId },
          },
        },
      }),
    ]);

    return {
      data: orders,
      meta: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getOrderById(orderId: string, userId?: string, vendorId?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!order) {
      throw new OrderNotFoundException();
    }

    // Check authorization
    if (userId && order.userId !== userId) {
      // Check if vendor has items in this order
      if (vendorId) {
        const hasVendorItems = order.items.some(
          (item) => item.vendorId === vendorId,
        );
        if (!hasVendorItems) {
          throw new UnauthorizedException('Unauthorized to view this order');
        }
      } else {
        throw new UnauthorizedException('Unauthorized to view this order');
      }
    }

    return order;
  }

  async updateOrderStatus(
    orderId: string,
    updateStatusDto: UpdateOrderStatusDto,
    userId: string,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        user: {
          select: { email: true, firstName: true, lastName: true },
        },
      },
    });

    if (!order) {
      throw new OrderNotFoundException();
    }

    // Get user role
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    const isAdmin = user?.role === UserRole.ADMIN;

    // Check if vendor owns any items in this order
    if (!isAdmin) {
      const vendor = await this.prisma.vendor.findUnique({
        where: { userId },
        select: { id: true },
      });

      if (vendor) {
        const hasVendorItems = order.items.some(
          (item) => item.vendorId === vendor.id,
        );
        if (!hasVendorItems) {
          throw new UnauthorizedException('Unauthorized to update this order');
        }
      }
    }

    const { status, trackingNumber, adminNotes } = updateStatusDto;

    const updateData: any = { status };

    if (trackingNumber) {
      updateData.trackingNumber = trackingNumber;
    }

    if (adminNotes && isAdmin) {
      updateData.adminNotes = adminNotes;
    }

    if (status === OrderStatus.SHIPPED) {
      updateData.shippedDate = new Date();
    }

    if (status === OrderStatus.DELIVERED) {
      updateData.deliveredDate = new Date();
    }

    if (status === OrderStatus.CANCELLED) {
      updateData.cancelledDate = new Date();
    }

    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: updateData,
      include: { items: true },
    });

    // Emit appropriate event based on status
    if (status === OrderStatus.SHIPPED) {
      this.eventBus.emit({
        name: ORDER_EVENTS.SHIPPED,
        payload: {
          orderId: updatedOrder.id,
          orderNumber: updatedOrder.orderNumber,
          userId: updatedOrder.userId,
          userEmail: order.user?.email || '',
          userName: order.user?.firstName || order.user?.lastName || 'Customer',
          trackingNumber: trackingNumber || '',
          carrier: 'Courier',
          estimatedDelivery: undefined,
          shippedAt: new Date(),
        },
      });
    }

    if (status === OrderStatus.DELIVERED) {
      this.eventBus.emit({
        name: ORDER_EVENTS.DELIVERED,
        payload: {
          orderId: updatedOrder.id,
          orderNumber: updatedOrder.orderNumber,
          userId: updatedOrder.userId,
          userEmail: order.user?.email || '',
          deliveredAt: new Date(),
        },
      });
    }

    if (status === OrderStatus.CANCELLED) {
      this.eventBus.emit({
        name: ORDER_EVENTS.CANCELLED,
        payload: {
          orderId: updatedOrder.id,
          orderNumber: updatedOrder.orderNumber,
          userId: updatedOrder.userId,
          userEmail: order.user?.email || '',
          reason: adminNotes,
          cancelledBy: isAdmin ? 'admin' : 'user',
          cancelledAt: new Date(),
        },
      });
    }

    return updatedOrder;
  }

  async getVendorOrdersByUser(userId: string, page = 1, limit = 10) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!vendor) {
      throw new UnauthorizedException('You do not have a vendor profile');
    }

    return this.getVendorOrders(vendor.id, page, limit);
  }

  async cancelOrder(orderId: string, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: {
          select: { email: true, firstName: true, lastName: true },
        },
      },
    });

    if (!order) {
      throw new OrderNotFoundException();
    }

    if (order.userId !== userId) {
      throw new UnauthorizedException('Unauthorized to cancel this order');
    }

    // Check if order can be cancelled (only pending or processing orders)
    if (
      order.status !== OrderStatus.PENDING &&
      order.status !== OrderStatus.PROCESSING
    ) {
      throw new BadRequestException('Order cannot be cancelled at this stage');
    }

    // Use transaction for consistency
    const cancelledOrder = await this.prisma.$transaction(async (tx) => {
      // Update order status
      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.CANCELLED,
          cancelledDate: new Date(),
        },
      });

      // Restore stock
      const orderItems = await tx.orderItem.findMany({
        where: { orderId },
      });

      for (const item of orderItems) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: { increment: item.quantity },
          },
        });
      }

      return updated;
    });

    this.eventBus.emit({
      name: ORDER_EVENTS.CANCELLED,
      payload: {
        orderId: cancelledOrder.id,
        orderNumber: cancelledOrder.orderNumber,
        userId: cancelledOrder.userId,
        userEmail: order.user?.email || '',
        reason: 'User requested cancellation',
        cancelledBy: 'user',
        cancelledAt: new Date(),
      },
    });

    return cancelledOrder;
  }
}
