import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { validate } from './config/env.validation';
import { EmailModule } from './shared/email/email.module';
import { EventsModule } from './shared/events/events.module';
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
import { ValidationExceptionFilter } from './core/filters/validation-exception.filter';
import { LoggingInterceptor } from './core/interceptors/logging.interceptor';
import { TimeoutInterceptor } from './core/interceptors/timeout.interceptor';
import { TransformInterceptor } from './core/interceptors/transform.interceptor';
import { CustomValidationPipe } from './core/pipes/validation.pipe';
import { LoggingMiddleware } from './core/middleware/logging.middleware';
import { HelmetMiddleware } from './core/middleware/helmet.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      validate,
      isGlobal: true,
    }),
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
    AuthModule,
    UsersModule,
    DatabaseModule,
    CategoriesModule,
    VendorsModule,
    ProductsModule,
    UploadModule,
    CollectionsModule,
  ],
  providers: [
    // Global Guards
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
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },

    // Global Filters
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_FILTER,
      useClass: ValidationExceptionFilter,
    },

    // Global Pipes
    {
      provide: APP_PIPE,
      useClass: CustomValidationPipe,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(
        HelmetMiddleware,
        CorrelationIdMiddleware,
        LoggingMiddleware,
      )
      .forRoutes('*');
  }
}
