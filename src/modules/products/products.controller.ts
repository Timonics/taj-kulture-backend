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
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../core/decorators/roles.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { User, UserRole, ProductStatus } from 'generated/prisma/client';
import { Public } from 'src/core/decorators/public.decorator';

@Controller('products')
// @Serialize(ProductResponseDto)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // Vendor: Create product
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() user: User, @Body() createProductDto: CreateProductDto) {
    return this.productsService.create(user, createProductDto);
  }

  // Public: List products (only published)
  @Public()
  @Get()
  findAll(@Query() query: any) {
    // Force status to PUBLISHED for public
    const publicQuery = { ...query, status: ProductStatus.PUBLISHED };
    return this.productsService.findAll(publicQuery);
  }

  // Vendor: List their own products (including drafts)
  @Get('my-products')
  async findMyProducts(@CurrentUser() user: User, @Query() query: any) {
    const vendorId = await this.productsService.getVendorIdFromUser(user);
    return this.productsService.findAll({ ...query, vendorId });
  }

  // Public: Get single product by slug
  @Public()
  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.productsService.findOne(slug);
  }

  // Vendor/Admin: Update product
  @Patch(':id')
  update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    return this.productsService.update(user, id, updateProductDto);
  }

  // Vendor/Admin: Delete product
  @Delete(':id')
  remove(@CurrentUser() user: User, @Param('id') id: string) {
    return this.productsService.remove(user, id);
  }
}
