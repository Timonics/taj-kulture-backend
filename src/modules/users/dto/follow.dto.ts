import { IsUUID } from 'class-validator';
import { UserResponseDto } from './user-response.dto';

export class FollowDto {
  @IsUUID()
  userId: string;
}

export class FollowResponseDto {
  id: string;
  followerId: string;
  followingId: string;
  createdAt: Date;
  follower?: UserResponseDto;
  following?: UserResponseDto;
}