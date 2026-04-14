// src/modules/orders/dto/update-order-status.dto.ts
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { OrderStatus } from 'generated/prisma/client';

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus)
  status: OrderStatus;

  @IsString()
  @IsOptional()
  trackingNumber?: string;

  @IsString()
  @IsOptional()
  adminNotes?: string;
}