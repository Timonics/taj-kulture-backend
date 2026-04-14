import { Exclude, Expose } from 'class-transformer';
import { OrderStatus, PaymentStatus } from 'generated/prisma/client';

export class OrderItemResponseDto {
  id: string;
  productId: string;
  productName: string;
  productImage?: string;
  price: number;
  quantity: number;
  total: number;
  selectedSize?: string;
  selectedColor?: string;
  status: OrderStatus;
}

export class OrderResponseDto {
  id: string;
  orderNumber: string;
  userId: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  subtotal: number;
  shipping: number;
  tax: number;
  discount: number;
  total: number;
  shippingAddress: any;
  shippingMethod?: string;
  trackingNumber?: string;
  paymentMethod?: string;
  paymentId?: string;
  customerNotes?: string;
  orderDate: Date;
  shippedDate?: Date;
  deliveredDate?: Date;
  cancelledDate?: Date;
  items: OrderItemResponseDto[];

  constructor(partial: Partial<OrderResponseDto>) {
    Object.assign(this, partial);
  }
}
