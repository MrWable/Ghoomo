import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, UserRole } from '@ghoomo/db';
import { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';

@Injectable()
export class BookingsService {
  constructor(private readonly prisma: PrismaService) {}

  async createBooking(user: AuthenticatedUser, input: CreateBookingDto) {
    const guide = await this.prisma.guideProfile.findUnique({
      where: { id: input.guideProfileId },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    if (!guide || !guide.isVerified) {
      throw new NotFoundException('Guide not found.');
    }

    if (!guide.isAvailable) {
      throw new BadRequestException('Guide is currently unavailable.');
    }

    const booking = await this.prisma.booking.create({
      data: {
        touristId: user.id,
        guideProfileId: input.guideProfileId,
        travelDate: new Date(input.travelDate),
        message: input.message,
        totalAmount: guide.hourlyRate ?? null,
      },
      include: {
        tourist: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        guideProfile: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    return this.serializeBooking(booking);
  }

  async getMyBookings(user: AuthenticatedUser) {
    const where =
      user.role === UserRole.TOURIST || user.role === UserRole.USER
        ? { touristId: user.id }
        : user.role === UserRole.GUIDE
          ? { guideProfile: { is: { userId: user.id } } }
          : {};

    const bookings = await this.prisma.booking.findMany({
      where,
      orderBy: {
        travelDate: 'asc',
      },
      include: {
        tourist: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        guideProfile: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    return {
      items: bookings.map((booking) => this.serializeBooking(booking)),
    };
  }

  async updateStatus(
    user: AuthenticatedUser,
    bookingId: string,
    input: UpdateBookingStatusDto,
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        guideProfile: true,
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found.');
    }

    if (
      user.role === UserRole.GUIDE &&
      booking.guideProfile.userId !== user.id
    ) {
      throw new BadRequestException(
        'Guides can update only their own bookings.',
      );
    }

    const updatedBooking = await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: input.status,
      },
      include: {
        tourist: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        guideProfile: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    return this.serializeBooking(updatedBooking);
  }

  private serializeBooking(booking: {
    id: string;
    status: BookingStatus;
    message: string | null;
    totalAmount: number | null;
    travelDate: Date;
    createdAt: Date;
    tourist: { id: string; fullName: string; email: string };
    guideProfile: {
      id: string;
      city: string;
      hourlyRate: number | null;
      user: { id: string; fullName: string; email: string };
    };
  }) {
    return {
      id: booking.id,
      status: booking.status,
      message: booking.message,
      totalAmount: booking.totalAmount,
      travelDate: booking.travelDate.toISOString(),
      createdAt: booking.createdAt.toISOString(),
      tourist: booking.tourist,
      guide: {
        guideProfileId: booking.guideProfile.id,
        userId: booking.guideProfile.user.id,
        city: booking.guideProfile.city,
        hourlyRate: booking.guideProfile.hourlyRate,
        fullName: booking.guideProfile.user.fullName,
        email: booking.guideProfile.user.email,
      },
    };
  }
}
