export interface RequestContext {
  correlationId: string;
  userId?: string;
  userRole?: string;
  ip?: string;
  userAgent?: string;
  timestamp: Date;
}

export interface AuthenticatedRequest extends Request {
  user: any;
  context: RequestContext;
}
