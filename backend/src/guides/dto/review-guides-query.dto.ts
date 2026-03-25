import { GuideVerificationStatus } from '@ghoomo/db';
import { IsEnum, IsOptional } from 'class-validator';

export class ReviewGuidesQueryDto {
  @IsOptional()
  @IsEnum(GuideVerificationStatus)
  status?: GuideVerificationStatus;
}
