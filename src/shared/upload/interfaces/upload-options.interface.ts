/**
 * UPLOAD OPTIONS
 *
 * Configuration for file upload operations.
 */
export interface UploadOptions {
  /** Folder path in S3 (e.g., 'products', 'vendors', 'avatars') */
  folder: string;
  
  /** Allowed MIME types (default: images) */
  allowedMimeTypes?: string[];
  
  /** Max file size in bytes (default: 5MB) */
  maxSize?: number;
  
  /** Whether to generate a unique filename (default: true) */
  generateUniqueName?: boolean;
}