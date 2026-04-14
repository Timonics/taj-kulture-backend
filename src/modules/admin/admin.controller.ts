import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  ParseIntPipe,
  DefaultValuePipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import {
  VendorModerationDto,
  UserRoleUpdateDto,
  DashboardStatsQueryDto,
  PlatformSettingsDto,
} from './dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../core/decorators/roles.decorator';
import { UserRole } from 'generated/prisma/client';

@Controller('admin')
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ============ DASHBOARD ============

  @Get('dashboard/stats')
  async getDashboardStats(@Query() query: DashboardStatsQueryDto) {
    const stats = await this.adminService.getDashboardStats(query);
    return {
      success: true,
      data: stats,
    };
  }

  // ============ VENDOR MANAGEMENT ============

  @Get('vendors/pending')
  async getPendingVendors(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    const result = await this.adminService.getPendingVendors(page, limit);
    return {
      success: true,
      data: result.data,
      meta: result.meta,
    };
  }

  @Post('vendors/:id/approve')
  @HttpCode(HttpStatus.OK)
  async approveVendor(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('notes') notes?: string,
  ) {
    const vendor = await this.adminService.approveVendor(id, notes);
    return {
      success: true,
      message: 'Vendor approved successfully',
      data: vendor,
    };
  }

  @Post('vendors/:id/reject')
  @HttpCode(HttpStatus.OK)
  async rejectVendor(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason: string,
  ) {
    const vendor = await this.adminService.rejectVendor(id, reason);
    return {
      success: true,
      message: 'Vendor rejected',
      data: vendor,
    };
  }

  @Patch('vendors/:id/feature')
  @HttpCode(HttpStatus.OK)
  async featureVendor(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('featured') featured: boolean,
  ) {
    const vendor = await this.adminService.featureVendor(id, featured);
    return {
      success: true,
      message: featured ? 'Vendor featured' : 'Vendor unfeatured',
      data: vendor,
    };
  }

  // ============ USER MANAGEMENT ============

  @Get('users')
  async getAllUsers(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('role') role?: UserRole,
    @Query('search') search?: string,
  ) {
    const result = await this.adminService.getAllUsers(
      page,
      limit,
      role,
      search,
    );
    return {
      success: true,
      data: result.data,
      meta: result.meta,
    };
  }

  @Patch('users/:id/role')
  @HttpCode(HttpStatus.OK)
  async updateUserRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() roleUpdateDto: UserRoleUpdateDto,
  ) {
    const user = await this.adminService.updateUserRole(id, roleUpdateDto);
    return {
      success: true,
      message: 'User role updated',
      data: user,
    };
  }

  @Post('users/:id/suspend')
  @HttpCode(HttpStatus.OK)
  async suspendUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() suspendDto: any,
  ) {
    const result = await this.adminService.suspendUser(id, suspendDto);
    return {
      success: true,
      message: result.message,
    };
  }

  @Delete('users/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteUser(@Param('id', ParseUUIDPipe) id: string) {
    await this.adminService.deleteUser(id);
    return {
      success: true,
      message: 'User deleted successfully',
    };
  }

  // ============ PLATFORM SETTINGS ============

  @Get('settings')
  async getPlatformSettings() {
    const settings = await this.adminService.getPlatformSettings();
    return {
      success: true,
      data: settings,
    };
  }

  @Patch('settings')
  @HttpCode(HttpStatus.OK)
  async updatePlatformSettings(@Body() settingsDto: PlatformSettingsDto) {
    const result = await this.adminService.updatePlatformSettings(settingsDto);
    return {
      success: true,
      message: 'Settings updated successfully',
      data: result,
    };
  }
}
