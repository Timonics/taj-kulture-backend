export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;      // Optional success message
  data?: T;              // Response payload
  errors?: any[];        // For validation errors (optional)
  meta?: {
    timestamp: string;
    path: string;
    responseTime?: string;
    page?: number;
    limit?: number;
    total?: number;
    pages?: number;
    hasNext?: boolean;
    hasPrev?: boolean;
  };
}