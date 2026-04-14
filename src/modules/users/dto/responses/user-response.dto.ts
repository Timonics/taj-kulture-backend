import { Exclude, Expose } from 'class-transformer';
import { UserRole } from 'generated/prisma/client';

export class UserResponseDto {
  @Expose()
  id: string;

  @Expose()
  email: string;

  @Expose()
  username: string;

  @Expose()
  firstName?: string | null;

  @Expose()
  lastName?: string | null;

  @Expose()
  avatar?: string | null;

  @Expose()
  phone?: string | null;

  @Expose()
  bio?: string | null;

  @Expose()
  location?: string | null;

  @Expose()
  website?: string | null;

  @Expose()
  role: UserRole;

  @Expose()
  isEmailVerified: boolean;

  @Expose()
  followersCount: number;

  @Expose()
  followingCount: number;

  @Expose()
  reviewCount: number;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  @Expose()
  lastLogin?: Date | null;

  @Exclude()
  password?: string | null;

  @Exclude()
  refreshToken?: string | null;

  @Exclude()
  emailVerificationToken?: string | null;

  @Exclude()
  passwordResetToken?: string | null;

  constructor(user: any) {
    // Map Prisma user to DTO, converting null to undefined
    this.id = user.id;
    this.email = user.email;
    this.username = user.username;
    this.firstName = user.firstName ?? undefined;
    this.lastName = user.lastName ?? undefined;
    this.avatar = user.avatar ?? undefined;
    this.phone = user.phone ?? undefined;
    this.bio = user.bio ?? undefined;
    this.location = user.location ?? undefined;
    this.website = user.website ?? undefined;
    this.role = user.role;
    this.isEmailVerified = user.isEmailVerified;
    this.followersCount = user.followersCount;
    this.followingCount = user.followingCount;
    this.reviewCount = user.reviewCount;
    this.createdAt = user.createdAt;
    this.updatedAt = user.updatedAt;
    this.lastLogin = user.lastLogin ?? undefined;

    // Exclude sensitive fields
    this.password = user.password ?? undefined;
    this.refreshToken = user.refreshToken ?? undefined;
    this.emailVerificationToken = user.emailVerificationToken ?? undefined;
    this.passwordResetToken = user.passwordResetToken ?? undefined;
  }
}
