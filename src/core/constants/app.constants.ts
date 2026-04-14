export const APP_NAME = 'Taj Kulture';
export const APP_VERSION = '1.0.0';

export const CACHE_KEYS = {
  //Products
  PRODUCTS: (query?: any) =>
    query ? `products:${JSON.stringify(query)}` : 'products',
  PRODUCT: (idOrSlug: string) => `product:${idOrSlug}`,
  FEATURED_PRODUCTS: 'products:featured',

  //Categories
  CATEGORIES_TREE: (includeInactive?: boolean) =>
    `categories:tree:${includeInactive ?? false}`,
  CATEGORIES: (slug?: string) => (slug ? `categories:${slug}` : 'categories'),
  CATEGORY: (idOrSlug: string) => `category:${idOrSlug}`,
  ALL_CATEGORIES: (includeInactive?: boolean) =>
    `categories:all:${includeInactive ?? false}`,

  // Vendors
  VENDORS: (query?: any) =>
    query ? `vendors:${JSON.stringify(query)}` : 'vendors',
  VENDOR: (idOrSlug: string) => `vendor:${idOrSlug}`,
  VENDOR_FOLLOWERS: (idOrSlug: string) => `vendor:${idOrSlug}:followers`,
  VENDOR_STATS: (id: string) => `vendor:${id}:stats`,

  //Collections
  COLLECTIONS: (query?: any) =>
    query ? `collections:${JSON.stringify(query)}` : 'collections',
  COLLECTION: (idOrSlug: string) => `collection:${idOrSlug}`,

  USER_PROFILE: (id: string) => `user:${id}:profile`,
  USER_LOGIN_ATTEMPTS: (email: string) => `login_attempts:${email}`,

  //Cart
  CART: (userId: string) => `cart:${userId}`,
  ANONYMOUS_CART: (userId: string) => `anonymous_cart:${userId}`,
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
