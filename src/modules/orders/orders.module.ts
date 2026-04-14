import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { PaystackService } from './services/paystack.service';
import { FlutterwaveService } from './services/flutterwave.service';
import { PaystackWebhookController } from './webhooks/paystack-webhook.controller';
import { FlutterwaveWebhookController } from './webhooks/flutterwave-webhook.controller';
import { PrismaService } from '../../shared/database/prisma.service';

@Module({
  imports: [HttpModule],
  controllers: [
    OrdersController,
    PaystackWebhookController,
    FlutterwaveWebhookController,
  ],
  providers: [
    OrdersService,
    PaystackService,
    FlutterwaveService,
    PrismaService,
  ],
  exports: [OrdersService],
})
export class OrdersModule {}
