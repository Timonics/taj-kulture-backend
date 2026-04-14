import { IsOptional, IsString, IsDateString } from 'class-validator';

export class DashboardStatsQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsString()
  period?: 'day' | 'week' | 'month' | 'year';
}

export class SalesStatsDto {
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  revenueChange: number;
  ordersChange: number;
  dailySales: Array<{ date: string; revenue: number; orders: number }>;
}

export class UserStatsDto {
  totalUsers: number;
  newUsersToday: number;
  newUsersThisWeek: number;
  activeUsers: number;
  usersByRole: Record<string, number>;
  usersGrowth: number;
}

export class VendorStatsDto {
  totalVendors: number;
  pendingVendors: number;
  verifiedVendors: number;
  featuredVendors: number;
  vendorsGrowth: number;
  topVendors: Array<{
    id: string;
    name: string;
    totalSales: number;
    productCount: number;
    rating: number;
  }>;
}

export class ProductStatsDto {
  totalProducts: number;
  publishedProducts: number;
  draftProducts: number;
  outOfStockProducts: number;
  productsGrowth: number;
  topProducts: Array<{
    id: string;
    name: string;
    sales: number;
    revenue: number;
    views: number;
  }>;
}