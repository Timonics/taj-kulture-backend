import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { DatabaseModule } from 'src/shared/database/database.module';
import { UploadModule } from 'src/shared/upload/upload.module';
import { CacheModule } from 'src/shared/cache/cache.module';

@Module({
  imports: [DatabaseModule, UploadModule, CacheModule],
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
