import { PartialType } from '@nestjs/mapped-types';
import { ApplyVendorDto } from './apply-vendor.dto';

export class UpdateVendorDto extends PartialType(ApplyVendorDto) {}