import { PartialType } from '@nestjs/mapped-types';
import { IsString, IsBoolean, IsOptional, IsPostalCode, IsPhoneNumber } from 'class-validator';

export class CreateAddressDto {
  @IsString()
  type: string; // 'shipping', 'billing'

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsString()
  @IsOptional()
  company?: string;

  @IsString()
  addressLine1: string;

  @IsString()
  @IsOptional()
  addressLine2?: string;

  @IsString()
  city: string;

  @IsString()
  state: string;

  @IsPostalCode()
  postalCode: string;

  @IsString()
  country: string;

  @IsPhoneNumber()
  @IsOptional()
  phone?: string;
}

export class UpdateAddressDto extends PartialType(CreateAddressDto) {}