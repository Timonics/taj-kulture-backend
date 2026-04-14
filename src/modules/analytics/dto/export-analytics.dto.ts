import { IsEnum, IsOptional, IsString, IsArray, IsDateString } from 'class-validator';

export enum ExportFormat {
  CSV = 'csv',
  EXCEL = 'excel',
  PDF = 'pdf',
}

export enum ExportType {
  SALES = 'sales',
  USERS = 'users',
  PRODUCTS = 'products',
  VENDORS = 'vendors',
  ORDERS = 'orders',
}

export class ExportAnalyticsDto {
  @IsEnum(ExportType)
  type: ExportType;

  @IsEnum(ExportFormat)
  format: ExportFormat = ExportFormat.CSV;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  columns?: string[];

  @IsOptional()
  @IsString()
  vendorId?: string;
}