import { User, Address, Follow, UserRole } from 'generated/prisma/client';

export interface IUser extends User {
  addresses?: Address[];
  followers?: Follow[];
  following?: Follow[];
}

export interface IUserWithCount extends IUser {
  _count?: {
    followers: number;
    following: number;
    reviews: number;
    orders: number;
  };
}

export interface IUserFilters {
  role?: UserRole;
  isVerified?: boolean;
  search?: string;
  createdAfter?: Date;
  createdBefore?: Date;
}

export interface IUserSearchParams {
  skip?: number;
  take?: number;
  cursor?: { id: string };
  where?: IUserFilters;
  orderBy?: { [key: string]: 'asc' | 'desc' };
}
