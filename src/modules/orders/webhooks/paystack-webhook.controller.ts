import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { OrdersService } from '../orders.service';
import { PaystackWebhookDto } from '../dto';
import { Public } from 'src/core/decorators/public.decorator';

@Controller('webhooks/paystack')
@Public()
export class PaystackWebhookController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Body() payload: PaystackWebhookDto,
    @Headers('x-paystack-signature') signature: string,
  ) {
    // Verify signature (implement signature verification)

    if (payload.event === 'charge.success') {
      const reference = payload.data.reference;
      await this.ordersService.verifyPayment(reference, 'paystack');
    }

    return { status: 'received' };
  }
}
