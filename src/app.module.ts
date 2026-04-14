import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { validate } from './config/env/env.validation';
import { EmailModule } from './shared/email/email.module';
import { EventsModule } from './shared/events/event.module';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { CustomThrottlerGuard } from './core/guards/throttler.guard';
import { CorrelationIdMiddleware } from './core/middleware/correlation-id.middleware';
import { AuthModule } from './modules/auth/auth.module';
import { QueuesModule } from './shared/queues/queue.module';
import { UsersModule } from './modules/users/users.module';
import { DatabaseModule } from './shared/database/database.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { VendorsModule } from './modules/vendors/vendors.module';
import { ProductsModule } from './modules/products/products.module';
import { UploadModule } from './shared/upload/upload.module';
import { CollectionsModule } from './modules/collections/collections.module';
import { AllExceptionsFilter } from './core/filters/all-exceptions.filter';
import { TimeoutInterceptor } from './core/interceptors/timeout.interceptor';
import { TransformInterceptor } from './core/interceptors/transform.interceptor';
import { CustomValidationPipe } from './core/pipes/validation.pipe';
import { LoggingMiddleware } from './core/middleware/logging.middleware';
import { HelmetMiddleware } from './core/middleware/helmet.middleware';
import { RedisModule } from './shared/redis/redis.module';
import { CartModule } from './modules/cart/cart.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
// import { CookieParserMiddleware } from './core/middleware/cookie-parse.middleware';
import { ReviewsController } from './modules/reviews/reviews.controller';
import { ReviewsService } from './modules/reviews/reviews.service';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { WishlistService } from './modules/wishlist/wishlist.service';
import { WishlistController } from './modules/wishlist/wishlist.controller';
import { WishlistModule } from './modules/wishlist/wishlist.module';
import { AdminModule } from './modules/admin/admin.module';
// import { AnalyticsController } from './modules/analytics/analytics.controller';
// import { AnalyticsService } from './modules/analytics/analytics.service';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { RequestContextMiddleware } from './core/middleware/request-context.middleware';
import { ConfigModule } from './config/config.module';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule,
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get('THROTTLE_TTL') || 60,
          limit: config.get('THROTTLE_LIMIT') || 10,
        },
      ],
    }),
    EventsModule,
    QueuesModule,
    EmailModule,
    // AuthModule,
    // UsersModule,
    DatabaseModule,
    // CategoriesModule,
    // VendorsModule,
    // ProductsModule,
    // UploadModule,
    // CollectionsModule,
    RedisModule,
    // CartModule,
    // ReviewsModule,
    // WishlistModule,
    // AdminModule,
    // AnalyticsModule,
  ],
  providers: [
    // Global Guards
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: CustomThrottlerGuard,
    },

    // Global Interceptors
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TimeoutInterceptor,
    },

    // Global Filters
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },

    // Global Pipes
    {
      provide: APP_PIPE,
      useClass: CustomValidationPipe,
    },

    // AnalyticsService,
  ],
  // controllers: [AnalyticsController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(
        HelmetMiddleware,
        CorrelationIdMiddleware,
        RequestContextMiddleware,
        LoggingMiddleware,
        // CookieParserMiddleware,
      )
      .forRoutes('*');
  }
}
