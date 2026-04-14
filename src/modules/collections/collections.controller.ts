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
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { User, UserRole } from 'generated/prisma/client';
import { Public } from 'src/core/decorators/public.decorator';
// import { Serialize } from 'src/core/interceptors/serialize.interceptor';
import {
  CollectionResponseDto,
  CollectionsResponseDto,
} from './dto/collection-response.dto';

@Controller('collections')
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  // ============ PUBLIC ENDPOINTS ============

  @Public()
  @Get()
  // @Serialize(CollectionsResponseDto)
  async findAll(@Query() query: any) {
    return this.collectionsService.findAll(query);
  }

  @Public()
  @Get(':slug')
  // @Serialize(CollectionResponseDto)
  async findOne(@Param('slug') slug: string) {
    return this.collectionsService.findOne(slug);
  }

  // ============ PROTECTED ENDPOINTS (Vendors & Admins) ============

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: User,
    @Body() createCollectionDto: CreateCollectionDto,
  ) {
    return this.collectionsService.create(user, createCollectionDto);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() updateCollectionDto: UpdateCollectionDto,
  ) {
    return this.collectionsService.update(user, id, updateCollectionDto);
  }

  @Delete(':id')
  async remove(@CurrentUser() user: User, @Param('id') id: string) {
    return this.collectionsService.remove(user, id);
  }

  // ============ VENDOR-SPECIFIC ENDPOINTS ============

  @Get('vendor/my-collections')
  async getMyCollections(@CurrentUser() user: User, @Query() query: any) {
    const vendorId = await this.collectionsService.getVendorIdFromUser(user);
    return this.collectionsService.findAll({
      ...query,
      vendorId,
      includeUnpublished: true,
    });
  }

  // ============ ADMIN-ONLY ENDPOINTS ============

  @Get('admin/all')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async adminFindAll(@Query() query: any) {
    return this.collectionsService.findAll({
      ...query,
      includeUnpublished: true,
    });
  }

  @Patch(':id/feature')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async toggleFeature(
    @Param('id') id: string,
    @Body('isFeatured') isFeatured: boolean,
  ) {
    return this.collectionsService.adminUpdate(id, { isFeatured });
  }

  @Patch(':id/publish')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async togglePublish(
    @Param('id') id: string,
    @Body('isPublished') isPublished: boolean,
  ) {
    return this.collectionsService.adminUpdate(id, { isPublished });
  }
}
