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
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from 'generated/prisma/client';
import { IUserFilters } from './interfaces/user.interface';
import { CurrentUser } from 'src/core/decorators/current-user.decorator';
import { Roles } from 'src/core/decorators/roles.decorator';
import { Public } from 'src/core/decorators/public.decorator';
import { ParseIdPipe } from 'src/core/pipes/parse-id.pipe';
import {CreateAddressRequestDto, FollowRequestDto, UpdateAddressRequestDto, UpdatePasswordRequestDto, UpdateUserRequestDto} from "./dto/requests"

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ========== PUBLIC PROFILES ==========

  @Public()
  @Get('profile/:username')
  async getPublicProfile(@Param('username') username: string) {
    return this.usersService.findByUsername(username);
  }

  @Public()
  @Get(':userId/followers')
  async getFollowers(
    @Param('userId', ParseIdPipe) userId: string,
    @Query('skip', new DefaultValuePipe(0), ParseIntPipe) skip: number,
    @Query('take', new DefaultValuePipe(10), ParseIntPipe) take: number,
  ) {
    return this.usersService.getFollowers(userId, skip, take);
  }

  @Public()
  @Get(':userId/following')
  async getFollowing(
    @Param('userId', ParseIdPipe) userId: string,
    @Query('skip', new DefaultValuePipe(0), ParseIntPipe) skip: number,
    @Query('take', new DefaultValuePipe(10), ParseIntPipe) take: number,
  ) {
    return this.usersService.getFollowing(userId, skip, take);
  }

  // ========== PROTECTED ROUTES (AUTHENTICATED USER) ==========

  @Get('me')
  async getCurrentUser(@CurrentUser('id') userId: string) {
    return this.usersService.findOne(userId);
  }

  @Patch('me')
  async updateCurrentUser(
    @CurrentUser('id') userId: string,
    @Body() updateUserDto: UpdateUserRequestDto,
  ) {
    return this.usersService.update(userId, updateUserDto);
  }

  @Post('me/change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser('id') userId: string,
    @Body() updatePasswordDto: UpdatePasswordRequestDto,
  ) {
    return this.usersService.updatePassword(userId, updatePasswordDto);
  }

  @Get('me/addresses')
  async getMyAddresses(@CurrentUser('id') userId: string) {
    return this.usersService.getAddresses(userId);
  }

  @Post('me/addresses')
  async addAddress(
    @CurrentUser('id') userId: string,
    @Body() createAddressDto: CreateAddressRequestDto,
  ) {
    return this.usersService.addAddress(userId, createAddressDto);
  }

  @Patch('me/addresses/:addressId')
  async updateAddress(
    @CurrentUser('id') userId: string,
    @Param('addressId', ParseIdPipe) addressId: string,
    @Body() updateAddressDto: UpdateAddressRequestDto,
  ) {
    return this.usersService.updateAddress(userId, addressId, updateAddressDto);
  }

  @Delete('me/addresses/:addressId')
  async removeAddress(
    @CurrentUser('id') userId: string,
    @Param('addressId', ParseIdPipe) addressId: string,
  ) {
    return this.usersService.removeAddress(userId, addressId);
  }

  @Post('me/addresses/:addressId/default')
  @HttpCode(HttpStatus.OK)
  async setDefaultAddress(
    @CurrentUser('id') userId: string,
    @Param('addressId', ParseIdPipe) addressId: string,
  ) {
    return this.usersService.setDefaultAddress(userId, addressId);
  }

  @Post('me/follow')
  async followUser(
    @CurrentUser('id') followerId: string,
    @Body() followDto: FollowRequestDto,
  ) {
    return this.usersService.followUser(followerId, followDto);
  }

  @Delete('me/follow/:userId')
  async unfollowUser(
    @CurrentUser('id') followerId: string,
    @Param('userId', ParseIdPipe) followingId: string,
  ) {
    return this.usersService.unfollowUser(followerId, followingId);
  }

  @Get('me/followers')
  async getMyFollowers(
    @CurrentUser('id') userId: string,
    @Query('skip', new DefaultValuePipe(0), ParseIntPipe) skip: number,
    @Query('take', new DefaultValuePipe(10), ParseIntPipe) take: number,
  ) {
    return this.usersService.getFollowers(userId, skip, take);
  }

  @Get('me/following')
  async getMyFollowing(
    @CurrentUser('id') userId: string,
    @Query('skip', new DefaultValuePipe(0), ParseIntPipe) skip: number,
    @Query('take', new DefaultValuePipe(10), ParseIntPipe) take: number,
  ) {
    return await this.usersService.getFollowing(userId, skip, take);
  }

  @Get('me/stats')
  async getMyStats(@CurrentUser('id') userId: string) {
    return await this.usersService.getUserStats(userId);
  }

  @Get('me/activity')
  async getMyActivity(
    @CurrentUser('id') userId: string,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return await this.usersService.getUserActivity(userId, limit);
  }

  @Get('me/following/check/:userId')
  async checkFollowing(
    @CurrentUser('id') followerId: string,
    @Param('userId', ParseIdPipe) followingId: string,
  ) {
    return await this.usersService.isFollowing(followerId, followingId);
  }

  // ========== ADMIN ROUTES ==========

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async findAll(
    @Query('skip', new DefaultValuePipe(0), ParseIntPipe) skip: number,
    @Query('take', new DefaultValuePipe(10), ParseIntPipe) take: number,
    @Query('role') role?: UserRole,
    @Query('search') search?: string,
    @Query('verified') verified?: string,
  ) {
    const filters: IUserFilters = {};

    if (role) filters.role = role;
    if (search) filters.search = search;
    if (verified !== undefined) filters.isVerified = verified === 'true';

    return this.usersService.findAll({
      skip,
      take,
      where: filters,
    });
  }

  @Get('stats/dashboard')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async getDashboardStats() {
    return await this.usersService.getDashboardStats();
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async findOne(@Param('id', ParseIdPipe) id: string) {
    return await this.usersService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async updateUser(
    @Param('id', ParseIdPipe) id: string,
    @Body() updateUserDto: UpdateUserRequestDto,
  ) {
    return await this.usersService.update(id, updateUserDto);
  }

  @Patch(':id/role')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async updateRole(
    @Param('id', ParseIdPipe) id: string,
    @Body('role') role: UserRole,
  ) {
    return await this.usersService.updateRole(id, role);
  }

  @Post(':id/verify-email')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Param('id', ParseIdPipe) id: string) {
    return await this.usersService.verifyEmail(id);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseIdPipe) id: string) {
    return await this.usersService.remove(id);
  }
}
