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
import { ApplyVendorDto } from './dto/apply-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { AdminUpdateVendorDto } from './dto/admin-update-vendor.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../core/decorators/roles.decorator';
import { GetUser } from '../../core/decorators/get-user.decorator';
import { User, UserRole } from 'generated/prisma/client';
import { VendorResponseDto } from './dto/vendor-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { Serialize } from 'src/core/interceptors/serialize.interceptor';

@Controller('vendors')
@Serialize(VendorResponseDto)
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  // Public: Apply to become a vendor
  @Post('apply')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  apply(@GetUser() user: User, @Body() applyVendorDto: ApplyVendorDto) {
    return this.vendorsService.apply(user, applyVendorDto);
  }

  // Public: List vendors with filters
  @Get()
  findAll(@Query() query: any) {
    return this.vendorsService.findAll(query);
  }

  // Public: Get vendor by slug
  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.vendorsService.findOne(slug);
  }

  // Protected: Get my vendor profile
  @Get('me/profile')
  @UseGuards(JwtAuthGuard)
  getMyVendor(@GetUser() user: User) {
    return this.vendorsService.findMyVendor(user.id);
  }

  // Protected: Update my vendor profile
  @Patch('me/profile')
  @UseGuards(JwtAuthGuard)
  updateMyVendor(
    @GetUser() user: User,
    @Body() updateVendorDto: UpdateVendorDto,
  ) {
    return this.vendorsService.updateMyVendor(user.id, updateVendorDto);
  }

  // Protected: Follow a vendor
  @Post(':vendorId/follow')
  @UseGuards(JwtAuthGuard)
  follow(@Param('vendorId') vendorId: string, @GetUser() user: User) {
    return this.vendorsService.follow(vendorId, user.id);
  }

  // Protected: Unfollow a vendor
  @Delete(':vendorId/follow')
  @UseGuards(JwtAuthGuard)
  unfollow(@Param('vendorId') vendorId: string, @GetUser() user: User) {
    return this.vendorsService.unfollow(vendorId, user.id);
  }

  // Public: Get vendor followers
  @Get(':vendorId/followers')
  getFollowers(
    @Param('vendorId') vendorId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.vendorsService.getFollowers(vendorId, page, limit);
  }

  // Admin: Update vendor (verify, feature, etc.)
  @Patch('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  adminUpdate(
    @Param('id') id: string,
    @Body() adminUpdateDto: AdminUpdateVendorDto,
  ) {
    return this.vendorsService.adminUpdate(id, adminUpdateDto);
  }

  // Admin: Delete vendor
  @Delete('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  deleteVendor(@Param('id') id: string) {
    return this.vendorsService.deleteVendor(id);
  }
}
