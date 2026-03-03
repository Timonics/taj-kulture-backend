import { Module } from '@nestjs/common';
import { VendorsService } from './vendors.service';
import { VendorsController } from './vendors.controller';
import { DatabaseModule } from 'src/shared/database/database.module';
import { CacheModule } from 'src/shared/cache/cache.module';

@Module({
  imports: [DatabaseModule, CacheModule],
  controllers: [VendorsController],
  providers: [VendorsService],
})
export class VendorsModule {}
