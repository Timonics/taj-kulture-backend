export class SalesOverviewDto {
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  conversionRate: number;
  revenueChange: number;
  ordersChange: number;
  aovChange: number;
}

export class SalesTrendDto {
  date: string;
  revenue: number;
  orders: number;
  averageOrderValue: number;
}

export class SalesByVendorDto {
  vendorId: string;
  vendorName: string;
  revenue: number;
  orders: number;
  productsSold: number;
  commission: number;
}

export class SalesByCategoryDto {
  categoryId: string;
  categoryName: string;
  revenue: number;
  orders: number;
  productsSold: number;
}

export class HourlySalesDto {
  hour: number;
  revenue: number;
  orders: number;
}

export class PaymentMethodBreakdownDto {
  method: string;
  count: number;
  revenue: number;
  percentage: number;
}

export class OrderStatusBreakdownDto {
  status: string;
  count: number;
  percentage: number;
}
