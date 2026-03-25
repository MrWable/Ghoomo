import { GuideVerificationStatus } from '@ghoomo/db';
import { IsEnum } from 'class-validator';

export class UpdateGuideVerificationDto {
  @IsEnum(GuideVerificationStatus)
  status!: GuideVerificationStatus;
}
