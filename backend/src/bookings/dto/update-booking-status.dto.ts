import { BookingStatus } from '@ghoomo/db';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateBookingStatusDto {
  @IsEnum(BookingStatus)
  status!: BookingStatus;

  @IsOptional()
  @IsString()
  cancellationReason?: string;
}
