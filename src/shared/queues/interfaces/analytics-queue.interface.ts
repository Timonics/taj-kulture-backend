export interface TrackProductViewJobData {
  productId: string;
  userId?: string;
  sessionId: string;
  correlationId?: string;
}

export interface TrackSearchJobData {
  query: string;
  userId?: string;
  sessionId: string;
  resultsCount: number;
  filters?: Record<string, any>;
  correlationId?: string;
}

export interface TrackOrderJobData {
  orderId: string;
  userId: string;
  total: number;
  items: Array<{
    productId: string;
    vendorId: string;
    productName: string;
    quantity: number;
    price: number;
  }>;
  correlationId?: string;
}

export interface TrackRegistrationJobData {
  userId: string;
  method: 'email' | 'google' | 'facebook';
  correlationId?: string;
}
