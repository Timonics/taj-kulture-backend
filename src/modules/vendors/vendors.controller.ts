// src/modules/vendors/vendors.controller.ts
/**
 * VENDORS CONTROLLER
 *
 * Handles HTTP requests for vendor management.
 *
 * PUBLIC ROUTES:
 * - GET /vendors – List vendors (filtered, paginated)
 * - GET /vendors/:slug – Get vendor profile by slug
 * - GET /vendors/:vendorId/followers – Get followers list
 *
 * PROTECTED ROUTES (authenticated):
 * - POST /vendors/apply – Apply to become a vendor
 * - GET /vendors/me/profile – Get my vendor profile
 * - PATCH /vendors/me/profile – Update my vendor profile
 * - POST /vendors/:vendorId/follow – Follow a vendor
 * - DELETE /vendors/:vendorId/follow – Unfollow a vendor
 * - GET /vendors/me/followers – My followers (same as public but filtered)
 * - GET /vendors/me/following – Vendors I follow
 *
 * ADMIN ROUTES:
 * - PATCH /vendors/admin/:id – Update vendor (verify, feature)
 * - DELETE /vendors/admin/:id – Delete vendor
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { VendorsService } from './vendors.service';
import {
  ApplyVendorRequestDto,
  UpdateVendorRequestDto,
  AdminUpdateVendorRequestDto,
  VendorQueryRequestDto,
} from './dto/requests';
import { VendorResponseDto } from './dto/responses/vendor.response.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../core/decorators/roles.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { Public } from '../../core/decorators/public.decorator';
import { ParseIdPipe } from '../../core/pipes/parse-id.pipe';
import { Serialize } from '../../core/decorators/serialize.decorator';
import { User, UserRole } from '../../../generated/prisma/client';

@Controller('vendors')
@Serialize(VendorResponseDto)
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  // ========== PUBLIC ROUTES ==========

  @Public()
  @Get()
  findAll(@Query() query: VendorQueryRequestDto) {
    return this.vendorsService.findAll(query);
  }

  @Public()
  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.vendorsService.findOne(slug);
  }

  @Public()
  @Get(':vendorId/followers')
  getFollowers(
    @Param('vendorId', ParseIdPipe) vendorId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.vendorsService.getFollowers(vendorId, page, limit);
  }

  // ========== PROTECTED ROUTES (Vendor Owner) ==========

  @Post('apply')
  @HttpCode(HttpStatus.CREATED)
  apply(@CurrentUser() user: User, @Body() dto: ApplyVendorRequestDto) {
    return this.vendorsService.apply(user, dto);
  }

  @Get('me/profile')
  getMyVendor(@CurrentUser() user: User) {
    return this.vendorsService.findMyVendor(user.id);
  }

  @Patch('me/profile')
  updateMyVendor(@CurrentUser() user: User, @Body() dto: UpdateVendorRequestDto) {
    return this.vendorsService.updateMyVendor(user.id, dto);
  }

  @Post(':vendorId/follow')
  follow(@Param('vendorId', ParseIdPipe) vendorId: string, @CurrentUser() user: User) {
    return this.vendorsService.follow(vendorId, user.id);
  }

  @Delete(':vendorId/follow')
  unfollow(@Param('vendorId', ParseIdPipe) vendorId: string, @CurrentUser() user: User) {
    return this.vendorsService.unfollow(vendorId, user.id);
  }

  // ========== ADMIN ROUTES ==========

  @Patch('admin/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  adminUpdate(
    @Param('id', ParseIdPipe) id: string,
    @Body() dto: AdminUpdateVendorRequestDto,
  ) {
    return this.vendorsService.adminUpdate(id, dto);
  }

  @Delete('admin/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  deleteVendor(@Param('id', ParseIdPipe) id: string) {
    return this.vendorsService.deleteVendor(id);
  }
}