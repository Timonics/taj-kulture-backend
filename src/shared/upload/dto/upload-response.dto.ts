import { Expose } from 'class-transformer';

/**
 * UPLOAD RESPONSE DTO
 *
 * Returned after successful file upload.
 *
 * @example
 * {
 *   "success": true,
 *   "data": {
 *     "url": "https://bucket.s3.region.amazonaws.com/products/uuid-filename.jpg",
 *     "key": "products/uuid-filename.jpg"
 *   }
 * }
 */
export class UploadResponseDto {
  @Expose()
  url: string;

  @Expose()
  key: string;
}
