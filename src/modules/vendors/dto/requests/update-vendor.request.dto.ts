/**
 * UPDATE VENDOR REQUEST DTO
 *
 * Partial update of vendor profile.
 */

import { PartialType } from '@nestjs/mapped-types';
import { ApplyVendorRequestDto } from './apply-vendor.request.dto';

export class UpdateVendorRequestDto extends PartialType(ApplyVendorRequestDto) {}