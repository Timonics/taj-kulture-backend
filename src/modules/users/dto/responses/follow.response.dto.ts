import { IsObject, IsUUID } from 'class-validator';
import { UserResponseDto } from './user-response.dto';

export class FollowResponseDto {
  @IsUUID()
  id!: string;

  @IsUUID()
  followerId!: string;

  @IsUUID()
  followingId!: string;

  @IsUUID()
  createdAt!: Date;

  @IsObject()
  follower?: UserResponseDto;
  
  @IsObject()
  following?: UserResponseDto;
}
