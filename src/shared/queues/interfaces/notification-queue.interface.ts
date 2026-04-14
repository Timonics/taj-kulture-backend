export interface InAppNotificationJobData {
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  data?: Record<string, any>;
  actionUrl?: string;
  correlationId?: string;
}

export interface BulkNotificationJobData {
  userIds: string[];
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  data?: Record<string, any>;
  actionUrl?: string;
  chunkIndex: number;
  correlationId?: string;
}

export interface PushNotificationJobData {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  correlationId?: string;
}