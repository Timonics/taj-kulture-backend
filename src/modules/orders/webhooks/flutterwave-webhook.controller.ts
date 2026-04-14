import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { OrdersService } from '../orders.service';
import { FlutterwaveWebhookDto } from '../dto';
import { Public } from 'src/core/decorators/public.decorator';

@Controller('webhooks/flutterwave')
@Public()
export class FlutterwaveWebhookController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Body() payload: FlutterwaveWebhookDto,
    @Headers('verif-hash') signature: string,
  ) {
    // Verify signature (implement signature verification)

    if (
      payload.event === 'charge.completed' &&
      payload.data.status === 'successful'
    ) {
      const reference = payload.data.tx_ref;
      await this.ordersService.verifyPayment(reference, 'flutterwave');
    }

    return { status: 'received' };
  }
}
