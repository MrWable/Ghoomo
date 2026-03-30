import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateGuideAvailabilityBlockDto {
  @IsDateString()
  startAt!: string;

  @IsDateString()
  endAt!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
