import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
// import { Express } from 'express';

@Injectable()
export class UploadService {
  private readonly s3Client: S3Client;
  private readonly bucket: string;
  private readonly region: string;
  private readonly logger = new Logger(UploadService.name);

  constructor(private configService: ConfigService) {
    this.region = this.configService.get<string>('AWS_REGION')!;
    this.bucket = this.configService.get<string>('AWS_S3_BUCKET')!;
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY');

    if (!accessKeyId || !secretAccessKey || !this.region || !this.bucket) {
      throw new Error('AWS S3 configuration missing');
    }

    this.s3Client = new S3Client({
      region: this.region,
      credentials: { accessKeyId, secretAccessKey },
      endpoint: this.configService.get<string>('AWS_S3_ENDPOINT') || undefined,
    });
  }

  async uploadFile(file: Express.Multer.File, folder = 'products'): Promise<{ url: string; key: string }> {
    const key = `${folder}/${uuidv4()}-${file.originalname.replace(/\s+/g, '-')}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      // ACL: 'public-read', // if bucket allows ACLs
    });

    try {
      await this.s3Client.send(command);
      const url = `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
      return { url, key };
    } catch (error) {
      this.logger.error(`Failed to upload file to S3: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to upload file');
    }
  }

  async deleteFile(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    try {
      await this.s3Client.send(command);
    } catch (error) {
      this.logger.error(`Failed to delete file from S3: ${error.message}`, error.stack);
      // Don't throw, just log
    }
  }

  // Helper to extract S3 key from URL (optional, for cleanup)
  extractKeyFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname.substring(1); // remove leading slash
    } catch {
      return null;
    }
  }
}