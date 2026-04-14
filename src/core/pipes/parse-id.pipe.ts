import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { isCuid } from '@paralleldrive/cuid2';

/**
 * PARSE ID PIPE
 *
 * Validates that an ID is a valid CUID format.
 *
 * WHY CUID:
 * - Better for distributed systems than auto-increment integers
 * - URL-safe
 * - Sortable
 * - No collisions across servers
 *
 * @example
 * @Get(':id')
 * async getOne(@Param('id', ParseIdPipe) id: string) {
 *   // id is guaranteed to be a valid CUID
 * }
 */
@Injectable()
export class ParseIdPipe implements PipeTransform<string> {
  transform(value: string): string {
    if (!value) {
      throw new BadRequestException('ID cannot be empty');
    }

    if (!isCuid(value)) {
      throw new BadRequestException('Invalid ID format. Must be a valid CUID.');
    }

    return value;
  }
}
