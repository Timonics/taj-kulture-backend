export interface PaymentGateway {
  initialize(
    orderId: string,
    amount: number,
    email: string,
    metadata?: any,
  ): Promise<InitializePaymentResponse>;
  verify(reference: string): Promise<VerifyPaymentResponse>;
  handleWebhook(
    payload: any,
  ): Promise<{ orderId: string; status: string; reference: string }>;
}

export interface InitializeResponse {
  status: true;
  message: string;
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

export interface InitializePaymentResponse {
  success: boolean;
  authorizationUrl?: string;
  reference: string;
  message?: string;
}

export interface VerifyPaymentResponse {
  success: boolean;
  status: 'success' | 'failed' | 'pending';
  amount: number;
  currency: string;
  reference: string;
  paidAt?: Date;
  gatewayResponse?: string;
  metadata?: any;
}
