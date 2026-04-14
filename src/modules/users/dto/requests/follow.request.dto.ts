import { IsString } from 'class-validator';

export class FollowRequestDto {
  @IsString()
  userId!: string;
}