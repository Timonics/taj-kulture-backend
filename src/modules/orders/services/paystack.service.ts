import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import {
  PaymentGateway,
  InitializePaymentResponse,
  VerifyPaymentResponse,
  InitializeResponse,
} from '../interfaces/payment-gateway.interface';

@Injectable()
export class PaystackService implements PaymentGateway {
  private readonly logger = new Logger(PaystackService.name);
  private readonly apiUrl = 'https://api.paystack.co';
  private readonly secretKey?: string;

  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
  ) {
    this.secretKey = this.configService.get('PAYSTACK_SECRET_KEY');
  }

  async initialize(
    orderId: string,
    amount: number,
    email: string,
    metadata?: any,
  ): Promise<InitializePaymentResponse> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.apiUrl}/transaction/initialize`,
          {
            amount: Math.round(amount * 100), // Paystack uses kobo
            email,
            reference: `TAJ-${orderId}-${Date.now()}`,
            metadata: {
              orderId,
              ...metadata,
            },
            callback_url: `${this.configService.get('FRONTEND_URL')}/orders/callback`,
          },
          {
            headers: {
              Authorization: `Bearer ${this.secretKey}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      const data = response.data as InitializeResponse;

      if (data.status) {
        return {
          success: true,
          authorizationUrl: data.data.authorization_url,
          reference: data.data.reference,
        };
      }

      return {
        success: false,
        reference: '',
        message: data.message,
      };
    } catch (error) {
      this.logger.error('Paystack initialization failed:', error);
      throw new HttpException(
        'Payment initialization failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async verify(reference: string): Promise<VerifyPaymentResponse> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.apiUrl}/transaction/verify/${reference}`, {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
          },
        }),
      );

      const data = response.data;

      if (data.status) {
        const transaction = data.data;
        return {
          success: true,
          status: transaction.status === 'success' ? 'success' : 'failed',
          amount: transaction.amount / 100,
          currency: transaction.currency,
          reference: transaction.reference,
          paidAt: transaction.paid_at
            ? new Date(transaction.paid_at)
            : undefined,
          gatewayResponse: transaction.gateway_response,
          metadata: transaction.metadata,
        };
      }

      return {
        success: false,
        status: 'failed',
        amount: 0,
        currency: 'NGN',
        reference,
      };
    } catch (error) {
      this.logger.error('Paystack verification failed:', error);
      throw new HttpException(
        'Payment verification failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async handleWebhook(
    payload: any,
  ): Promise<{ orderId: string; status: string; reference: string }> {
    // Verify webhook signature
    const signature = payload.headers['x-paystack-signature'];
    // TODO: Verify signature against secret

    const event = payload.body;

    if (event.event === 'charge.success') {
      const reference = event.data.reference;
      const metadata = event.data.metadata;

      return {
        orderId: metadata.orderId,
        status: 'success',
        reference,
      };
    }

    return {
      orderId: '',
      status: 'pending',
      reference: '',
    };
  }
}
