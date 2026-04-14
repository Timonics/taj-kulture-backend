import { Multer } from 'multer';

declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
      user?: {
        id: string;
        email: string;
        role: string;
      };
    }
    interface Multer {
      File: Multer.File;
    }
  }
}
