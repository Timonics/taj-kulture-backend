export const APP_NAME = 'Taj Kulture';
export const APP_VERSION = '1.0.0';

export const CACHE_KEYS = {
  CATEGORIES_TREE: 'categories:tree',
  FEATURED_PRODUCTS: 'products:featured',
  VENDOR_STATS: (id: string) => `vendor:${id}:stats`,
  COLLECTION: (slug: string) => `collection:${slug}`,
  USER_PROFILE: (id: string) => `user:${id}:profile`,
};

export const QUEUE_NAMES = {
  EMAIL: 'email',
  NOTIFICATION: 'notification',
  ANALYTICS: 'analytics',
  DEAD_LETTER: 'dead-letter',
} as const;

export const ROLES = {
  CUSTOMER: 'CUSTOMER',
  VENDOR: 'VENDOR',
  ADMIN: 'ADMIN',
  MODERATOR: 'MODERATOR',
} as const;
