import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';
import { RolesGuard } from '../../modules/auth/guards/roles.guard';
import { Roles } from '../../core/decorators/roles.decorator';
import { UserRole } from '../../../generated/prisma/client';
import { UploadResponseDto } from './dto/upload-response.dto';
import { ApiResponse } from '../../core/interfaces/api-response.interface';

/**
 * UPLOAD CONTROLLER
 *
 * Provides endpoints for file uploads to AWS S3.
 *
 * SECURITY:
 * - Only authenticated users with VENDOR or ADMIN role can upload
 * - File size limited to 5MB
 * - Only image files allowed (png, jpeg, jpg, gif, webp)
 *
 * ENDPOINTS:
 * - POST /upload - Upload a single file (returns URL and key)
 */
@Controller('upload')
@UseGuards(RolesGuard)
@Roles(UserRole.VENDOR, UserRole.ADMIN)
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  /**
   * Upload a single file
   *
   * @param file - Multipart file (field name: 'file')
   * @returns Object with file URL and S3 key
   *
   * @example
   * POST /upload
   * Content-Type: multipart/form-data
   * Body: { file: (binary) }
   */
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
          new FileTypeValidator({ fileType: '.(png|jpeg|jpg|gif|webp)' }),
        ],
      }),
    )
    file: Express.Multer.File,
  ): Promise<ApiResponse<UploadResponseDto>> {
    const result = await this.uploadService.uploadFile(file, 'products');

    return {
      success: true,
      data: result,
      meta: {
        timestamp: new Date().toISOString(),
        path: '/upload',
      },
    };
  }
}
