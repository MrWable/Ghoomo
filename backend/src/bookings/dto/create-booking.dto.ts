import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateBookingDto {
  @IsString()
  guideProfileId!: string;

  @IsDateString()
  travelDate!: string;

  @IsOptional()
  @IsString()
  message?: string;
}
