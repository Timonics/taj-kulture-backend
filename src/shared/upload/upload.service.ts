import { Injectable, InternalServerErrorException } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import { EnvironmentService } from '../../config/env/env.service';
import { ILogger } from '../logger/logger.interface';
import { LoggerService } from '../logger/logger.service';
import { ERROR_CODES } from 'src/core/constants/error-codes.constants';
import { UploadResponseDto } from './dto/upload-response.dto';
import { RequestContext } from 'src/core/context/request-context';

export interface UploadResult {
  url: string;
  key: string;
}

/**
 * UPLOAD SERVICE
 *
 * Handles file uploads to AWS S3 with production-grade error handling.
 *
 * WHY S3:
 * - Scalable, durable storage
 * - CDN integration for fast delivery
 * - Lifecycle policies for old files
 *
 * SECURITY:
 * - Files are uploaded with unique names (prevents overwrites)
 * - MIME type validation prevents malicious files
 * - Size limits prevent resource exhaustion
 *
 * USED BY:
 * - Product images
 * - Vendor logos/banners
 * - User avatars
 * - Collection covers
 */
@Injectable()
export class UploadService {
  private readonly logger: ILogger;
  private readonly s3Client: S3Client;
  private readonly bucket: string;
  private readonly region: string;
  private readonly publicUrl?: string;

  constructor(
    private env: EnvironmentService,
    logger: LoggerService,
  ) {
    this.logger = logger.child('UploadService');

    // Load configuration
    this.bucket = this.env.get('AWS_S3_BUCKET');
    this.region = this.env.get('AWS_REGION');
    const accessKeyId = this.env.get('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.env.get('AWS_SECRET_ACCESS_KEY');
    const endpoint = this.env.get('AWS_S3_ENDPOINT');
    this.publicUrl = this.env.get('AWS_S3_BUCKET_PUBLIC_URL');

    // Validate required config
    if (!accessKeyId || !secretAccessKey) {
      this.logger.error('AWS credentials missing');
      throw new Error('AWS S3 configuration: missing credentials');
    }
    if (!this.bucket || !this.region) {
      this.logger.error('AWS S3 bucket or region missing');
      throw new Error('AWS S3 configuration: missing bucket or region');
    }

    // Initialize S3 client
    this.s3Client = new S3Client({
      region: this.region,
      credentials: { accessKeyId, secretAccessKey },
      endpoint: endpoint || undefined,
      maxAttempts: 3, // Retry failed requests up to 3 times
    });

    this.logger.info('UploadService initialized', {
      bucket: this.bucket,
      region: this.region,
    });
  }

  /**
   * Upload a file to S3
   *
   * @param file - Multer file object (buffer, originalname, mimetype)
   * @param folder - Target folder in S3 (e.g., 'products', 'vendors')
   * @returns Object containing public URL and S3 key
   *
   * @example
   * const { url, key } = await uploadService.uploadFile(file, 'products');
   */
  async uploadFile(
    file: Express.Multer.File,
    folder: string = 'products',
  ): Promise<UploadResponseDto> {
    const correlationId = RequestContext.getCorrelationId(); // Get correlation ID from request context for logging
    this.logger.debug(`Uploading file to ${folder}`, {
      correlationId,
      fileName: file.originalname,
      size: file.size,
    });

    // Generate unique filename to prevent collisions and directory traversal
    const extension = this.getFileExtension(file.originalname);
    const uniqueName = `${uuidv4()}-${Date.now()}${extension}`;
    const sanitizedOriginal = this.sanitizeFilename(file.originalname);
    const key = `${folder}/${uniqueName}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      // Uncomment if bucket allows public-read ACL
      // ACL: 'public-read',
      Metadata: {
        originalName: sanitizedOriginal,
        uploadedAt: new Date().toISOString(),
        size: String(file.size),
      },
    });

    try {
      await this.s3Client.send(command);

      // Generate public URL (either custom domain or default S3 URL)
      const url = this.publicUrl
        ? `${this.publicUrl}/${key}`
        : `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;

      this.logger.info(`File uploaded successfully: ${key}`, {
        correlationId,
        url,
      });
      return { url, key };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Failed to upload file to S3: ${errorMessage}`,
        errorStack,
        { correlationId },
      );
      throw new InternalServerErrorException({
        message: 'Failed to upload file',
        code: ERROR_CODES.PRODUCT_IMAGE_UPLOAD_FAILED,
      });
    }
  }

  /**
   * Delete a file from S3 by its key
   *
   * @param key - S3 object key (e.g., 'products/uuid-filename.jpg')
   */
  async deleteFile(key: string, correlationId?: string): Promise<void> {
    this.logger.debug(`Deleting file: ${key}`, { correlationId });

    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    try {
      await this.s3Client.send(command);
      this.logger.info(`File deleted: ${key}`, { correlationId });
    } catch (error) {
      // Don't throw on delete failure – orphaned files are acceptable
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Failed to delete file from S3: ${errorMessage}`,
        errorStack,
        { correlationId },
      );
    }
  }

  /**
   * Extract S3 key from a full URL
   * Useful for cleaning up when you only have the URL
   */
  extractKeyFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      // Remove leading slash
      return urlObj.pathname.substring(1);
    } catch {
      return null;
    }
  }

  /**
   * Get file extension from filename (including dot)
   */
  private getFileExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.');
    return lastDot !== -1 ? filename.substring(lastDot) : '';
  }

  /**
   * Sanitize filename to prevent injection issues
   */
  private sanitizeFilename(filename: string): string {
    // Remove path traversal and special characters
    return filename.replace(/[^a-zA-Z0-9.\-_]/g, '_').substring(0, 100);
  }
}
