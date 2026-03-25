import { BookingStatus } from '@ghoomo/db';
import { IsEnum } from 'class-validator';

export class UpdateBookingStatusDto {
  @IsEnum(BookingStatus)
  status!: BookingStatus;
}
