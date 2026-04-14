import { IsEnum, IsBoolean, IsString, IsOptional } from 'class-validator';
import { UserRole } from 'generated/prisma/client';

export class UserRoleUpdateDto {
  @IsEnum(UserRole)
  role: UserRole;
}

export class UserStatusUpdateDto {
  @IsBoolean()
  isActive: boolean;

  @IsString()
  @IsOptional()
  reason?: string;
}

export class UserSuspendDto {
  @IsBoolean()
  suspended: boolean;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsOptional()
  suspendedUntil?: Date;
}
