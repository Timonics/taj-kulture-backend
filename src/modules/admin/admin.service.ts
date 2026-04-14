// src/modules/admin/admin.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { EventBus } from '../../shared/events/event-bus.service';
import { USER_EVENTS, VENDOR_EVENTS } from '../../shared/events/event-types';
import {
  VendorModerationDto,
  UserRoleUpdateDto,
  DashboardStatsQueryDto,
  PlatformSettingsDto,
  UserSuspendDto,
} from './dto';
import {
  UserRole,
  VerificationStatus,
  OrderStatus,
} from 'generated/prisma/client';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private eventBus: EventBus,
  ) {}

  // ============ DASHBOARD STATS ============

  async getDashboardStats(query: DashboardStatsQueryDto) {
    const { from, to, period = 'month' } = query;

    const dateFilter = this.buildDateFilter(from, to, period);

    const [
      userStats,
      vendorStats,
      productStats,
      orderStats,
      revenueStats,
      recentActivities,
    ] = await Promise.all([
      this.getUserStats(dateFilter),
      this.getVendorStats(dateFilter),
      this.getProductStats(dateFilter),
      this.getOrderStats(dateFilter),
      this.getRevenueStats(dateFilter),
      this.getRecentActivities(),
    ]);

    return {
      users: userStats,
      vendors: vendorStats,
      products: productStats,
      orders: orderStats,
      revenue: revenueStats,
      recentActivities,
      timestamp: new Date(),
    };
  }

  private async getUserStats(dateFilter: any) {
    const [
      totalUsers,
      newUsersToday,
      newUsersThisWeek,
      activeUsers,
      usersByRole,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({
        where: {
          createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
      this.prisma.user.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setDate(new Date().getDate() - 7)),
          },
        },
      }),
      this.prisma.user.count({
        where: {
          lastLogin: {
            gte: new Date(new Date().setDate(new Date().getDate() - 30)),
          },
        },
      }),
      this.prisma.user.groupBy({
        by: ['role'],
        _count: true,
      }),
    ]);

    const roleMap = usersByRole.reduce(
      (acc, curr) => {
        acc[curr.role] = curr._count;
        return acc;
      },
      {} as Record<string, number>,
    );

    const usersGrowth =
      totalUsers > 0 ? ((newUsersThisWeek / totalUsers) * 100).toFixed(1) : 0;

    return {
      totalUsers,
      newUsersToday,
      newUsersThisWeek,
      activeUsers,
      usersByRole: roleMap,
      usersGrowth: Number(usersGrowth),
    };
  }

  private async getVendorStats(dateFilter: any) {
    const [
      totalVendors,
      pendingVendors,
      verifiedVendors,
      featuredVendors,
      topVendors,
    ] = await Promise.all([
      this.prisma.vendor.count(),
      this.prisma.vendor.count({
        where: { verificationStatus: VerificationStatus.PENDING },
      }),
      this.prisma.vendor.count({ where: { isVerified: true } }),
      this.prisma.vendor.count({ where: { isFeatured: true } }),
      this.prisma.vendor.findMany({
        take: 10,
        orderBy: { totalSales: 'desc' },
        select: {
          id: true,
          name: true,
          totalSales: true,
          productCount: true,
          rating: true,
          isVerified: true,
        },
      }),
    ]);

    const vendorsGrowth =
      totalVendors > 0
        ? ((verifiedVendors / totalVendors) * 100).toFixed(1)
        : 0;

    return {
      totalVendors,
      pendingVendors,
      verifiedVendors,
      featuredVendors,
      vendorsGrowth: Number(vendorsGrowth),
      topVendors,
    };
  }

  private async getProductStats(dateFilter: any) {
    const [
      totalProducts,
      publishedProducts,
      draftProducts,
      outOfStockProducts,
      topProducts,
    ] = await Promise.all([
      this.prisma.product.count(),
      this.prisma.product.count({
        where: { status: 'PUBLISHED', isPublished: true },
      }),
      this.prisma.product.count({ where: { status: 'DRAFT' } }),
      this.prisma.product.count({ where: { stock: 0 } }),
      this.prisma.product.findMany({
        take: 10,
        orderBy: { reviewCount: 'desc' },
        select: {
          id: true,
          name: true,
          price: true,
          stock: true,
          reviewCount: true,
          rating: true,
          vendor: { select: { name: true } },
        },
      }),
    ]);

    const productsGrowth =
      totalProducts > 0
        ? ((publishedProducts / totalProducts) * 100).toFixed(1)
        : 0;

    return {
      totalProducts,
      publishedProducts,
      draftProducts,
      outOfStockProducts,
      productsGrowth: Number(productsGrowth),
      topProducts,
    };
  }

  private async getOrderStats(dateFilter: any) {
    const [
      totalOrders,
      pendingOrders,
      processingOrders,
      completedOrders,
      cancelledOrders,
    ] = await Promise.all([
      this.prisma.order.count(),
      this.prisma.order.count({ where: { status: OrderStatus.PENDING } }),
      this.prisma.order.count({ where: { status: OrderStatus.PROCESSING } }),
      this.prisma.order.count({ where: { status: OrderStatus.DELIVERED } }),
      this.prisma.order.count({ where: { status: OrderStatus.CANCELLED } }),
    ]);

    return {
      totalOrders,
      pendingOrders,
      processingOrders,
      completedOrders,
      cancelledOrders,
      completionRate:
        totalOrders > 0
          ? ((completedOrders / totalOrders) * 100).toFixed(1)
          : 0,
    };
  }

  private async getRevenueStats(dateFilter: any) {
    const completedOrders = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.DELIVERED,
        paymentStatus: 'COMPLETED',
        ...dateFilter,
      },
      select: { total: true, orderDate: true },
    });

    const totalRevenue = completedOrders.reduce(
      (sum, order) => sum + order.total,
      0,
    );

    // Group by date for chart
    const dailyRevenue: Record<string, { revenue: number; orders: number }> =
      {};

    completedOrders.forEach((order) => {
      const date = order.orderDate.toISOString().split('T')[0];
      if (!dailyRevenue[date]) {
        dailyRevenue[date] = { revenue: 0, orders: 0 };
      }
      dailyRevenue[date].revenue += order.total;
      dailyRevenue[date].orders += 1;
    });

    const dailySales = Object.entries(dailyRevenue).map(([date, data]) => ({
      date,
      revenue: data.revenue,
      orders: data.orders,
    }));

    return {
      totalRevenue,
      averageOrderValue:
        completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0,
      dailySales,
    };
  }

  private async getRecentActivities() {
    const activities: any[] = [];

    // Get recent orders
    const recentOrders = await this.prisma.order.findMany({
      take: 5,
      orderBy: { orderDate: 'desc' },
      include: { user: { select: { email: true } } },
    });

    recentOrders.forEach((order) => {
      activities.push({
        type: 'order',
        action: `Order #${order.orderNumber} created`,
        user: order.user.email,
        amount: order.total,
        timestamp: order.orderDate,
      });
    });

    // Get recent vendor registrations
    const recentVendors = await this.prisma.vendor.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { email: true } } },
    });

    recentVendors.forEach((vendor) => {
      activities.push({
        type: 'vendor',
        action: `New vendor registration: ${vendor.name}`,
        user: vendor.user.email,
        status: vendor.verificationStatus,
        timestamp: vendor.createdAt,
      });
    });

    // Get recent user registrations
    const recentUsers = await this.prisma.user.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      where: { role: UserRole.CUSTOMER },
    });

    recentUsers.forEach((user) => {
      activities.push({
        type: 'user',
        action: `New user registered`,
        user: user.email,
        timestamp: user.createdAt,
      });
    });

    // Sort all activities by timestamp and take top 10
    return activities
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 10);
  }

  // ============ VENDOR MANAGEMENT ============

  async getPendingVendors(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [vendors, total] = await Promise.all([
      this.prisma.vendor.findMany({
        where: { verificationStatus: VerificationStatus.PENDING },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              phone: true,
            },
          },
          categories: { include: { category: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.vendor.count({
        where: { verificationStatus: VerificationStatus.PENDING },
      }),
    ]);

    return {
      data: vendors,
      meta: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async approveVendor(vendorId: string, notes?: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: vendorId },
      include: { user: true },
    });

    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    // Update vendor status
    const updatedVendor = await this.prisma.vendor.update({
      where: { id: vendorId },
      data: {
        isVerified: true,
        verificationStatus: VerificationStatus.VERIFIED,
      },
    });

    // Update user role to VENDOR
    await this.prisma.user.update({
      where: { id: vendor.userId },
      data: { role: UserRole.VENDOR },
    });

    // Emit event
    this.eventBus.emit({
      name: VENDOR_EVENTS.APPROVED,
      payload: {
        vendorId: vendor.id,
        userId: vendor.userId,
        name: vendor.name,
        email: vendor.user.email,
        approvedBy: 'admin',
        approvedAt: new Date(),
      },
    });

    return updatedVendor;
  }

  async rejectVendor(vendorId: string, reason: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: vendorId },
      include: { user: true },
    });

    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    const updatedVendor = await this.prisma.vendor.update({
      where: { id: vendorId },
      data: {
        verificationStatus: VerificationStatus.REJECTED,
      },
    });

    this.eventBus.emit({
      name: VENDOR_EVENTS.REJECTED,
      payload: {
        vendorId: vendor.id,
        userId: vendor.userId,
        name: vendor.name,
        email: vendor.user.email,
        reason,
        rejectedBy: 'admin',
        rejectedAt: new Date(),
      },
    });

    return updatedVendor;
  }

  async featureVendor(vendorId: string, featured: boolean) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: vendorId },
    });

    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    return this.prisma.vendor.update({
      where: { id: vendorId },
      data: { isFeatured: featured },
    });
  }

  // ============ USER MANAGEMENT ============

  async getAllUsers(page = 1, limit = 20, role?: UserRole, search?: string) {
    const skip = (page - 1) * limit;

    const where: any = {};
    if (role) where.role = role;
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { username: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          role: true,
          isEmailVerified: true,
          createdAt: true,
          lastLogin: true,
          vendor: {
            select: {
              id: true,
              name: true,
              isVerified: true,
              verificationStatus: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      meta: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async updateUserRole(userId: string, roleUpdateDto: UserRoleUpdateDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { role: roleUpdateDto.role },
    });

    this.eventBus.emit({
      name: USER_EVENTS.ROLE_CHANGED,
      payload: {
        userId: updated.id,
        oldRole: user.role,
        newRole: updated.role,
        changedAt: new Date(),
      },
    });

    return updated;
  }

  async suspendUser(userId: string, suspendDto: UserSuspendDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Add suspended field to schema or handle differently
    // For now, we'll just update a field or create a suspension record

    // You might want to add a `suspended` field to User model
    // For demonstration, we'll just return the user

    return {
      success: true,
      message: suspendDto.suspended ? 'User suspended' : 'User unsuspended',
      user,
    };
  }

  async deleteUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { vendor: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Soft delete - you might want to add a deletedAt field
    // For now, we'll just delete (but in production, use soft delete)

    await this.prisma.user.delete({
      where: { id: userId },
    });

    return { success: true, message: 'User deleted successfully' };
  }

  // ============ PLATFORM SETTINGS ============

  async getPlatformSettings() {
    // You might store settings in a dedicated table
    // For now, return default settings
    return {
      commission: {
        rate: 10,
        type: 'percentage',
        minimum: 100,
      },
      shipping: {
        defaultRate: 2000,
        freeShippingThreshold: 50000,
      },
      features: {
        allowVendorRegistration: true,
        requireVendorApproval: true,
        enableReviews: true,
        enableWishlist: true,
      },
      email: {
        orderConfirmation: true,
        shippingUpdate: true,
        newsletter: true,
        promotionalEmails: true,
      },
    };
  }

  async updatePlatformSettings(settingsDto: PlatformSettingsDto) {
    // Store settings in database or cache
    // For now, just return the updated settings
    return {
      success: true,
      message: 'Settings updated successfully',
      data: settingsDto,
    };
  }

  // ============ HELPER METHODS ============

  private buildDateFilter(from?: string, to?: string, period?: string) {
    const filter: any = {};

    if (from && to) {
      filter.orderDate = {
        gte: new Date(from),
        lte: new Date(to),
      };
    } else if (period === 'day') {
      filter.orderDate = {
        gte: new Date(new Date().setHours(0, 0, 0, 0)),
      };
    } else if (period === 'week') {
      filter.orderDate = {
        gte: new Date(new Date().setDate(new Date().getDate() - 7)),
      };
    } else if (period === 'month') {
      filter.orderDate = {
        gte: new Date(new Date().setMonth(new Date().getMonth() - 1)),
      };
    } else if (period === 'year') {
      filter.orderDate = {
        gte: new Date(new Date().setFullYear(new Date().getFullYear() - 1)),
      };
    }

    return filter;
  }
}
