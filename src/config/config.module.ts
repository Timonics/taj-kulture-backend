import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { validate } from './env/env.validation';
import { EnvironmentService } from './env/env.service';

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      validate,
      isGlobal: true,
      expandVariables: true, // Allow ${VAR} syntax in .env
      cache: true, // Cache the config
    }),
  ],
  providers: [
    {
      provide: EnvironmentService,
      useFactory: () => EnvironmentService.getInstance(), // Use singleton
    },
  ],
  exports: [EnvironmentService],
})
export class ConfigModule {}
