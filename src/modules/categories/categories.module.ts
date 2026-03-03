import { Module } from '@nestjs/common';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { DatabaseModule } from 'src/shared/database/database.module';
import { CacheModule } from 'src/shared/cache/cache.module';

@Module({
  imports: [DatabaseModule, CacheModule],
  controllers: [CategoriesController],
  providers: [CategoriesService],
})
export class CategoriesModule {}
