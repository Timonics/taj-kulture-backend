// import {
//   Controller,
//   Get,
//   Post,
//   Body,
//   Param,
//   Query,
//   UseGuards,
//   ParseUUIDPipe,
//   ParseIntPipe,
//   DefaultValuePipe,
//   Res,
// } from '@nestjs/common';
// import { AnalyticsService } from './analytics.service';
// import { AnalyticsQueryDto, ExportAnalyticsDto } from './dto';
// import { RolesGuard } from '../auth/guards/roles.guard';
// import { Roles } from '../../core/decorators/roles.decorator';
// import { UserRole } from 'generated/prisma/client';
// import { Response } from 'express';

// @Controller('analytics')
// @UseGuards(RolesGuard)
// @Roles(UserRole.ADMIN)
// export class AnalyticsController {
//   constructor(private readonly analyticsService: AnalyticsService) {}

//   // ============ SALES ANALYTICS ============

//   @Get('sales/overview')
//   async getSalesOverview(@Query() query: AnalyticsQueryDto) {
//     const data = await this.analyticsService.getSalesOverview(query);
//     return { success: true, data };
//   }

//   @Get('sales/trend')
//   async getSalesTrend(@Query() query: AnalyticsQueryDto) {
//     const data = await this.analyticsService.getSalesTrend(query);
//     return { success: true, data };
//   }

//   @Get('sales/by-vendor')
//   async getSalesByVendor(@Query() query: AnalyticsQueryDto) {
//     const data = await this.analyticsService.getSalesByVendor(query);
//     return { success: true, data };
//   }

//   @Get('sales/by-category')
//   async getSalesByCategory(@Query() query: AnalyticsQueryDto) {
//     const data = await this.analyticsService.getSalesByCategory(query);
//     return { success: true, data };
//   }

//   @Get('sales/hourly')
//   async getHourlySales(@Query() query: AnalyticsQueryDto) {
//     const data = await this.analyticsService.getHourlySales(query);
//     return { success: true, data };
//   }

//   @Get('sales/payment-methods')
//   async getPaymentMethodBreakdown(@Query() query: AnalyticsQueryDto) {
//     const data = await this.analyticsService.getPaymentMethodBreakdown(query);
//     return { success: true, data };
//   }

//   @Get('sales/order-status')
//   async getOrderStatusBreakdown(@Query() query: AnalyticsQueryDto) {
//     const data = await this.analyticsService.getOrderStatusBreakdown(query);
//     return { success: true, data };
//   }

//   // ============ USER ANALYTICS ============

//   @Get('users/overview')
//   async getUserOverview(@Query() query: AnalyticsQueryDto) {
//     const data = await this.analyticsService.getUserOverview(query);
//     return { success: true, data };
//   }

//   @Get('users/growth')
//   async getUserGrowth(@Query() query: AnalyticsQueryDto) {
//     const data = await this.analyticsService.getUserGrowth(query);
//     return { success: true, data };
//   }

//   @Get('users/retention')
//   async getUserRetention() {
//     const data = await this.analyticsService.getUserRetention();
//     return { success: true, data };
//   }

//   @Get('users/activity')
//   async getUserActivity(@Query() query: AnalyticsQueryDto) {
//     const data = await this.analyticsService.getUserActivity(query);
//     return { success: true, data };
//   }

//   @Get('users/roles')
//   async getUserRoleDistribution() {
//     const data = await this.analyticsService.getUserRoleDistribution();
//     return { success: true, data };
//   }

//   @Get('users/locations')
//   async getUserLocationDistribution() {
//     const data = await this.analyticsService.getUserLocationDistribution();
//     return { success: true, data };
//   }

//   // ============ PRODUCT ANALYTICS ============

//   @Get('products/overview')
//   async getProductOverview() {
//     const data = await this.analyticsService.getProductOverview();
//     return { success: true, data };
//   }

//   @Get('products/top')
//   async getTopProducts(
//     @Query() query: AnalyticsQueryDto,
//     @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
//   ) {
//     const data = await this.analyticsService.getTopProducts(query, limit);
//     return { success: true, data };
//   }

//   @Get('products/low-stock')
//   async getLowStockProducts(
//     @Query('threshold', new DefaultValuePipe(10), ParseIntPipe)
//     threshold: number,
//   ) {
//     const data = await this.analyticsService.getLowStockProducts(threshold);
//     return { success: true, data };
//   }

//   @Get('products/:productId/performance')
//   async getProductPerformance(
//     @Param('productId', ParseUUIDPipe) productId: string,
//     @Query() query: AnalyticsQueryDto,
//   ) {
//     const data = await this.analyticsService.getProductPerformance(
//       productId,
//       query,
//     );
//     return { success: true, data };
//   }

//   @Get('categories/performance')
//   async getCategoryPerformance(@Query() query: AnalyticsQueryDto) {
//     const data = await this.analyticsService.getCategoryPerformance(query);
//     return { success: true, data };
//   }

//   @Get('vendors/performance')
//   async getVendorPerformance(@Query() query: AnalyticsQueryDto) {
//     const data = await this.analyticsService.getVendorPerformance(query);
//     return { success: true, data };
//   }

//   // ============ EXPORT ============

//   @Post('export')
//   async exportAnalytics(
//     @Body() exportDto: ExportAnalyticsDto,
//     @Res() res: Response,
//   ) {
//     const result = await this.analyticsService.exportAnalytics(exportDto);

//     if (result.format === 'csv') {
//       const csv = this.convertToCSV(result.data);
//       res.setHeader('Content-Type', 'text/csv');
//       res.setHeader(
//         'Content-Disposition',
//         `attachment; filename=${result.filename}.csv`,
//       );
//       return res.send(csv);
//     }

//     return res.json(result);
//   }

//   private convertToCSV(data: any[]): string {
//     if (!data || data.length === 0) return '';

//     const headers = Object.keys(data[0]);
//     const rows = data.map((obj) =>
//       headers.map((header) => JSON.stringify(obj[header] || '')).join(','),
//     );
//     return [headers.join(','), ...rows].join('\n');
//   }
// }
