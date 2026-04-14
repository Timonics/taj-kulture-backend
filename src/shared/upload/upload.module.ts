/**
 * UPLOAD MODULE
 *
 * Provides file upload capabilities using AWS S3.
 *
 * @Global() - Makes UploadService available throughout the app
 */

import { Global, Module } from '@nestjs/common';
import { UploadService } from './upload.service';
import { UploadController } from './upload.controller';

@Global()
@Module({
  providers: [UploadService],
  controllers: [UploadController],
  exports: [UploadService],
})
export class UploadModule {}
