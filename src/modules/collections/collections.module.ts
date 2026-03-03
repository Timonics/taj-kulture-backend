import { Module } from '@nestjs/common';
import { CollectionsController } from './collections.controller';
import { CollectionsService } from './collections.service';
import { DatabaseModule } from 'src/shared/database/database.module';
import { CacheModule } from 'src/shared/cache/cache.module';

@Module({
  imports: [DatabaseModule, CacheModule],
  controllers: [CollectionsController],
  providers: [CollectionsService],
})
export class CollectionsModule {}
