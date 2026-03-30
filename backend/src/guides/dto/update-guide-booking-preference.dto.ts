import { IsBoolean } from 'class-validator';

export class UpdateGuideBookingPreferenceDto {
  @IsBoolean()
  acceptingBookings!: boolean;
}
