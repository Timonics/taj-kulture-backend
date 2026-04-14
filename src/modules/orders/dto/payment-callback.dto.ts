import { IsString, IsUUID } from 'class-validator';

export class PaystackWebhookDto {
  event: string;
  data: {
    id: number;
    reference: string;
    status: string;
    amount: number;
    currency: string;
    gateway_response: string;
    paid_at: string;
    created_at: string;
    channel: string;
    metadata?: any;
    customer: {
      id: number;
      email: string;
    };
  };
}

export class FlutterwaveWebhookDto {
  event: string;
  data: {
    id: number;
    tx_ref: string;
    flw_ref: string;
    amount: number;
    currency: string;
    status: string;
    payment_type: string;
    created_at: string;
    customer: {
      id: number;
      email: string;
    };
  };
}

export class InitializePaymentDto {
  @IsUUID()
  orderId: string;

  @IsString()
  gateway: 'paystack' | 'flutterwave';
}
