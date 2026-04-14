import { IsString, IsBoolean, IsOptional } from 'class-validator';

export class ModerateReviewDto {
  @IsBoolean()
  isApproved: boolean;

  @IsString()
  @IsOptional()
  moderationNote?: string;
}