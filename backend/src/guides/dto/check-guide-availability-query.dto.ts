import { IsDateString } from 'class-validator';

export class CheckGuideAvailabilityQueryDto {
  @IsDateString()
  startAt!: string;

  @IsDateString()
  endAt!: string;
}
