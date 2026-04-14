// import { Injectable, Logger } from '@nestjs/common';
// import { PrismaService } from '../../shared/database/prisma.service';
// import { AnalyticsQueryDto, ExportAnalyticsDto } from './dto';
// import { OrderStatus, PaymentStatus, UserRole } from 'generated/prisma/client';
// import { subDays, subWeeks, subMonths, format, startOfDay, endOfDay } from 'date-fns';

// @Injectable()
// export class AnalyticsService {
//   private readonly logger = new Logger(AnalyticsService.name);

//   constructor(private prisma: PrismaService) {}

//   // ============ SALES ANALYTICS ============

//   async getSalesOverview(query: AnalyticsQueryDto) {
//     const { startDate, endDate, comparePrevious } = query;
//     const dateRange = this.buildDateRange(query);

//     const [currentStats, previousStats] = await Promise.all([
//       this.getSalesStats(dateRange),
//       comparePrevious ? this.getSalesStats(this.getPreviousDateRange(dateRange)) : Promise.resolve(null),
//     ]);

//     const overview = {
//       totalRevenue: currentStats.revenue,
//       totalOrders: currentStats.orders,
//       averageOrderValue: currentStats.orders > 0 ? currentStats.revenue / currentStats.orders : 0,
//       conversionRate: await this.getConversionRate(dateRange),
//     };

//     if (comparePrevious && previousStats) {
//       return {
//         ...overview,
//         revenueChange: previousStats.revenue > 0 
//           ? ((currentStats.revenue - previousStats.revenue) / previousStats.revenue) * 100 
//           : 0,
//         ordersChange: previousStats.orders > 0 
//           ? ((currentStats.orders - previousStats.orders) / previousStats.orders) * 100 
//           : 0,
//         aovChange: previousStats.orders > 0 
//           ? ((overview.averageOrderValue - (previousStats.revenue / previousStats.orders)) / (previousStats.revenue / previousStats.orders)) * 100 
//           : 0,
//       };
//     }

//     return overview;
//   }

//   async getSalesTrend(query: AnalyticsQueryDto) {
//     const dateRange = this.buildDateRange(query);
//     const { groupBy } = query;

//     const orders = await this.prisma.order.findMany({
//       where: {
//         status: OrderStatus.DELIVERED,
//         paymentStatus: PaymentStatus.COMPLETED,
//         orderDate: dateRange,
//       },
//       select: {
//         total: true,
//         orderDate: true,
//       },
//     });

//     const trendMap = new Map<string, { revenue: number; orders: number }>();

//     orders.forEach(order => {
//       let key: string;
//       const date = new Date(order.orderDate);

//       switch (groupBy) {
//         case 'hour':
//           key = format(date, 'yyyy-MM-dd HH:00');
//           break;
//         case 'week':
//           key = format(date, 'yyyy-ww');
//           break;
//         case 'month':
//           key = format(date, 'yyyy-MM');
//           break;
//         case 'quarter':
//           key = `${date.getFullYear()}-Q${Math.floor(date.getMonth() / 3) + 1}`;
//           break;
//         case 'year':
//           key = format(date, 'yyyy');
//           break;
//         default:
//           key = format(date, 'yyyy-MM-dd');
//       }

//       const existing = trendMap.get(key) || { revenue: 0, orders: 0 };
//       trendMap.set(key, {
//         revenue: existing.revenue + order.total,
//         orders: existing.orders + 1,
//       });
//     });

//     const trend: any[] = [];
//     trendMap.forEach((value, key) => {
//       trend.push({
//         date: key,
//         revenue: value.revenue,
//         orders: value.orders,
//         averageOrderValue: value.orders > 0 ? value.revenue / value.orders : 0,
//       });
//     });

//     return trend.sort((a, b) => a.date.localeCompare(b.date));
//   }

//   async getSalesByVendor(query: AnalyticsQueryDto, limit = 10) {
//     const dateRange = this.buildDateRange(query);

//     const vendors = await this.prisma.vendor.findMany({
//       where: {
//         orderItems: {
//           some: {
//             order: {
//               status: OrderStatus.DELIVERED,
//               paymentStatus: PaymentStatus.COMPLETED,
//               orderDate: dateRange,
//             },
//           },
//         },
//       },
//       select: {
//         id: true,
//         name: true,
//         orderItems: {
//           where: {
//             order: {
//               status: OrderStatus.DELIVERED,
//               paymentStatus: PaymentStatus.COMPLETED,
//               orderDate: dateRange,
//             },
//           },
//           select: {
//             quantity: true,
//             total: true,
//           },
//         },
//       },
//       take: limit,
//       orderBy: {
//         orderItems: {
//           _sum: {
//             total: 'desc',
//           },
//         },
//       },
//     });

//     return vendors.map(vendor => ({
//       vendorId: vendor.id,
//       vendorName: vendor.name,
//       revenue: vendor.orderItems.reduce((sum, item) => sum + item.total, 0),
//       productsSold: vendor.orderItems.reduce((sum, item) => sum + item.quantity, 0),
//       commission: vendor.orderItems.reduce((sum, item) => sum + item.total, 0) * 0.1, // 10% commission
//     }));
//   }

//   async getSalesByCategory(query: AnalyticsQueryDto) {
//     const dateRange = this.buildDateRange(query);

//     const categories = await this.prisma.category.findMany({
//       where: {
//         products: {
//           some: {
//             orderItems: {
//               some: {
//                 order: {
//                   status: OrderStatus.DELIVERED,
//                   paymentStatus: PaymentStatus.COMPLETED,
//                   orderDate: dateRange,
//                 },
//               },
//             },
//           },
//         },
//       },
//       select: {
//         id: true,
//         name: true,
//         products: {
//           select: {
//             orderItems: {
//               where: {
//                 order: {
//                   status: OrderStatus.DELIVERED,
//                   paymentStatus: PaymentStatus.COMPLETED,
//                   orderDate: dateRange,
//                 },
//               },
//               select: {
//                 quantity: true,
//                 total: true,
//               },
//             },
//           },
//         },
//       },
//     });

//     return categories.map(category => ({
//       categoryId: category.id,
//       categoryName: category.name,
//       revenue: category.products.reduce(
//         (sum, product) => sum + product.orderItems.reduce((s, item) => s + item.total, 0),
//         0,
//       ),
//       productsSold: category.products.reduce(
//         (sum, product) => sum + product.orderItems.reduce((s, item) => s + item.quantity, 0),
//         0,
//       ),
//     }));
//   }

//   async getHourlySales(query: AnalyticsQueryDto) {
//     const dateRange = this.buildDateRange(query);

//     const orders = await this.prisma.order.findMany({
//       where: {
//         status: OrderStatus.DELIVERED,
//         paymentStatus: PaymentStatus.COMPLETED,
//         orderDate: dateRange,
//       },
//       select: {
//         total: true,
//         orderDate: true,
//       },
//     });

//     const hourlyData: any[] = Array(24).fill(null).map((_, i) => ({
//       hour: i,
//       revenue: 0,
//       orders: 0,
//     }));

//     orders.forEach(order => {
//       const hour = new Date(order.orderDate).getHours();
//       hourlyData[hour].revenue += order.total;
//       hourlyData[hour].orders += 1;
//     });

//     return hourlyData;
//   }

//   async getPaymentMethodBreakdown(query: AnalyticsQueryDto) {
//     const dateRange = this.buildDateRange(query);

//     const orders = await this.prisma.order.findMany({
//       where: {
//         status: OrderStatus.DELIVERED,
//         paymentStatus: PaymentStatus.COMPLETED,
//         orderDate: dateRange,
//       },
//       select: {
//         total: true,
//         paymentMethod: true,
//       },
//     });

//     const breakdown = new Map<string, { revenue: number; count: number }>();

//     orders.forEach(order => {
//       const method = order.paymentMethod || 'unknown';
//       const existing = breakdown.get(method) || { revenue: 0, count: 0 };
//       breakdown.set(method, {
//         revenue: existing.revenue + order.total,
//         count: existing.count + 1,
//       });
//     });

//     const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);

//     return Array.from(breakdown.entries()).map(([method, data]) => ({
//       method,
//       count: data.count,
//       revenue: data.revenue,
//       percentage: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0,
//     }));
//   }

//   async getOrderStatusBreakdown(query: AnalyticsQueryDto) {
//     const dateRange = this.buildDateRange(query);

//     const orders = await this.prisma.order.groupBy({
//       by: ['status'],
//       where: {
//         orderDate: dateRange,
//       },
//       _count: true,
//     });

//     const total = orders.reduce((sum, o) => sum + o._count, 0);

//     return orders.map(order => ({
//       status: order.status,
//       count: order._count,
//       percentage: total > 0 ? (order._count / total) * 100 : 0,
//     }));
//   }

//   // ============ USER ANALYTICS ============

//   async getUserOverview(query: AnalyticsQueryDto) {
//     const dateRange = this.buildDateRange(query);
//     const previousRange = this.getPreviousDateRange(dateRange);

//     const [currentUsers, previousUsers, activeUsers, returningUsers] = await Promise.all([
//       this.prisma.user.count({
//         where: { createdAt: dateRange },
//       }),
//       this.prisma.user.count({
//         where: { createdAt: previousRange },
//       }),
//       this.prisma.user.count({
//         where: { lastLogin: dateRange },
//       }),
//       this.prisma.user.count({
//         where: {
//           AND: [
//             { createdAt: { lt: dateRange.gte } },
//             { lastLogin: dateRange },
//           ],
//         },
//       }),
//     ]);

//     const totalUsers = await this.prisma.user.count();

//     return {
//       totalUsers,
//       newUsers: currentUsers,
//       activeUsers,
//       returningUsers,
//       userGrowth: previousUsers > 0 ? ((currentUsers - previousUsers) / previousUsers) * 100 : 0,
//       activeRate: totalUsers > 0 ? (activeUsers / totalUsers) * 100 : 0,
//     };
//   }

//   async getUserGrowth(query: AnalyticsQueryDto) {
//     const dateRange = this.buildDateRange(query);
//     const { groupBy } = query;

//     const users = await this.prisma.user.findMany({
//       where: {
//         createdAt: dateRange,
//       },
//       select: {
//         createdAt: true,
//       },
//     });

//     const growthMap = new Map<string, number>();
//     let runningTotal = 0;

//     // Get cumulative users before date range
//     const usersBefore = await this.prisma.user.count({
//       where: {
//         createdAt: { lt: dateRange.gte },
//       },
//     });
//     runningTotal = usersBefore;

//     users.forEach(user => {
//       let key: string;
//       const date = new Date(user.createdAt);

//       switch (groupBy) {
//         case 'week':
//           key = format(date, 'yyyy-ww');
//           break;
//         case 'month':
//           key = format(date, 'yyyy-MM');
//           break;
//         case 'quarter':
//           key = `${date.getFullYear()}-Q${Math.floor(date.getMonth() / 3) + 1}`;
//           break;
//         case 'year':
//           key = format(date, 'yyyy');
//           break;
//         default:
//           key = format(date, 'yyyy-MM-dd');
//       }

//       runningTotal++;
//       growthMap.set(key, runningTotal);
//     });

//     const growth: any[] = [];
//     growthMap.forEach((total, date) => {
//       growth.push({ date, totalUsers: total });
//     });

//     return growth;
//   }

//   async getUserRetention() {
//     // Calculate retention based on cohorts
//     const cohorts = await this.getUserCohorts();

//     const retentionData: UserRetentionDto[] = [];

//     for (const cohort of cohorts) {
//       const cohortUsers = await this.prisma.user.findMany({
//         where: {
//           createdAt: {
//             gte: cohort.start,
//             lte: cohort.end,
//           },
//         },
//         select: { id: true },
//       });

//       const userIds = cohortUsers.map(u => u.id);

//       const retention = {
//         cohort: format(cohort.start, 'yyyy-MM'),
//         total: userIds.length,
//         week1: await this.getRetentionRate(userIds, 7),
//         week2: await this.getRetentionRate(userIds, 14),
//         week4: await this.getRetentionRate(userIds, 28),
//         week8: await this.getRetentionRate(userIds, 56),
//         week12: await this.getRetentionRate(userIds, 84),
//       };

//       retentionData.push(retention);
//     }

//     return retentionData;
//   }

//   async getUserActivity(query: AnalyticsQueryDto) {
//     const dateRange = this.buildDateRange(query);
//     const { groupBy } = query;

//     // This would track sessions from analytics events
//     // For now, return placeholder data
//     return [];
//   }

//   async getUserRoleDistribution() {
//     const roles = await this.prisma.user.groupBy({
//       by: ['role'],
//       _count: true,
//     });

//     const total = roles.reduce((sum, r) => sum + r._count, 0);

//     return roles.map(role => ({
//       role: role.role,
//       count: role._count,
//       percentage: total > 0 ? (role._count / total) * 100 : 0,
//     }));
//   }

//   async getUserLocationDistribution() {
//     // This would come from user addresses or IP geolocation
//     // For now, return placeholder
//     return [];
//   }

//   // ============ PRODUCT ANALYTICS ============

//   async getProductOverview() {
//     const [totalProducts, published, outOfStock, lowStock, views, sales] = await Promise.all([
//       this.prisma.product.count(),
//       this.prisma.product.count({ where: { status: 'PUBLISHED', isPublished: true } }),
//       this.prisma.product.count({ where: { stock: 0 } }),
//       this.prisma.product.count({ where: { stock: { lt: 10 }, stock: { gt: 0 } } }),
//       this.prisma.productView.count(),
//       this.prisma.orderItem.aggregate({
//         _sum: { quantity: true },
//       }),
//     ]);

//     const averagePrice = await this.prisma.product.aggregate({
//       _avg: { price: true },
//     });

//     return {
//       totalProducts,
//       publishedProducts: published,
//       outOfStockProducts: outOfStock,
//       lowStockProducts: lowStock,
//       averagePrice: averagePrice._avg.price || 0,
//       totalViews: views,
//       totalSales: sales._sum.quantity || 0,
//     };
//   }

//   async getTopProducts(query: AnalyticsQueryDto, limit = 10) {
//     const dateRange = this.buildDateRange(query);

//     const products = await this.prisma.product.findMany({
//       where: {
//         orderItems: {
//           some: {
//             order: {
//               status: OrderStatus.DELIVERED,
//               paymentStatus: PaymentStatus.COMPLETED,
//               orderDate: dateRange,
//             },
//           },
//         },
//       },
//       select: {
//         id: true,
//         name: true,
//         price: true,
//         rating: true,
//         vendor: { select: { name: true } },
//         orderItems: {
//           where: {
//             order: {
//               status: OrderStatus.DELIVERED,
//               paymentStatus: PaymentStatus.COMPLETED,
//               orderDate: dateRange,
//             },
//           },
//           select: {
//             quantity: true,
//             total: true,
//           },
//         },
//         productViews: {
//           where: {
//             viewedAt: dateRange,
//           },
//           select: { id: true },
//         },
//       },
//       orderBy: {
//         orderItems: {
//           _sum: {
//             quantity: 'desc',
//           },
//         },
//       },
//       take: limit,
//     });

//     return products.map(product => ({
//       productId: product.id,
//       productName: product.name,
//       vendorName: product.vendor.name,
//       sales: product.orderItems.reduce((sum, item) => sum + item.quantity, 0),
//       revenue: product.orderItems.reduce((sum, item) => sum + item.total, 0),
//       views: product.productViews.length,
//       conversionRate: product.productViews.length > 0 
//         ? (product.orderItems.reduce((sum, item) => sum + item.quantity, 0) / product.productViews.length) * 100 
//         : 0,
//       rating: product.rating,
//     }));
//   }

//   async getProductPerformance(productId: string, query: AnalyticsQueryDto) {
//     const dateRange = this.buildDateRange(query);
//     const { groupBy } = query;

//     const [views, orders] = await Promise.all([
//       this.prisma.productView.findMany({
//         where: {
//           productId,
//           viewedAt: dateRange,
//         },
//         select: { viewedAt: true },
//       }),
//       this.prisma.orderItem.findMany({
//         where: {
//           productId,
//           order: {
//             status: OrderStatus.DELIVERED,
//             paymentStatus: PaymentStatus.COMPLETED,
//             orderDate: dateRange,
//           },
//         },
//         select: {
//           quantity: true,
//           total: true,
//           order: { select: { orderDate: true } },
//         },
//       }),
//     ]);

//     const performanceMap = new Map<string, { views: number; sales: number; revenue: number }>();

//     views.forEach(view => {
//       const key = this.formatDate(view.viewedAt, groupBy);
//       const existing = performanceMap.get(key) || { views: 0, sales: 0, revenue: 0 };
//       performanceMap.set(key, { ...existing, views: existing.views + 1 });
//     });

//     orders.forEach(order => {
//       const key = this.formatDate(order.order.orderDate, groupBy);
//       const existing = performanceMap.get(key) || { views: 0, sales: 0, revenue: 0 };
//       performanceMap.set(key, {
//         views: existing.views,
//         sales: existing.sales + order.quantity,
//         revenue: existing.revenue + order.total,
//       });
//     });

//     const performance: any[] = [];
//     performanceMap.forEach((value, date) => {
//       performance.push({
//         date,
//         views: value.views,
//         sales: value.sales,
//         revenue: value.revenue,
//       });
//     });

//     return performance.sort((a, b) => a.date.localeCompare(b.date));
//   }

//   async getLowStockProducts(threshold = 10) {
//     const products = await this.prisma.product.findMany({
//       where: {
//         stock: { lt: threshold },
//         status: 'PUBLISHED',
//       },
//       select: {
//         id: true,
//         name: true,
//         stock: true,
//         vendor: { select: { name: true } },
//         orderItems: {
//           take: 30,
//           orderBy: { order: { orderDate: 'desc' } },
//           select: { quantity: true, order: { select: { orderDate: true } } },
//         },
//       },
//       orderBy: { stock: 'asc' },
//     });

//     return products.map(product => {
//       const dailySales = this.calculateDailySales(product.orderItems);
//       const daysUntilOutOfStock = dailySales > 0 ? Math.floor(product.stock / dailySales) : null;

//       return {
//         productId: product.id,
//         productName: product.name,
//         stock: product.stock,
//         lowStock: product.stock < threshold,
//         outOfStock: product.stock === 0,
//         daysUntilOutOfStock: daysUntilOutOfStock && daysUntilOutOfStock < 0 ? null : daysUntilOutOfStock,
//       };
//     });
//   }

//   async getCategoryPerformance(query: AnalyticsQueryDto) {
//     return this.getSalesByCategory(query);
//   }

//   async getVendorPerformance(query: AnalyticsQueryDto) {
//     return this.getSalesByVendor(query);
//   }

//   // ============ EXPORT FUNCTIONS ============

//   async exportAnalytics(exportDto: ExportAnalyticsDto) {
//     const { type, startDate, endDate, format, vendorId } = exportDto;

//     let data: any[] = [];
//     const dateRange = startDate && endDate 
//       ? { gte: new Date(startDate), lte: new Date(endDate) }
//       : this.buildDateRange({ period: 'month' });

//     switch (type) {
//       case 'sales':
//         data = await this.getSalesExportData(dateRange, vendorId);
//         break;
//       case 'users':
//         data = await this.getUsersExportData(dateRange);
//         break;
//       case 'products':
//         data = await this.getProductsExportData(dateRange, vendorId);
//         break;
//       case 'vendors':
//         data = await this.getVendorsExportData(dateRange);
//         break;
//       case 'orders':
//         data = await this.getOrdersExportData(dateRange, vendorId);
//         break;
//     }

//     return {
//       data,
//       format,
//       filename: `${type}_analytics_${format(new Date(), 'yyyy-MM-dd')}`,
//     };
//   }

//   // ============ HELPER METHODS ============

//   private buildDateRange(query: AnalyticsQueryDto) {
//     const { period, startDate, endDate } = query;
//     const now = new Date();

//     if (startDate && endDate) {
//       return {
//         gte: startOfDay(new Date(startDate)),
//         lte: endOfDay(new Date(endDate)),
//       };
//     }

//     switch (period) {
//       case 'day':
//         return {
//           gte: startOfDay(now),
//           lte: endOfDay(now),
//         };
//       case 'week':
//         return {
//           gte: subWeeks(now, 1),
//           lte: now,
//         };
//       case 'month':
//         return {
//           gte: subMonths(now, 1),
//           lte: now,
//         };
//       case 'year':
//         return {
//           gte: subMonths(now, 12),
//           lte: now,
//         };
//       default:
//         return {
//           gte: subMonths(now, 1),
//           lte: now,
//         };
//     }
//   }

//   private getPreviousDateRange(dateRange: any) {
//     const duration = dateRange.gte && dateRange.lte 
//       ? dateRange.lte.getTime() - dateRange.gte.getTime()
//       : 30 * 24 * 60 * 60 * 1000;

//     return {
//       gte: new Date(dateRange.gte.getTime() - duration),
//       lte: new Date(dateRange.gte.getTime()),
//     };
//   }

//   private async getSalesStats(dateRange: any) {
//     const orders = await this.prisma.order.aggregate({
//       where: {
//         status: OrderStatus.DELIVERED,
//         paymentStatus: PaymentStatus.COMPLETED,
//         orderDate: dateRange,
//       },
//       _sum: { total: true },
//       _count: true,
//     });

//     return {
//       revenue: orders._sum.total || 0,
//       orders: orders._count,
//     };
//   }

//   private async getConversionRate(dateRange: any) {
//     const [visitors, orders] = await Promise.all([
//       this.prisma.productView.count({
//         where: { viewedAt: dateRange },
//       }),
//       this.prisma.order.count({
//         where: {
//           status: OrderStatus.DELIVERED,
//           paymentStatus: PaymentStatus.COMPLETED,
//           orderDate: dateRange,
//         },
//       }),
//     ]);

//     return visitors > 0 ? (orders / visitors) * 100 : 0;
//   }

//   private async getRetentionRate(userIds: string[], days: number) {
//     const cutoffDate = new Date();
//     cutoffDate.setDate(cutoffDate.getDate() - days);

//     const activeUsers = await this.prisma.user.count({
//       where: {
//         id: { in: userIds },
//         lastLogin: { gte: cutoffDate },
//       },
//     });

//     return userIds.length > 0 ? (activeUsers / userIds.length) * 100 : 0;
//   }

//   private async getUserCohorts() {
//     const users = await this.prisma.user.findMany({
//       select: { createdAt: true },
//       orderBy: { createdAt: 'asc' },
//     });

//     if (users.length === 0) return [];

//     const firstDate = users[0].createdAt;
//     const lastDate = new Date();
//     const cohorts = [];

//     let current = new Date(firstDate);
//     while (current <= lastDate) {
//       const start = new Date(current);
//       const end = new Date(current);
//       end.setMonth(end.getMonth() + 1);

//       cohorts.push({ start, end });
//       current.setMonth(current.getMonth() + 1);
//     }

//     return cohorts;
//   }

//   private formatDate(date: Date, groupBy?: string): string {
//     switch (groupBy) {
//       case 'hour':
//         return format(date, 'yyyy-MM-dd HH:00');
//       case 'week':
//         return format(date, 'yyyy-ww');
//       case 'month':
//         return format(date, 'yyyy-MM');
//       case 'quarter':
//         return `${date.getFullYear()}-Q${Math.floor(date.getMonth() / 3) + 1}`;
//       case 'year':
//         return format(date, 'yyyy');
//       default:
//         return format(date, 'yyyy-MM-dd');
//     }
//   }

//   private calculateDailySales(orderItems: any[]): number {
//     if (orderItems.length === 0) return 0;

//     const sorted = orderItems.sort((a, b) => 
//       b.order.orderDate.getTime() - a.order.orderDate.getTime()
//     );

//     const recentItems = sorted.slice(0, 30);
//     const totalQuantity = recentItems.reduce((sum, item) => sum + item.quantity, 0);
//     const daysSpan = 30;

//     return totalQuantity / daysSpan;
//   }

//   private async getSalesExportData(dateRange: any, vendorId?: string) {
//     return this.prisma.order.findMany({
//       where: {
//         status: OrderStatus.DELIVERED,
//         paymentStatus: PaymentStatus.COMPLETED,
//         orderDate: dateRange,
//         ...(vendorId && {
//           items: { some: { vendorId } },
//         }),
//       },
//       include: {
//         user: { select: { email: true } },
//         items: true,
//       },
//     });
//   }

//   private async getUsersExportData(dateRange: any) {
//     return this.prisma.user.findMany({
//       where: {
//         createdAt: dateRange,
//       },
//     });
//   }

//   private async getProductsExportData(dateRange: any, vendorId?: string) {
//     return this.prisma.product.findMany({
//       where: {
//         ...(vendorId && { vendorId }),
//       },
//       include: {
//         vendor: { select: { name: true } },
//         orderItems: {
//           where: {
//             order: {
//               orderDate: dateRange,
//             },
//           },
//         },
//       },
//     });
//   }

//   private async getVendorsExportData(dateRange: any) {
//     return this.prisma.vendor.findMany({
//       include: {
//         user: { select: { email: true } },
//         orderItems: {
//           where: {
//             order: {
//               orderDate: dateRange,
//             },
//           },
//         },
//       },
//     });
//   }

//   private async getOrdersExportData(dateRange: any, vendorId?: string) {
//     return this.prisma.order.findMany({
//       where: {
//         orderDate: dateRange,
//         ...(vendorId && {
//           items: { some: { vendorId } },
//         }),
//       },
//       include: {
//         user: { select: { email: true } },
//         items: true,
//       },
//     });
//   }
// }