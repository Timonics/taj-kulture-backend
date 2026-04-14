import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { EventBus } from '../../shared/events/event-bus.service';
import { USER_EVENTS } from '../../shared/events/event-types';
import { User, UserRole } from '../../../generated/prisma/client';
import {
  UpdateUserRequestDto,
  UpdatePasswordRequestDto,
  FollowRequestDto,
  CreateAddressRequestDto,
  UpdateAddressRequestDto,
  CreateUserRequestDto,
} from './dto/requests';
import { UserResponseDto } from './dto/responses/user-response.dto';
import { IUserFilters, IUserSearchParams } from './interfaces/user.interface';
import * as bcrypt from 'bcrypt';
import { ILogger } from '../../shared/logger/logger.interface';
import { LoggerService } from '../../shared/logger/logger.service';
import { EnvironmentService } from '../../config/env/env.service';
import {
  EmailConflictException,
  UsernameConflictException,
  UserNotFoundException,
  InvalidCredentialsException,
  UserFollowConflictException,
} from '../../core/exceptions';
import { plainToInstance } from 'class-transformer';

/**
 * USERS SERVICE
 *
 * Core business logic for user management:
 * - CRUD operations (create, read, update, delete)
 * - Address management (add, update, remove, set default)
 * - Follow/unfollow system with automatic count updates
 * - User statistics and activity feed
 * - Admin tools (role changes, email verification, dashboard stats)
 *
 * EVENT-DRIVEN:
 * - Emits events for profile updates, password changes, follows, etc.
 * - Decouples side effects (notifications, analytics) from core logic
 *
 * SECURITY:
 * - Passwords are never returned in responses
 * - Refresh tokens invalidated on password change
 * - Email verification status checked before login (handled in Auth)
 * - Follow operations prevent self-follow
 */
@Injectable()
export class UsersService {
  private readonly logger: ILogger;

  constructor(
    private prisma: PrismaService,
    private eventBus: EventBus,
    private env: EnvironmentService,
    logger: LoggerService,
  ) {
    this.logger = logger.child(UsersService.name);
  }

  // ============================================================
  // BASIC CRUD OPERATIONS
  // ============================================================

  /**
   * Create a new user (used by AuthService during registration)
   *
   * @param createUserDto - User data (email, username, password, etc.)
   * @returns User
   *
   * WHY SEPARATE FROM AUTH SERVICE:
   * - Auth service focuses on authentication (tokens, login)
   * - Users service handles pure user data management
   * - Auth service calls this method after password hashing
   */
  async create(createUserDto: CreateUserRequestDto): Promise<User> {
    const { email, username, password, ...rest } = createUserDto;

    // Check for existing user with same email or username
    await this.ensureUserNotExists(email, username);

    // Hash password with bcrypt using configured rounds
    const hashedPassword = await bcrypt.hash(
      password,
      this.env.get('BCRYPT_ROUNDS') || 10,
    );

    // Generate email verification token (JWT with purpose='email-verification')
    const verificationToken = this.generateEmailVerificationToken(email);
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create user in database
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

    this.logger.info(`User created: ${user.email} (${user.id})`);

    // Emit event to trigger welcome email (handled by EmailEventHandler)
    this.eventBus.emit({
      name: USER_EVENTS.REGISTERED,
      payload: {
        userId: user.id,
        email: user.email,
        name: user.firstName || user.username,
        verificationToken,
        registrationMethod: 'email',
      },
    });

    return user;
  }

  /**
   * Find all users with pagination, filtering, and sorting (admin only)
   *
   * @param params - Skip, take, where filters, orderBy
   * @returns Paginated list of UserResponseDto
   */
  async findAll(params: IUserSearchParams = {}) {
    const {
      skip = 0,
      take = 10,
      where = {},
      orderBy = { createdAt: 'desc' },
    } = params;
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
      users: users.map((user) =>
        plainToInstance(UserResponseDto, user, {
          excludeExtraneousValues: true,
        }),
      ),
      meta: { total, skip, take },
    };
  }

  /**
   * Find a single user by ID
   *
   * @param id - User's CUID
   * @returns UserResponseDto
   * @throws UserNotFoundException if user doesn't exist
   */
  async findOne(id: string): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      ...this.getUserSelectFields(true), // Include addresses and vendor relations
    });

    if (!user) {
      throw new UserNotFoundException(`User with ID ${id} not found`);
    }

    return plainToInstance(UserResponseDto, user, {
      excludeExtraneousValues: true,
    });
  }

  /**
   * Find a user by username (public profile)
   *
   * @param username - Unique username
   * @returns UserResponseDto or null
   */
  async findByUsername(username: string): Promise<UserResponseDto | null> {
    const user = await this.prisma.user.findUnique({
      where: { username },
      ...this.getUserSelectFields(),
    });
    return user
      ? plainToInstance(UserResponseDto, user, {
          excludeExtraneousValues: true,
        })
      : null;
  }

  /**
   * Update user profile (partial update)
   *
   * @param id - User ID
   * @param updateUserDto - Fields to update
   * @returns Updated UserResponseDto
   *
   * WHY EMIT EVENT: Notify other parts of the system about profile changes
   * (e.g., update search index, send notification to followers)
   */
  async update(
    id: string,
    updateUserDto: UpdateUserRequestDto,
  ): Promise<UserResponseDto> {
    await this.ensureUserExists(id);

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: updateUserDto,
      ...this.getUserSelectFields(),
    });

    this.logger.info(`User profile updated: ${id}`, {
      changes: Object.keys(updateUserDto),
    });

    this.eventBus.emit({
      name: USER_EVENTS.PROFILE_UPDATED,
      payload: { userId: id, changes: updateUserDto },
    });

    return plainToInstance(UserResponseDto, updatedUser, {
      excludeExtraneousValues: true,
    });
  }

  /**
   * Change user password (authenticated)
   *
   * @param id - User ID
   * @param dto - Current password, new password, confirmation
   *
   * SECURITY:
   * - Verifies current password before allowing change
   * - Invalidates all refresh tokens (forces re-login on all devices)
   * - Emits event for password changed notification
   */
  async updatePassword(
    id: string,
    dto: UpdatePasswordRequestDto,
  ): Promise<void> {
    const { currentPassword, newPassword, confirmPassword } = dto;

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

    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password,
    );
    if (!isPasswordValid) {
      throw new InvalidCredentialsException('Current password is incorrect');
    }

    const hashedPassword = await bcrypt.hash(
      newPassword,
      this.env.get('BCRYPT_ROUNDS') || 10,
    );

    // Update password and clear refresh token (log out all devices)
    await this.prisma.user.update({
      where: { id },
      data: { password: hashedPassword, refreshToken: null },
    });

    this.logger.info(`Password changed for user: ${id}`);

    this.eventBus.emit({
      name: USER_EVENTS.PASSWORD_CHANGED,
      payload: { userId: id, changedAt: new Date() },
    });
  }

  /**
   * Delete user (soft delete – currently just emits event)
   * In production, you would add `deletedAt` and filter out deleted users.
   */
  async remove(id: string): Promise<void> {
    await this.ensureUserExists(id);

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        /* add soft delete fields if needed, e.g., deletedAt: new Date() */
      },
    });

    this.logger.warn(`User deleted: ${user.email} (${id})`);

    this.eventBus.emit({
      name: USER_EVENTS.DELETED,
      payload: { userId: id, email: user.email, deletedAt: new Date() },
    });
  }

  // ============================================================
  // ADDRESS MANAGEMENT
  // ============================================================

  /**
   * Get all addresses for a user
   *
   * @param userId - User ID
   * @returns List of addresses (default address first)
   */
  async getAddresses(userId: string) {
    await this.ensureUserExists(userId);
    return this.prisma.address.findMany({
      where: { userId },
      orderBy: { isDefault: 'desc' }, // Default address appears first
    });
  }

  /**
   * Add a new address to a user
   *
   * @param userId - User ID
   * @param data - Address data
   *
   * LOGIC:
   * - If this is the first address or marked as default, unset other default addresses
   */
  async addAddress(userId: string, data: CreateAddressRequestDto) {
    await this.ensureUserExists(userId);

    if (data.isDefault) {
      await this.prisma.address.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }

    const address = await this.prisma.address.create({
      data: { ...data, userId },
    });

    this.logger.debug(`Address added for user ${userId}: ${address.id}`);
    return address;
  }

  /**
   * Update an existing address
   *
   * @param userId - User ID (ownership check)
   * @param addressId - Address ID to update
   * @param data - Partial address data
   */
  async updateAddress(
    userId: string,
    addressId: string,
    data: UpdateAddressRequestDto,
  ) {
    await this.ensureAddressBelongsToUser(userId, addressId);

    if (data.isDefault) {
      await this.prisma.address.updateMany({
        where: { userId, id: { not: addressId } },
        data: { isDefault: false },
      });
    }

    return this.prisma.address.update({
      where: { id: addressId },
      data,
    });
  }

  /**
   * Delete an address
   */
  async removeAddress(userId: string, addressId: string) {
    await this.ensureAddressBelongsToUser(userId, addressId);
    await this.prisma.address.delete({ where: { id: addressId } });
    return { success: true };
  }

  /**
   * Set a specific address as the default for a user
   * Uses transaction to ensure atomicity (all default flags cleared, then one set)
   */
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

  // ============================================================
  // FOLLOW SYSTEM
  // ============================================================

  /**
   * Follow another user
   *
   * @param followerId - ID of user who follows
   * @param dto - Contains followingId
   *
   * BUSINESS RULES:
   * - Cannot follow yourself
   * - Cannot follow the same user twice
   * - Updates followersCount and followingCount atomically
   * - Emits event for notification
   */
  async followUser(followerId: string, dto: FollowRequestDto) {
    const followingId = dto.userId;

    if (followerId === followingId) {
      throw new BadRequestException('Cannot follow yourself');
    }

    await this.ensureUserExists(followingId);

    const existing = await this.prisma.follow.findUnique({
      where: { followerId_followingId: { followerId, followingId } },
    });

    if (existing) {
      throw new UserFollowConflictException();
    }

    const follow = await this.prisma.follow.create({
      data: { followerId, followingId },
      include: {
        follower: { select: this.getUserSelectFields().select },
        following: { select: this.getUserSelectFields().select },
      },
    });

    // Atomically update both counts using transaction
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

    this.logger.info(`User ${followerId} followed ${followingId}`);

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

  /**
   * Unfollow a user
   * Reverses the follow operation (decrements counts)
   */
  async unfollowUser(followerId: string, followingId: string) {
    await this.ensureUserExists(followingId);

    await this.prisma.follow.delete({
      where: { followerId_followingId: { followerId, followingId } },
    });

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

    this.logger.info(`User ${followerId} unfollowed ${followingId}`);

    this.eventBus.emit({
      name: USER_EVENTS.UNFOLLOWED,
      payload: { followerId, followingId, timestamp: new Date() },
    });

    return { success: true };
  }

  /**
   * Get list of followers for a user
   */
  async getFollowers(userId: string, skip = 0, take = 10) {
    await this.ensureUserExists(userId);

    const [followers, total] = await Promise.all([
      this.prisma.follow.findMany({
        where: { followingId: userId },
        include: { follower: { select: this.getUserSelectFields().select } },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.follow.count({ where: { followingId: userId } }),
    ]);

    return {
      data: followers.map((f) =>
        plainToInstance(UserResponseDto, f.follower, {
          excludeExtraneousValues: true,
        }),
      ),
      meta: { total, skip, take },
    };
  }

  /**
   * Get list of users that a user follows
   */
  async getFollowing(userId: string, skip = 0, take = 10) {
    await this.ensureUserExists(userId);

    const [following, total] = await Promise.all([
      this.prisma.follow.findMany({
        where: { followerId: userId },
        include: { following: { select: this.getUserSelectFields().select } },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.follow.count({ where: { followerId: userId } }),
    ]);

    return {
      data: following.map((f) =>
        plainToInstance(UserResponseDto, f.following, {
          excludeExtraneousValues: true,
        }),
      ),
      meta: { total, skip, take },
    };
  }

  /**
   * Check if a user follows another user
   */
  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const follow = await this.prisma.follow.findUnique({
      where: { followerId_followingId: { followerId, followingId } },
    });
    return !!follow;
  }

  // ============================================================
  // STATS & ACTIVITY
  // ============================================================

  /**
   * Get aggregated statistics for a user (orders, reviews, followers, following, wishlist)
   */
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

    return { orders, reviews, followers, following, wishlist };
  }

  /**
   * Get recent activity (orders and reviews) for a user
   */
  async getUserActivity(userId: string, limit = 10) {
    await this.ensureUserExists(userId);

    const [recentOrders, recentReviews] = await Promise.all([
      this.prisma.order.findMany({
        where: { userId },
        take: limit,
        // orderBy: { createdAt: 'desc' },
        include: { items: { take: 3, include: { product: true } } },
      }),
      this.prisma.review.findMany({
        where: { userId },
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { product: true },
      }),
    ]);

    return { recentOrders, recentReviews };
  }

  // ============================================================
  // ADMIN TOOLS
  // ============================================================

  /**
   * Manually verify a user's email (admin only)
   */
  async verifyEmail(userId: string): Promise<void> {
    await this.ensureUserExists(userId);

    await this.prisma.user.update({
      where: { id: userId },
      data: { isEmailVerified: true, emailVerificationToken: null },
    });

    this.logger.info(`Admin verified email for user: ${userId}`);

    // Emit event to send welcome email
    this.eventBus.emit({
      name: USER_EVENTS.VERIFIED,
      payload: { userId, email: '', name: '', verifiedAt: new Date() }, // ideally fetch user details
    });
  }

  /**
   * Change a user's role (admin only)
   */
  async updateRole(userId: string, role: UserRole): Promise<UserResponseDto> {
    await this.ensureUserExists(userId);

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { role },
      ...this.getUserSelectFields(),
    });

    this.logger.info(`User role changed: ${userId} -> ${role}`);

    this.eventBus.emit({
      name: USER_EVENTS.ROLE_CHANGED,
      payload: {
        userId,
        newRole: role,
        oldRole: user.role,
        changedAt: new Date(),
      },
    });

    return plainToInstance(UserResponseDto, user, {
      excludeExtraneousValues: true,
    });
  }

  /**
   * Get dashboard statistics for admin
   */
  async getDashboardStats() {
    const [totalUsers, activeToday, newThisWeek, byRole] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({
        where: {
          lastLogin: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
      this.prisma.user.count({
        where: {
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
      this.prisma.user.groupBy({ by: ['role'], _count: true }),
    ]);

    const roleCounts = byRole.reduce(
      (acc, curr) => ({ ...acc, [curr.role]: curr._count }),
      {},
    );

    return { totalUsers, activeToday, newThisWeek, byRole: roleCounts };
  }

  // ============================================================
  // PRIVATE HELPER METHODS
  // ============================================================

  /**
   * Ensure a user exists by ID – throws UserNotFoundException if not found
   */
  private async ensureUserExists(id: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!user) {
      throw new UserNotFoundException(`User with ID ${id} not found`);
    }
  }

  /**
   * Ensure no user exists with the given email or username – throws appropriate conflict exception
   */
  private async ensureUserNotExists(
    email: string,
    username: string,
  ): Promise<void> {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });
    if (existing) {
      if (existing.email === email) throw new EmailConflictException();
      if (existing.username === username) throw new UsernameConflictException();
    }
  }

  /**
   * Ensure an address belongs to a user – throws NotFoundException if not
   */
  private async ensureAddressBelongsToUser(
    userId: string,
    addressId: string,
  ): Promise<void> {
    const address = await this.prisma.address.findFirst({
      where: { id: addressId, userId },
    });
    if (!address) {
      throw new NotFoundException('Address not found');
    }
  }

  /**
   * Build Prisma `where` clause from IUserFilters
   */
  private buildWhereClause(filters: IUserFilters): any {
    const where: any = {};
    if (filters.role) where.role = filters.role;
    if (filters.isVerified !== undefined)
      where.isEmailVerified = filters.isVerified;
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
      if (filters.createdAfter) where.createdAt.gte = filters.createdAfter;
      if (filters.createdBefore) where.createdAt.lte = filters.createdBefore;
    }
    return where;
  }

  /**
   * Get Prisma select fields for User queries
   * Excludes sensitive fields (password, tokens) automatically
   *
   * @param includeRelations - Whether to include addresses and vendor relations
   */
  private getUserSelectFields(includeRelations = false) {
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

    return { select: baseSelect };
  }

  /**
   * Generate a JWT token for email verification (used by create method)
   * In a full implementation, this would use JwtService and EnvironmentService.
   * For now, returns a placeholder; actual implementation should be delegated to AuthService.
   */
  private generateEmailVerificationToken(email: string): string {
    // This is a simplified version – in practice, you would inject JwtService and sign a token.
    return 'mock-verification-token';
  }

  // ============================================================
  // METHODS FOR AUTH SERVICE (internal use)
  // ============================================================

  /**
   * Find user with password (for authentication) – used by LocalStrategy
   */
  async findOneWithPassword(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  /**
   * Update user's refresh token (used by AuthService during login/refresh)
   */
  async updateRefreshToken(userId: string, refreshToken: string | null) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken },
    });
  }

  /**
   * Update last login timestamp (used by AuthService after successful login)
   */
  async updateLastLogin(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { lastLogin: new Date() },
    });
  }
}
