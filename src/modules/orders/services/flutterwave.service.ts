import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PaymentGateway, InitializePaymentResponse, VerifyPaymentResponse } from '../interfaces/payment-gateway.interface';

@Injectable()
export class FlutterwaveService implements PaymentGateway {
  private readonly logger = new Logger(FlutterwaveService.name);
  private readonly apiUrl = 'https://api.flutterwave.com/v3';
  private readonly secretKey?: string;

  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
  ) {
    this.secretKey = this.configService.get('FLUTTERWAVE_SECRET_KEY');
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
          `${this.apiUrl}/payments`,
          {
            tx_ref: `TAJ-${orderId}-${Date.now()}`,
            amount,
            currency: 'NGN',
            redirect_url: `${this.configService.get('FRONTEND_URL')}/orders/callback`,
            customer: {
              email,
            },
            meta: {
              orderId,
              ...metadata,
            },
          },
          {
            headers: {
              Authorization: `Bearer ${this.secretKey}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      const data = response.data;

      if (data.status === 'success') {
        return {
          success: true,
          authorizationUrl: data.data.link,
          reference: data.data.tx_ref,
        };
      }

      return {
        success: false,
        reference: '',
        message: data.message,
      };
    } catch (error) {
      this.logger.error('Flutterwave initialization failed:', error);
      throw new HttpException(
        'Payment initialization failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async verify(reference: string): Promise<VerifyPaymentResponse> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.apiUrl}/transactions/verify_by_reference?tx_ref=${reference}`, {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
          },
        }),
      );

      const data = response.data;

      if (data.status === 'success') {
        const transaction = data.data;
        return {
          success: true,
          status: transaction.status === 'successful' ? 'success' : 'failed',
          amount: transaction.amount,
          currency: transaction.currency,
          reference: transaction.tx_ref,
          paidAt: transaction.created_at ? new Date(transaction.created_at) : undefined,
          gatewayResponse: transaction.processor_response,
          metadata: transaction.meta,
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
      this.logger.error('Flutterwave verification failed:', error);
      throw new HttpException(
        'Payment verification failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async handleWebhook(payload: any): Promise<{ orderId: string; status: string; reference: string }> {
    // Verify webhook signature
    const signature = payload.headers['verif-hash'];
    // TODO: Verify signature against secret

    const event = payload.body;
    
    if (event.event === 'charge.completed' && event.data.status === 'successful') {
      const reference = event.data.tx_ref;
      const meta = event.data.meta;
      
      return {
        orderId: meta.orderId,
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