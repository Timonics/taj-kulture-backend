// /**
//  * TEST DATA FACTORY
//  *
//  * PURPOSE: Creates test data with sensible defaults
//  *
//  * WHY FACTORY PATTERN:
//  * - Eliminates repetitive test setup code
//  * - Ensures consistent test data
//  * - Easy to customize specific fields while keeping defaults
//  *
//  * EXAMPLE:
//  *   // Create a user with default values
//  *   const user = await createUser();
//  *
//  *   // Create a custom user
//  *   const admin = await createUser({ role: 'ADMIN', email: 'admin@test.com' });
//  *
//  *   // Create user with related vendor
//  *   const vendor = await createVendor({ user: user.id });
//  */

// import {
//   UserRole,
//   VerificationStatus,
//   PaymentStatus,
//   OrderStatus,
// } from 'generated/prisma/enums';
// import { TestDatabase } from './test-database';
// import * as bcrypt from 'bcrypt';

// const prisma = TestDatabase.getPrisma();

// // ============================================
// // USER FACTORY
// // ============================================

// interface CreateUserOptions {
//   email?: string;
//   username?: string;
//   password?: string;
//   role?: UserRole;
//   isEmailVerified?: boolean;
// }

// /**
//  * Create a test user with sensible defaults
//  *
//  * @example
//  * // Basic user
//  * const user = await createUser();
//  *
//  * // Admin user
//  * const admin = await createUser({ role: 'ADMIN' });
//  *
//  * // Unverified user
//  * const unverified = await createUser({ isEmailVerified: false });
//  */
// export async function createUser(options: CreateUserOptions = {}) {
//   const timestamp = Date.now();

//   const userData = {
//     email: options.email || `test-${timestamp}@example.com`,
//     username: options.username || `testuser-${timestamp}`,
//     password: options.password || (await bcrypt.hash('Test123!@#', 10)),
//     role: options.role || 'CUSTOMER',
//     isEmailVerified:
//       options.isEmailVerified !== undefined ? options.isEmailVerified : true,
//   };

//   return prisma.user.create({
//     data: userData,
//   });
// }

// // ============================================
// // VENDOR FACTORY
// // ============================================

// interface CreateVendorOptions {
//   userId?: string;
//   name?: string;
//   slug?: string;
//   isVerified?: boolean;
//   verificationStatus?: VerificationStatus;
// }

// /**
//  * Create a test vendor (automatically creates a user if not provided)
//  */
// export async function createVendor(options: CreateVendorOptions = {}) {
//   let userId = options.userId;

//   // Create a user if not provided
//   if (!userId) {
//     const user = await createUser({ role: 'VENDOR' });
//     userId = user.id;
//   }

//   const timestamp = Date.now();

//   return prisma.vendor.create({
//     data: {
//       userId: userId,
//       name: options.name || `Test Vendor ${timestamp}`,
//       slug: options.slug || `test-vendor-${timestamp}`,
//       isVerified: options.isVerified !== undefined ? options.isVerified : true,
//       verificationStatus:
//         options.verificationStatus || VerificationStatus.VERIFIED,
//       description: 'Test vendor description',
//       story: 'Test vendor story',
//     },
//   });
// }

// // ============================================
// // PRODUCT FACTORY
// // ============================================

// interface CreateProductOptions {
//   vendorId?: string;
//   name?: string;
//   slug?: string;
//   price?: number;
//   stock?: number;
//   status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | 'OUT_OF_STOCK';
//   categoryId?: string;
// }

// /**
//  * Create a test product (automatically creates vendor if not provided)
//  */
// export async function createProduct(options: CreateProductOptions = {}) {
//   let vendorId = options.vendorId;

//   // Create a vendor if not provided
//   if (!vendorId) {
//     const vendor = await createVendor();
//     vendorId = vendor.id;
//   }

//   const timestamp = Date.now();

//   return prisma.product.create({
//     data: {
//       vendorId: vendorId,
//       name: options.name || `Test Product ${timestamp}`,
//       slug: options.slug || `test-product-${timestamp}`,
//       description: 'Test product description',
//       price: options.price || 10000,
//       stock: options.stock || 100,
//       status: options.status || 'PUBLISHED',
//     },
//   });
// }

// // ============================================
// // ORDER FACTORY
// // ============================================

// interface CreateOrderOptions {
//   userId?: string;
//   status?: OrderStatus;
//   paymentStatus?: PaymentStatus;
//   total?: number;
// }

// /**
//  * Create a test order (automatically creates user if not provided)
//  */
// export async function createOrder(options: CreateOrderOptions = {}) {
//   let userId = options.userId;

//   // Create a user if not provided
//   if (!userId) {
//     const user = await createUser();
//     userId = user.id;
//   }

//   // Generate order number: TAJ-YYYYMMDD-XXXX
//   const date = new Date();
//   const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
//   const random = Math.floor(Math.random() * 10000)
//     .toString()
//     .padStart(4, '0');
//   const orderNumber = `TAJ-${dateStr}-${random}`;

//   return prisma.order.create({
//     data: {
//       orderNumber: orderNumber,
//       userId: userId,
//       status: options.status || 'PENDING',
//       paymentStatus: options.paymentStatus || 'PENDING',
//       total: options.total || 50000,
//       shippingAddress: {
//         create: {
//           fullName: 'Test Customer',
//           addressLine1: '123 Test Street',
//           city: 'Lagos',
//           state: 'Lagos',
//           country: 'Nigeria',
//           phone: '+2341234567890',
//         },
//       },
//     },
//     include: {
//       shippingAddress: true,
//     },
//   });
// }

// // ============================================
// // CATEGORY FACTORY
// // ============================================

// interface CreateCategoryOptions {
//   name?: string;
//   slug?: string;
//   parentId?: string;
// }

// /**
//  * Create a test category
//  */
// export async function createCategory(options: CreateCategoryOptions = {}) {
//   const timestamp = Date.now();

//   return prisma.category.create({
//     data: {
//       name: options.name || `Test Category ${timestamp}`,
//       slug: options.slug || `test-category-${timestamp}`,
//       description: 'Test category description',
//       level: options.parentId ? 2 : 1,
//       path: options.parentId ? `parent.${timestamp}` : `${timestamp}`,
//       pathIds: options.parentId
//         ? [options.parentId, timestamp.toString()]
//         : [timestamp.toString()],
//     },
//   });
// }

// // ============================================
// // COLLECTION FACTORY
// // ============================================

// interface CreateCollectionOptions {
//   vendorId?: string;
//   name?: string;
//   slug?: string;
//   type?: 'CURATED' | 'SEASONAL' | 'THEMED' | 'FEATURED' | 'LIMITED';
//   isPublished?: boolean;
// }

// /**
//  * Create a test collection
//  */
// export async function createCollection(options: CreateCollectionOptions = {}) {
//   const timestamp = Date.now();

//   return prisma.collection.create({
//     data: {
//       vendorId: options.vendorId,
//       name: options.name || `Test Collection ${timestamp}`,
//       slug: options.slug || `test-collection-${timestamp}`,
//       description: 'Test collection description',
//       type: options.type || 'CURATED',
//       isPublished:
//         options.isPublished !== undefined ? options.isPublished : true,
//     },
//   });
// }

// // ============================================
// // REVIEW FACTORY
// // ============================================

// interface CreateReviewOptions {
//   userId?: string;
//   productId?: string;
//   rating?: number;
//   content?: string;
//   status?: 'PENDING' | 'APPROVED' | 'REJECTED';
// }

// /**
//  * Create a test review (automatically creates user and product if not provided)
//  */
// export async function createReview(options: CreateReviewOptions = {}) {
//   let userId = options.userId;
//   let productId = options.productId;

//   if (!userId) {
//     const user = await createUser();
//     userId = user.id;
//   }

//   if (!productId) {
//     const product = await createProduct();
//     productId = product.id;
//   }

//   return prisma.review.create({
//     data: {
//       userId: userId,
//       productId: productId,
//       rating: options.rating || 5,
//       content: options.content || 'Great product!',
//       status: options.status || 'APPROVED',
//     },
//   });
// }

// // ============================================
// // CART ITEM FACTORY
// // ============================================

// interface CreateCartItemOptions {
//   userId?: string;
//   productId?: string;
//   quantity?: number;
// }

// /**
//  * Create a test cart item (automatically creates user and product if not provided)
//  */
// export async function createCartItem(options: CreateCartItemOptions = {}) {
//   let userId = options.userId;
//   let productId = options.productId;

//   if (!userId) {
//     const user = await createUser();
//     userId = user.id;
//   }

//   if (!productId) {
//     const product = await createProduct();
//     productId = product.id;
//   }

//   // Get or create cart for user
//   let cart = await prisma.cart.findUnique({
//     where: { userId: userId },
//   });

//   if (!cart) {
//     cart = await prisma.cart.create({
//       data: { userId: userId },
//     });
//   }

//   // Get product price for snapshot
//   const product = await prisma.product.findUnique({
//     where: { id: productId },
//   });

//   return prisma.cartItem.create({
//     data: {
//       cartId: cart.id,
//       productId: productId,
//       quantity: options.quantity || 1,
//       priceSnapshot: product?.price || 10000,
//     },
//   });
// }
