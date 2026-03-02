export interface ServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface PaginatedServiceResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}