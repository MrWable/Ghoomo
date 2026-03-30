import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { UserRole } from '@ghoomo/db';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateBookingReviewDto } from './dto/create-booking-review.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';
import { BookingsService } from './bookings.service';
import type { AuthenticatedUser } from '../auth/auth.types';

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Roles(UserRole.TOURIST, UserRole.USER)
  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: CreateBookingDto,
  ) {
    return this.bookingsService.createBooking(user, input);
  }

  @Get('me')
  getMyBookings(@CurrentUser() user: AuthenticatedUser) {
    return this.bookingsService.getMyBookings(user);
  }

  @Roles(UserRole.TOURIST, UserRole.USER, UserRole.GUIDE, UserRole.ADMIN)
  @Patch(':id/status')
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') bookingId: string,
    @Body() input: UpdateBookingStatusDto,
  ) {
    return this.bookingsService.updateStatus(user, bookingId, input);
  }

  @Roles(UserRole.TOURIST, UserRole.USER)
  @Post(':id/review')
  createReview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') bookingId: string,
    @Body() input: CreateBookingReviewDto,
  ) {
    return this.bookingsService.createReview(user, bookingId, input);
  }
}
