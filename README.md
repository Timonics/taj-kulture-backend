```markdown
# Taj Kulture Backend API

[![Node.js](https://img.shields.io/badge/Node.js-18.x-green.svg)](https://nodejs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10.x-red.svg)](https://nestjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue.svg)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7.x-red.svg)](https://redis.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5.x-2D3748.svg)](https://www.prisma.io/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

## 📌 Overview

**Taj Kulture** is a production‑ready, multi‑vendor e‑commerce platform for Nigerian streetwear and heritage fashion. The backend serves as the complete API for vendors, customers, and administrators, handling everything from authentication and product management to orders, payments, and real‑time notifications.

Built with **NestJS** (monolithic architecture), **PostgreSQL** (via Prisma ORM), **Redis** (caching & queues), and **Bull** (background jobs). The system follows Domain‑Driven Design, event‑driven patterns, and strict security practices (HttpOnly cookies, refresh token rotation, rate limiting).

---

## 🚀 Key Features

### 👤 Authentication & Authorization
- JWT access/refresh tokens stored as **HttpOnly cookies** (XSS‑safe)
- Refresh token rotation with one‑time use
- Email verification (SendGrid)
- Password reset flow
- Google OAuth 2.0 (optional)
- Role‑based access control (`CUSTOMER`, `VENDOR`, `ADMIN`, `MODERATOR`)

### 🛍️ Multi‑Vendor Marketplace
- Vendor application & approval workflow
- Vendor profiles with custom slugs, logos, banners, social links
- Vendor verification badges (Verified, Featured, Artisan)
- Follow/unfollow vendors
- Vendor analytics (sales, product performance)

### 📦 Product Management
- Full CRUD for vendors (images, variants, stock)
- Product variants (colors, sizes, materials)
- Bulk image upload (AWS S3)
- Stock validation & reservation
- Product statuses: `DRAFT`, `PUBLISHED`, `ARCHIVED`, `OUT_OF_STOCK`
- Featured products & collections

### 🛒 Cart & Order Flow
- Persistent shopping cart (database + Redis cache)
- Merge anonymous cart on login
- Variant selection & stock validation
- Order creation with atomic stock deduction
- Order status tracking: `PENDING` → `PROCESSING` → `SHIPPED` → `DELIVERED`
- Payment integration with **Paystack** (webhooks, verification)

### 💳 Payments
- Paystack payment gateway
- Webhook signature verification
- Idempotent order status updates

### ⭐ Reviews & Ratings
- Verified purchase badge
- Admin moderation queue
- Helpful votes (upvote/downvote)
- Vendor & product ratings aggregation

### 📊 Analytics & Search
- PostgreSQL full‑text search with ranking
- Search term analytics
- Product view tracking (for recommendations)
- Vendor sales dashboard

### 🔔 Event‑Driven & Background Jobs
- **EventBus** with type‑safe event map
- Bull queues for emails, notifications, analytics
- Dead‑letter queue for failed jobs
- Admin queue monitoring UI

### 🔒 Security
- HttpOnly cookies + SameSite=Lax
- Rate limiting (global & per‑login)
- Helmet security headers
- CORS whitelist
- Input validation (class‑validator)
- Prisma SQL injection protection

---

## 🧱 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Nginx / CloudFront                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   NestJS Application (API)                  │
├───────────────┬───────────────┬───────────────┬────────────┤
│   Controllers │   Services    │   Guards      │ Interceptors│
└───────────────┴───────────────┴───────────────┴────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│   PostgreSQL  │    │     Redis     │    │    AWS S3     │
│   (Prisma)    │    │ (Cache/Queues)│    │   (Images)    │
└───────────────┘    └───────────────┘    └───────────────┘
```

### Core Modules

| Module        | Responsibility                                         |
|---------------|--------------------------------------------------------|
| `Auth`        | Registration, login, token management, OAuth          |
| `Users`       | Profile, addresses, follow/unfollow                   |
| `Vendors`     | Application, approval, verification, vendor dashboard |
| `Products`    | CRUD, variants, stock, images                         |
| `Categories`  | Hierarchical product/vendor categories                |
| `Collections` | Curated product groups (admin or vendor owned)        |
| `Cart`        | Shopping cart with variants and price snapshots       |
| `Orders`      | Order creation, status management, stock deduction    |
| `Payments`    | Paystack integration, webhooks                        |
| `Reviews`     | Product/vendor reviews, moderation, helpful votes     |
| `Wishlist`    | Save products for later, move to cart                 |
| `Search`      | Full‑text search with filtering & ranking             |
| `Admin`       | Vendor approval, review moderation, analytics         |

### Shared Infrastructure

- **`ConfigModule`** – Type‑safe environment variables (class‑validator + singleton)
- **`LoggerModule`** – Winston + correlation IDs (AsyncLocalStorage) + log rotation
- **`CacheModule`** – Redis caching with tag‑based invalidation
- **`QueueModule`** – Bull queues (email, notification, analytics, dead‑letter)
- **`EventModule`** – Type‑safe event bus (`EventEmitter2`)
- **`EmailModule`** – SendGrid + Handlebars templates + fallback HTML
- **`UploadModule`** – AWS S3 file upload (images, logos)
- **`DatabaseModule`** – Prisma service (with PrismaPg adapter)
- **`RedisModule`** – ioredis client with mock support

---

## 🛠️ Tech Stack

| Category          | Technology                                                   |
|-------------------|--------------------------------------------------------------|
| Runtime           | Node.js 18+                                                  |
| Framework         | NestJS 10.x                                                  |
| Language          | TypeScript 5.x                                               |
| ORM               | Prisma 5.x (with PrismaPg adapter)                          |
| Database          | PostgreSQL 15                                                |
| Cache & Queues    | Redis 7.x + BullMQ                                           |
| Authentication    | JWT (Passport), Google OAuth 2.0                            |
| Email             | SendGrid + Handlebars                                        |
| File Storage      | AWS S3                                                       |
| Payment Gateway   | Paystack                                                     |
| Validation        | class-validator + class-transformer                         |
| Logging           | Winston + DailyRotateFile                                    |
| Testing           | Jest + Supertest                                             |
| Containerization  | Docker / Docker Compose                                      |

---

## 📁 Project Structure

```
src/
├── config/                     # Environment configuration
│   ├── env/
│   │   ├── env.service.ts      # Singleton environment service
│   │   └── env.validation.ts   # Zod/class-validator schema
│   └── config.module.ts
├── core/                       # Cross‑cutting concerns
│   ├── constants/              # Error codes, cache keys, queue names
│   ├── decorators/             # @Public(), @Roles(), @CurrentUser()
│   ├── exceptions/             # Domain exceptions & error codes
│   ├── filters/                # Global exception filter
│   ├── guards/                 # JWT, roles, throttler
│   ├── interceptors/           # Transform, serialize, cache, timeout
│   ├── middleware/             # Correlation ID, request context, helmet
│   ├── pipes/                  # Validation, parse UUID
│   └── context/                # AsyncLocalStorage request context
├── modules/                    # Business modules
│   ├── auth/
│   ├── users/
│   ├── vendors/
│   ├── products/
│   ├── categories/
│   ├── collections/
│   ├── cart/
│   ├── orders/
│   ├── payments/
│   ├── reviews/
│   ├── wishlist/
│   ├── search/
│   └── admin/
├── shared/                     # Reusable infrastructure
│   ├── database/               # Prisma service
│   ├── cache/                  # Redis + memory cache
│   ├── queue/                  # Bull queues & processors
│   ├── events/                 # EventBus & handlers
│   ├── email/                  # SendGrid service
│   ├── upload/                 # S3 upload
│   ├── redis/                  # Redis client
│   └── logger/                 # Winston logger
└── main.ts
```

---

## 🔧 Installation & Setup

### Prerequisites

- Node.js 18+
- PostgreSQL 15+
- Redis 7+
- AWS account (for S3, optional)
- SendGrid account (optional)

### Environment Variables

Create a `.env` file in the root (see `.env.example`):

```env
# Core
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/taj_kulture

# JWT
JWT_SECRET=your-super-secret-min-32-chars
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=refresh-secret-min-32-chars
JWT_REFRESH_EXPIRES_IN=30d

# Redis
REDIS_ENABLED=true
REDIS_URL=redis://localhost:6379
REDIS_DB=0

# SendGrid
SENDGRID_API_KEY=your-api-key
SENDGRID_FROM_EMAIL=noreply@tajkulture.com
SENDGRID_FROM_NAME="Taj Kulture"

# AWS S3
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_REGION=us-east-1
AWS_S3_BUCKET=taj-kulture-assets

# Frontend URL (for email links)
FRONTEND_URL=http://localhost:3001

# Rate Limiting
THROTTLE_TTL=60
THROTTLE_LIMIT=100

# Bcrypt
BCRYPT_ROUNDS=10
```

### Install Dependencies

```bash
npm install
```

### Database Setup

```bash
# Run migrations
npx prisma migrate dev

# Seed database (optional)
npm run seed
```

### Start Development Server

```bash
npm run start:dev
```

### Run Tests

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Coverage
npm run test:cov
```

### Docker Compose (Full Stack)

```bash
docker-compose up -d
```

---

## 📡 API Documentation

All endpoints follow a standard response format:

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2025-04-14T12:00:00Z",
    "path": "/api/products",
    "page": 1,
    "total": 100
  }
}
```

### Authentication

| Method | Endpoint                     | Description                 |
|--------|------------------------------|-----------------------------|
| POST   | `/api/auth/register`         | Create new account          |
| POST   | `/api/auth/login`            | Login (sets HttpOnly cookies)|
| POST   | `/api/auth/logout`           | Logout (clears cookies)     |
| POST   | `/api/auth/refresh`          | Refresh access token        |
| GET    | `/api/auth/verify-email`     | Verify email address        |
| POST   | `/api/auth/forgot-password`  | Request password reset      |
| POST   | `/api/auth/reset-password`   | Reset password with token   |

### Users

| Method | Endpoint                     | Description                 |
|--------|------------------------------|-----------------------------|
| GET    | `/api/users/me`              | Get current user profile    |
| PATCH  | `/api/users/me`              | Update profile              |
| GET    | `/api/users/me/addresses`    | List user addresses         |
| POST   | `/api/users/me/addresses`    | Add address                 |
| GET    | `/api/users/profile/:username`| Public profile              |

### Vendors

| Method | Endpoint                     | Description                 |
|--------|------------------------------|-----------------------------|
| POST   | `/api/vendors/apply`         | Apply to become a vendor    |
| GET    | `/api/vendors`               | List vendors (public)       |
| GET    | `/api/vendors/:slug`         | Vendor public profile       |
| GET    | `/api/vendors/me/profile`    | My vendor profile           |
| PATCH  | `/api/vendors/me/profile`    | Update my vendor            |
| POST   | `/api/vendors/:vendorId/follow` | Follow a vendor           |

### Products

| Method | Endpoint                     | Description                 |
|--------|------------------------------|-----------------------------|
| POST   | `/api/products`              | Create product (vendor only)|
| GET    | `/api/products`              | List published products     |
| GET    | `/api/products/my-products`  | My products (vendor)        |
| GET    | `/api/products/:slug`        | Get product details         |
| PATCH  | `/api/products/:id`          | Update product              |
| DELETE | `/api/products/:id`          | Delete product              |

### Orders & Payments

| Method | Endpoint                     | Description                 |
|--------|------------------------------|-----------------------------|
| POST   | `/api/orders`                | Create order from cart      |
| GET    | `/api/orders`                | My orders                   |
| GET    | `/api/orders/:id`            | Order details               |
| POST   | `/api/orders/:id/cancel`     | Cancel order                |
| POST   | `/api/payments/initialize`   | Initialize Paystack payment |
| POST   | `/api/payments/webhook`      | Paystack webhook            |

*(Full Postman collection available in `/docs`)*

---

## 🧪 Testing Strategy

- **Unit Tests** – Jest, isolated services with mocks (coverage > 80%)
- **Integration Tests** – Real database (test database), Redis mock
- **E2E Tests** – Supertest, full API flows (auth, cart → order → payment)
- **Factories** – Test data factories for all entities

```bash
npm run test:cov
```

---

## 🚢 Deployment

### Production Build

```bash
npm run build
npm run start:prod
```

### Using PM2

```bash
pm2 start dist/main.js --name taj-kulture-api
```

### Environment‑Specific Configuration

Use `.env.production`, `.env.staging`, etc. The app loads based on `NODE_ENV`.

### Health Check

```
GET /health
```

Returns `{ status: 'ok', uptime: 123, redis: 'up', db: 'up' }`

---

## 📈 Monitoring & Logging

- **Winston** logs to rotating JSON files (`/logs/`)
- Correlation IDs track requests across logs
- **Bull Board** for queue monitoring (admin only)

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open a Pull Request

---

## 📄 License

MIT © Oderinde Michael

---

## 🙏 Acknowledgments

- NestJS team for the amazing framework
- Prisma for the type‑safe ORM
- BullMQ for robust job queues
- The entire open‑source community

---

## 📬 Contact

For questions or opportunities, reach out via [LinkedIn](https://linkedin.com/in/oderinde-michael) or [Email](mailto:Olubiyioderinde7@gmail.com).

---

**Built with ❤️ for African fashion and culture.**
```