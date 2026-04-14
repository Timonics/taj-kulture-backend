import { Global, Module } from '@nestjs/common';
import { LoggerService } from './logger.service';

/**
 * Global Logger Module
 *
 * Provide a centralized logging service that can be injected anywhere
 */
@Global()
@Module({
  providers: [LoggerService],
  exports: [LoggerService],
})
export class LoggerModule {}
