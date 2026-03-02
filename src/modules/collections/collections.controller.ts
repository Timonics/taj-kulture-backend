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
import { CollectionsService } from './collections.service';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../core/decorators/roles.decorator';
import { GetUser } from '../../core/decorators/get-user.decorator';
import { User, UserRole } from 'generated/prisma/client';
import { CollectionResponseDto } from './dto/collection-response.dto';
import { Serialize } from 'src/core/interceptors/serialize.interceptor';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';

@Controller('collections')
@Serialize(CollectionResponseDto)
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  // ============ PUBLIC ENDPOINTS ============

  @Get()
  async findAll(@Query() query: any) {
    return this.collectionsService.findAll(query);
  }

  @Get(':slug')
  async findOne(@Param('slug') slug: string) {
    return this.collectionsService.findOne(slug);
  }

  // ============ PROTECTED ENDPOINTS (Vendors & Admins) ============

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @GetUser() user: User,
    @Body() createCollectionDto: CreateCollectionDto,
  ) {
    return this.collectionsService.create(user, createCollectionDto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @GetUser() user: User,
    @Param('id') id: string,
    @Body() updateCollectionDto: UpdateCollectionDto,
  ) {
    return this.collectionsService.update(user, id, updateCollectionDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(@GetUser() user: User, @Param('id') id: string) {
    return this.collectionsService.remove(user, id);
  }

  // ============ VENDOR-SPECIFIC ENDPOINTS ============

  @Get('vendor/my-collections')
  @UseGuards(JwtAuthGuard)
  async getMyCollections(@GetUser() user: User, @Query() query: any) {
    const vendorId = await this.collectionsService.getVendorIdFromUser(user);
    return this.collectionsService.findAll({
      ...query,
      vendorId,
      includeUnpublished: true,
    });
  }

  // ============ ADMIN-ONLY ENDPOINTS ============

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async adminFindAll(@Query() query: any) {
    return this.collectionsService.findAll({
      ...query,
      includeUnpublished: true,
    });
  }

  @Patch(':id/feature')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async toggleFeature(
    @Param('id') id: string,
    @Body('isFeatured') isFeatured: boolean,
  ) {
    return this.collectionsService.adminUpdate(id, { isFeatured });
  }

  @Patch(':id/publish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async togglePublish(
    @Param('id') id: string,
    @Body('isPublished') isPublished: boolean,
  ) {
    return this.collectionsService.adminUpdate(id, { isPublished });
  }
}
