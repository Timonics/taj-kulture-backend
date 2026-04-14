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
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../core/decorators/roles.decorator';
import { UserRole } from 'generated/prisma/client';
import { CategoryResponseDto } from './dto/category-response.dto';
// import { Serialize } from 'src/core/interceptors/serialize.interceptor';
import { Public } from 'src/core/decorators/public.decorator';
import { ParseIdPipe } from 'src/core/pipes/parse-id.pipe';

@Controller('categories')
// @Serialize(CategoryResponseDto)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MODERATOR) // adjust roles as needed
  create(@Body() createCategoryDto: CreateCategoryDto) {
    return this.categoriesService.create(createCategoryDto);
  }

  @Public()
  @Get()
  findAll(@Query('includeInactive') includeInactive?: string) {
    // ?includeInactive=true to include inactive categories (admin only)
    const include = includeInactive === 'true';
    // You might want to protect this with a guard if needed
    return this.categoriesService.findAll(include);
  }

  @Public()
  @Get('tree')
  getTree(@Query('includeInactive') includeInactive?: string) {
    const include = includeInactive === 'true';
    return this.categoriesService.getTree(include);
  }

  @Public()
  @Get(':idOrSlug')
  findOne(@Param('idOrSlug') idOrSlug: string) {
    return this.categoriesService.findOne(idOrSlug);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  update(@Param('id', ParseIdPipe) id: string, @Body() updateCategoryDto: UpdateCategoryDto) {
    return this.categoriesService.update(id, updateCategoryDto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  remove(@Param('id', ParseIdPipe ) id: string) {
    return this.categoriesService.remove(id);
  }
}