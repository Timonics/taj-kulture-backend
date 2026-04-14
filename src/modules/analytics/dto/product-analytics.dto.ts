export class ProductOverviewDto {
  totalProducts: number;
  publishedProducts: number;
  outOfStockProducts: number;
  lowStockProducts: number;
  averagePrice: number;
  totalViews: number;
  totalSales: number;
}

export class TopProductsDto {
  productId: string;
  productName: string;
  vendorName: string;
  sales: number;
  revenue: number;
  views: number;
  conversionRate: number;
  rating: number;
}

export class ProductPerformanceDto {
  date: string;
  views: number;
  sales: number;
  revenue: number;
}

export class ProductInventoryDto {
  productId: string;
  productName: string;
  stock: number;
  lowStock: boolean;
  outOfStock: boolean;
  daysUntilOutOfStock: number | null;
}

export class CategoryPerformanceDto {
  categoryId: string;
  categoryName: string;
  products: number;
  sales: number;
  revenue: number;
  averagePrice: number;
}

export class VendorPerformanceDto {
  vendorId: string;
  vendorName: string;
  products: number;
  sales: number;
  revenue: number;
  averageRating: number;
  commissionEarned: number;
}