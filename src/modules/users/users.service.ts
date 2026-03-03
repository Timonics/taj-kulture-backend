import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { EventBus } from '../../shared/events/event-bus.service';
import { USER_EVENTS } from '../../shared/events/event-types';
import { UserRole } from 'generated/prisma/client';
import {
  CreateUserDto,
  UpdateUserDto,
  UpdatePasswordDto,
  UserResponseDto,
  CreateAddressDto,
  UpdateAddressDto,
  FollowDto,
} from './dto';
import { IUserFilters, IUserSearchParams } from './interfaces/user.interface';
import * as bcrypt from 'bcrypt';
import {
  UserRegisteredPayload,
  UserVerifiedPayload,
} from 'src/shared/events/event-payloads.interface';
import { UserNotFoundException } from 'src/core/exceptions/user-not-found.exception';
import { InvalidCredentialsException } from 'src/core/exceptions/invalid-credientials.exception';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { addDays } from 'date-fns';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private eventBus: EventBus,
  ) {}

  // ========== BASIC CRUD ==========

  async create(createUserDto: CreateUserDto): Promise<UserResponseDto> {
    const { email, username, password, ...rest } = createUserDto;

    // Check if user exists
    await this.ensureUserNotExists(email, username);

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const verificationToken = this.jwtService.sign(
      { email, purpose: 'email-verification' },
      { secret: this.configService.get('JWT_SECRET'), expiresIn: '1d' },
    );

    const verificationExpires = addDays(new Date(), 1);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        emailVerificationToken: verificationToken,
        emailVerificationExpires: verificationExpires,
        ...rest,
      },
    });

    // Emit event
    this.eventBus.emit({
      name: USER_EVENTS.REGISTERED,
      payload: {
        userId: user.id,
        email: user.email,
        name: user.firstName || user.username,
        verificationToken: user.emailVerificationToken!,
        registrationMethod: 'email',
      },
    });

    return new UserResponseDto(user);
  }

  async findAll(params: IUserSearchParams = {}): Promise<{
    data: UserResponseDto[];
    meta: { total: number; skip: number; take: number };
  }> {
    const {
      skip = 0,
      take = 10,
      where = {},
      orderBy = { createdAt: 'desc' },
    } = params;

    // Build where clause
    const whereClause = this.buildWhereClause(where);

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where: whereClause,
        skip,
        take,
        orderBy,
        ...this.getUserSelectFields(),
      }),
      this.prisma.user.count({ where: whereClause }),
    ]);

    return {
      data: users.map((user) => new UserResponseDto(user)),
      meta: { total, skip, take },
    };
  }

  async findOne(id: string): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      ...this.getUserSelectFields(true), // Include relations
    });

    if (!user) {
      throw new UserNotFoundException(`User with ID ${id} not found`);
    }

    return new UserResponseDto(user);
  }

  async findByEmail(email: string): Promise<UserResponseDto | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      ...this.getUserSelectFields(),
    });

    return user ? new UserResponseDto(user) : null;
  }

  async findByUsername(username: string): Promise<UserResponseDto | null> {
    const user = await this.prisma.user.findUnique({
      where: { username },
      ...this.getUserSelectFields(),
    });

    return user ? new UserResponseDto(user) : null;
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    await this.ensureUserExists(id);

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: updateUserDto,
      ...this.getUserSelectFields(),
    });

    this.eventBus.emit({
      name: USER_EVENTS.PROFILE_UPDATED,
      payload: {
        userId: id,
        changes: updateUserDto,
      },
    });

    return new UserResponseDto(updatedUser);
  }

  async updatePassword(
    id: string,
    updatePasswordDto: UpdatePasswordDto,
  ): Promise<void> {
    const { currentPassword, newPassword, confirmPassword } = updatePasswordDto;

    if (newPassword !== confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, password: true },
    });

    if (!user) {
      throw new UserNotFoundException();
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password,
    );
    if (!isPasswordValid) {
      throw new InvalidCredentialsException('Current password is incorrect');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id },
      data: {
        password: hashedPassword,
        passwordChangedAt: new Date(),
        refreshToken: null, // Invalidate all sessions
      },
    });

    this.eventBus.emit({
      name: USER_EVENTS.PASSWORD_CHANGED,
      payload: {
        userId: id,
        changedAt: new Date(),
      },
    });
  }

  async remove(id: string): Promise<void> {
    await this.ensureUserExists(id);

    // Soft delete by archiving or deactivating
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        // You could add a deletedAt field
        // deletedAt: new Date(),
        // isActive: false,
      },
    });

    this.eventBus.emit({
      name: USER_EVENTS.DELETED,
      payload: {
        userId: id,
        email: user.email,
        deletedAt: new Date(),
      },
    });
  }

  // ========== ADDRESS MANAGEMENT ==========

  async getAddresses(userId: string) {
    await this.ensureUserExists(userId);

    return this.prisma.address.findMany({
      where: { userId },
      orderBy: [
        { isDefault: 'desc' },
        // { createdAt: 'desc' },
      ],
    });
  }

  async addAddress(userId: string, addressData: CreateAddressDto) {
    await this.ensureUserExists(userId);

    // If this is the first address or marked as default, update other addresses
    if (addressData.isDefault) {
      await this.prisma.address.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }

    const address = await this.prisma.address.create({
      data: {
        ...addressData,
        userId,
      },
    });

    return address;
  }

  async updateAddress(
    userId: string,
    addressId: string,
    addressData: UpdateAddressDto,
  ) {
    await this.ensureAddressBelongsToUser(userId, addressId);

    // Handle default address logic
    if (addressData.isDefault) {
      await this.prisma.address.updateMany({
        where: {
          userId,
          id: { not: addressId },
        },
        data: { isDefault: false },
      });
    }

    const updated = await this.prisma.address.update({
      where: { id: addressId },
      data: addressData,
    });

    return updated;
  }

  async removeAddress(userId: string, addressId: string) {
    await this.ensureAddressBelongsToUser(userId, addressId);

    await this.prisma.address.delete({
      where: { id: addressId },
    });

    return { success: true };
  }

  async setDefaultAddress(userId: string, addressId: string) {
    await this.ensureAddressBelongsToUser(userId, addressId);

    await this.prisma.$transaction([
      this.prisma.address.updateMany({
        where: { userId },
        data: { isDefault: false },
      }),
      this.prisma.address.update({
        where: { id: addressId },
        data: { isDefault: true },
      }),
    ]);

    return { success: true };
  }

  // ========== FOLLOW SYSTEM ==========

  async followUser(followerId: string, followDto: FollowDto) {
    const { userId: followingId } = followDto;

    if (followerId === followingId) {
      throw new BadRequestException('Cannot follow yourself');
    }

    await this.ensureUserExists(followingId);

    // Check if already following
    const existingFollow = await this.prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId,
        },
      },
    });

    if (existingFollow) {
      throw new ConflictException('Already following this user');
    }

    const follow = await this.prisma.follow.create({
      data: {
        followerId,
        followingId,
      },
      include: {
        follower: { select: this.getUserSelectFields().select },
        following: { select: this.getUserSelectFields().select },
      },
    });

    // Update counts
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: followerId },
        data: { followingCount: { increment: 1 } },
      }),
      this.prisma.user.update({
        where: { id: followingId },
        data: { followersCount: { increment: 1 } },
      }),
    ]);

    this.eventBus.emit({
      name: USER_EVENTS.FOLLOWED,
      payload: {
        followerId,
        followingId,
        followerName: follow.follower.username,
        followingName: follow.following.username,
        timestamp: new Date(),
      },
    });

    return follow;
  }

  async unfollowUser(followerId: string, followingId: string) {
    await this.ensureUserExists(followingId);

    await this.prisma.follow.delete({
      where: {
        followerId_followingId: {
          followerId,
          followingId,
        },
      },
    });

    // Update counts
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: followerId },
        data: { followingCount: { decrement: 1 } },
      }),
      this.prisma.user.update({
        where: { id: followingId },
        data: { followersCount: { decrement: 1 } },
      }),
    ]);

    this.eventBus.emit({
      name: USER_EVENTS.UNFOLLOWED,
      payload: {
        followerId,
        followingId,
        timestamp: new Date(),
      },
    });

    return { success: true };
  }

  async getFollowers(userId: string, skip = 0, take = 10) {
    await this.ensureUserExists(userId);

    const [followers, total] = await Promise.all([
      this.prisma.follow.findMany({
        where: { followingId: userId },
        include: {
          follower: {
            select: this.getUserSelectFields().select,
          },
        },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.follow.count({
        where: { followingId: userId },
      }),
    ]);

    return {
      data: followers.map((f) => new UserResponseDto(f.follower)),
      meta: { total, skip, take },
    };
  }

  async getFollowing(userId: string, skip = 0, take = 10) {
    await this.ensureUserExists(userId);

    const [following, total] = await Promise.all([
      this.prisma.follow.findMany({
        where: { followerId: userId },
        include: {
          following: {
            select: this.getUserSelectFields().select,
          },
        },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.follow.count({
        where: { followerId: userId },
      }),
    ]);

    return {
      data: following.map((f) => new UserResponseDto(f.following)),
      meta: { total, skip, take },
    };
  }

  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const follow = await this.prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId,
        },
      },
    });

    return !!follow;
  }

  // ========== STATS & DASHBOARD ==========

  async getUserStats(userId: string) {
    await this.ensureUserExists(userId);

    const [orders, reviews, followers, following, wishlist] = await Promise.all(
      [
        this.prisma.order.count({ where: { userId } }),
        this.prisma.review.count({ where: { userId } }),
        this.prisma.follow.count({ where: { followingId: userId } }),
        this.prisma.follow.count({ where: { followerId: userId } }),
        this.prisma.wishlistItem.count({ where: { userId } }),
      ],
    );

    return {
      orders,
      reviews,
      followers,
      following,
      wishlist,
    };
  }

  async getUserActivity(userId: string, limit = 10) {
    await this.ensureUserExists(userId);

    const [recentOrders, recentReviews] = await Promise.all([
      this.prisma.order.findMany({
        where: { userId },
        // orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          items: {
            take: 3,
            include: { product: true },
          },
        },
      }),
      this.prisma.review.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: { product: true },
      }),
    ]);

    return {
      recentOrders,
      recentReviews,
    };
  }

  // ========== ADMIN TOOLS ==========

  async verifyEmail(userId: string) {
    await this.ensureUserExists(userId);

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        isEmailVerified: true,
        emailVerificationToken: null,
      },
    });

    this.eventBus.emit({
      name: USER_EVENTS.VERIFIED,
      payload: {
        name: user.firstName,
        email: user.email,
        verifiedAt: new Date(),
      } as UserVerifiedPayload,
    });

    return { success: true };
  }

  async updateRole(userId: string, role: UserRole) {
    await this.ensureUserExists(userId);

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { role },
      ...this.getUserSelectFields(),
    });

    this.eventBus.emit({
      name: USER_EVENTS.ROLE_CHANGED,
      payload: {
        userId,
        newRole: role,
        oldRole: user.role,
        changedAt: new Date(),
      },
    });

    return new UserResponseDto(user);
  }

  async getDashboardStats() {
    const [totalUsers, activeToday, newThisWeek, byRole] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({
        where: {
          lastLogin: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      }),
      this.prisma.user.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
      this.prisma.user.groupBy({
        by: ['role'],
        _count: true,
      }),
    ]);

    return {
      totalUsers,
      activeToday,
      newThisWeek,
      byRole: byRole.reduce((acc, curr) => {
        acc[curr.role] = curr._count;
        return acc;
      }, {}),
    };
  }

  // ========== HELPER METHODS ==========

  private async ensureUserExists(id: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
  }

  private async ensureUserNotExists(
    email: string,
    username: string,
  ): Promise<void> {
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existingUser) {
      if (existingUser.email === email) {
        throw new ConflictException('Email already registered');
      }
      if (existingUser.username === username) {
        throw new ConflictException('Username already taken');
      }
    }
  }

  private async ensureAddressBelongsToUser(
    userId: string,
    addressId: string,
  ): Promise<void> {
    const address = await this.prisma.address.findFirst({
      where: {
        id: addressId,
        userId,
      },
    });

    if (!address) {
      throw new NotFoundException('Address not found');
    }
  }

  private buildWhereClause(filters: IUserFilters) {
    const where: any = {};

    if (filters.role) {
      where.role = filters.role;
    }

    if (filters.isVerified !== undefined) {
      where.isEmailVerified = filters.isVerified;
    }

    if (filters.search) {
      where.OR = [
        { email: { contains: filters.search, mode: 'insensitive' } },
        { username: { contains: filters.search, mode: 'insensitive' } },
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters.createdAfter || filters.createdBefore) {
      where.createdAt = {};
      if (filters.createdAfter) {
        where.createdAt.gte = filters.createdAfter;
      }
      if (filters.createdBefore) {
        where.createdAt.lte = filters.createdBefore;
      }
    }

    return where;
  }

  private getUserSelectFields(includeRelations = false) {
    // Base fields to select
    const baseSelect = {
      id: true,
      email: true,
      username: true,
      firstName: true,
      lastName: true,
      avatar: true,
      phone: true,
      bio: true,
      location: true,
      website: true,
      role: true,
      isEmailVerified: true,
      followersCount: true,
      followingCount: true,
      reviewCount: true,
      createdAt: true,
      updatedAt: true,
      lastLogin: true,
    };

    if (includeRelations) {
      // When including relations, we need to use select with nested selects
      return {
        select: {
          ...baseSelect,
          addresses: {
            select: {
              id: true,
              type: true,
              isDefault: true,
              firstName: true,
              lastName: true,
              company: true,
              addressLine1: true,
              addressLine2: true,
              city: true,
              state: true,
              postalCode: true,
              country: true,
              phone: true,
            },
          },
          vendor: {
            select: {
              id: true,
              name: true,
              slug: true,
              logo: true,
              banner: true,
              description: true,
              isVerified: true,
              rating: true,
            },
          },
        },
      };
    }

    // Without relations - just return the select object
    return {
      select: baseSelect,
    };
  }

  // For Auth service to use (needs password)
  async findOneWithPassword(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async updateRefreshToken(userId: string, refreshToken: string | null) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken },
    });
  }

  async updateLastLogin(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { lastLogin: new Date() },
    });
  }
}
