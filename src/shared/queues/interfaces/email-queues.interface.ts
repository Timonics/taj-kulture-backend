export interface SendVerificationJobData {
  email: string;
  name: string;
  verificationToken: string;
  correlationId?: string;
}

export interface SendPasswordResetJobData {
  email: string;
  name: string;
  resetToken: string;
  correlationId?: string;
}

export interface SendWelcomeJobData {
  email: string;
  name: string;
  correlationId?: string;
}

export interface SendOrderConfirmationJobData {
  email: string;
  name: string;
  orderNumber: string;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    price: number;
  }>;
  total: number;
  correlationId?: string;
}

export interface SendShippingUpdateJobData {
  email: string;
  name: string;
  orderNumber: string;
  trackingNumber: string;
  carrier: string;
  estimatedDelivery?: Date;
  correlationId?: string;
}

export interface SendOrderCancellationJobData {
  email: string;
  orderNumber: string;
  reason?: string;
  correlationId?: string;
}

export interface SendVendorApprovalJobData {
  email: string;
  storeName: string;
  correlationId?: string;
}

export interface SendVendorRejectionJobData {
  email: string;
  storeName: string;
  reason?: string;
  correlationId?: string;
}