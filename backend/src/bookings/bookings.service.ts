import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingStatus,
  GuideVerificationStatus,
  Prisma,
  UserRole,
} from '@ghoomo/db';
import { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBookingReviewDto } from './dto/create-booking-review.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';

const ACTIVE_BOOKING_STATUSES = [
  BookingStatus.CONFIRMED,
  BookingStatus.IN_PROGRESS,
];
const DEFAULT_LEGACY_BOOKING_DURATION_MS = 4 * 60 * 60 * 1000;

const TOURIST_ALLOWED_TRANSITIONS = {
  [BookingStatus.PENDING]: [BookingStatus.CANCELLED],
  [BookingStatus.CONFIRMED]: [BookingStatus.CANCELLED],
  [BookingStatus.REJECTED]: [],
  [BookingStatus.CANCELLED]: [],
  [BookingStatus.IN_PROGRESS]: [],
  [BookingStatus.COMPLETED]: [],
  [BookingStatus.NO_SHOW]: [],
} satisfies Record<BookingStatus, BookingStatus[]>;

const GUIDE_ALLOWED_TRANSITIONS = {
  [BookingStatus.PENDING]: [
    BookingStatus.CONFIRMED,
    BookingStatus.REJECTED,
    BookingStatus.CANCELLED,
  ],
  [BookingStatus.CONFIRMED]: [
    BookingStatus.IN_PROGRESS,
    BookingStatus.COMPLETED,
    BookingStatus.CANCELLED,
    BookingStatus.NO_SHOW,
  ],
  [BookingStatus.REJECTED]: [],
  [BookingStatus.CANCELLED]: [],
  [BookingStatus.IN_PROGRESS]: [
    BookingStatus.COMPLETED,
    BookingStatus.CANCELLED,
    BookingStatus.NO_SHOW,
  ],
  [BookingStatus.COMPLETED]: [],
  [BookingStatus.NO_SHOW]: [],
} satisfies Record<BookingStatus, BookingStatus[]>;

const ADMIN_ALLOWED_TRANSITIONS = GUIDE_ALLOWED_TRANSITIONS;

const bookingInclude = {
  tourist: {
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  },
  guideProfile: {
    select: {
      id: true,
      userId: true,
      city: true,
      hourlyRate: true,
      acceptingBookings: true,
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
    },
  },
  review: {
    select: {
      id: true,
      rating: true,
      comment: true,
      createdAt: true,
      updatedAt: true,
    },
  },
} satisfies Prisma.BookingInclude;

type BookingWithRelations = Prisma.BookingGetPayload<{
  include: typeof bookingInclude;
}>;

@Injectable()
export class BookingsService {
  constructor(private readonly prisma: PrismaService) {}

  async createBooking(user: AuthenticatedUser, input: CreateBookingDto) {
    const { startAt, endAt } = this.parseDateRange(input.startAt, input.endAt);

    if (startAt.getTime() < Date.now()) {
      throw new BadRequestException(
        'Bookings must be created for a future slot.',
      );
    }

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
        availabilityBlocks: {
          where: {
            startAt: {
              lt: endAt,
            },
            endAt: {
              gt: startAt,
            },
          },
          select: {
            id: true,
            reason: true,
          },
        },
      },
    });

    if (
      !guide ||
      !guide.isVerified ||
      guide.verificationStatus !== GuideVerificationStatus.APPROVED
    ) {
      throw new NotFoundException('Guide not found.');
    }

    if (guide.userId === user.id) {
      throw new BadRequestException('Guides cannot book themselves.');
    }

    if (!guide.acceptingBookings || !guide.isAvailable) {
      throw new BadRequestException(
        'Guide is not accepting bookings right now.',
      );
    }

    if (guide.availabilityBlocks.length > 0) {
      throw new BadRequestException(
        guide.availabilityBlocks[0]?.reason?.trim()
          ? `Guide is unavailable: ${guide.availabilityBlocks[0].reason.trim()}`
          : 'Guide is unavailable for the selected slot.',
      );
    }

    await this.assertNoActiveBookingConflict(guide.id, startAt, endAt);

    const booking = await this.prisma.booking.create({
      data: {
        touristId: user.id,
        guideProfileId: input.guideProfileId,
        travelDate: startAt,
        startAt,
        endAt,
        timezone: input.timezone?.trim() || null,
        guestCount: input.guestCount ?? 1,
        meetingPoint: input.meetingPoint?.trim() || null,
        message: input.message?.trim() || null,
        totalAmount: this.calculateQuotedAmount(
          guide.hourlyRate,
          startAt,
          endAt,
        ),
      },
      include: bookingInclude,
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
      orderBy: [{ travelDate: 'asc' }, { createdAt: 'desc' }],
      include: bookingInclude,
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
      select: {
        id: true,
        touristId: true,
        guideProfileId: true,
        travelDate: true,
        startAt: true,
        endAt: true,
        status: true,
        confirmedAt: true,
        cancelledAt: true,
        completedAt: true,
        guideProfile: {
          select: {
            id: true,
            userId: true,
            isVerified: true,
            isAvailable: true,
            acceptingBookings: true,
            verificationStatus: true,
          },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found.');
    }

    this.assertStatusTransition(user, booking, input.status);

    const now = new Date();

    if (input.status === BookingStatus.CONFIRMED) {
      const { startAt, endAt } = this.resolveBookingWindow(booking);

      const updatedBooking = await this.prisma.$transaction(async (tx) => {
        const guide = await tx.guideProfile.findUnique({
          where: { id: booking.guideProfileId },
          select: {
            id: true,
            isVerified: true,
            isAvailable: true,
            acceptingBookings: true,
            verificationStatus: true,
            availabilityBlocks: {
              where: {
                startAt: {
                  lt: endAt,
                },
                endAt: {
                  gt: startAt,
                },
              },
              select: {
                id: true,
                reason: true,
              },
            },
          },
        });

        if (
          !guide ||
          !guide.isVerified ||
          guide.verificationStatus !== GuideVerificationStatus.APPROVED
        ) {
          throw new BadRequestException('Guide is no longer bookable.');
        }

        if (!guide.acceptingBookings || !guide.isAvailable) {
          throw new BadRequestException(
            'Guide is not accepting bookings right now.',
          );
        }

        if (guide.availabilityBlocks.length > 0) {
          throw new BadRequestException(
            guide.availabilityBlocks[0]?.reason?.trim()
              ? `Guide is unavailable: ${guide.availabilityBlocks[0].reason.trim()}`
              : 'Guide is unavailable for the selected slot.',
          );
        }

        await this.assertNoActiveBookingConflict(
          guide.id,
          startAt,
          endAt,
          booking.id,
          tx,
        );

        return tx.booking.update({
          where: { id: bookingId },
          data: this.buildStatusUpdateData(booking, input, now),
          include: bookingInclude,
        });
      });

      return this.serializeBooking(updatedBooking);
    }

    const updatedBooking = await this.prisma.booking.update({
      where: { id: bookingId },
      data: this.buildStatusUpdateData(booking, input, now),
      include: bookingInclude,
    });

    return this.serializeBooking(updatedBooking);
  }

  async createReview(
    user: AuthenticatedUser,
    bookingId: string,
    input: CreateBookingReviewDto,
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        touristId: true,
        guideProfileId: true,
        status: true,
        review: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found.');
    }

    if (booking.touristId !== user.id) {
      throw new BadRequestException(
        'Only the tourist who booked the guide can add a review.',
      );
    }

    if (booking.status !== BookingStatus.COMPLETED) {
      throw new BadRequestException(
        'Reviews can only be added after the booking is completed.',
      );
    }

    if (booking.review) {
      throw new BadRequestException('This booking has already been reviewed.');
    }

    const review = await this.prisma.review.create({
      data: {
        touristId: user.id,
        guideProfileId: booking.guideProfileId,
        bookingId: booking.id,
        rating: input.rating,
        comment: input.comment?.trim() || null,
      },
      select: {
        id: true,
        bookingId: true,
        guideProfileId: true,
        touristId: true,
        rating: true,
        comment: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      item: {
        ...review,
        createdAt: review.createdAt.toISOString(),
        updatedAt: review.updatedAt.toISOString(),
      },
    };
  }

  private assertStatusTransition(
    user: AuthenticatedUser,
    booking: {
      touristId: string;
      status: BookingStatus;
      guideProfile: {
        userId: string;
      };
    },
    nextStatus: BookingStatus,
  ) {
    if (booking.status === nextStatus) {
      throw new BadRequestException(`Booking is already ${nextStatus}.`);
    }

    const isTouristOwner = booking.touristId === user.id;
    const isGuideOwner = booking.guideProfile.userId === user.id;

    if (
      (user.role === UserRole.TOURIST || user.role === UserRole.USER) &&
      !isTouristOwner
    ) {
      throw new BadRequestException(
        'Tourists can update only their own bookings.',
      );
    }

    if (user.role === UserRole.GUIDE && !isGuideOwner) {
      throw new BadRequestException(
        'Guides can update only their own bookings.',
      );
    }

    const allowedTransitions: BookingStatus[] =
      user.role === UserRole.ADMIN
        ? ADMIN_ALLOWED_TRANSITIONS[booking.status]
        : user.role === UserRole.GUIDE
          ? GUIDE_ALLOWED_TRANSITIONS[booking.status]
          : TOURIST_ALLOWED_TRANSITIONS[booking.status];

    if (!allowedTransitions.includes(nextStatus)) {
      throw new BadRequestException(
        `Cannot change booking status from ${booking.status} to ${nextStatus}.`,
      );
    }
  }

  private buildStatusUpdateData(
    booking: {
      confirmedAt: Date | null;
      cancelledAt: Date | null;
      completedAt: Date | null;
    },
    input: UpdateBookingStatusDto,
    now: Date,
  ): Prisma.BookingUpdateInput {
    return {
      status: input.status,
      cancellationReason:
        input.status === BookingStatus.CANCELLED
          ? input.cancellationReason?.trim() || null
          : null,
      confirmedAt:
        input.status === BookingStatus.CONFIRMED
          ? (booking.confirmedAt ?? now)
          : booking.confirmedAt,
      cancelledAt:
        input.status === BookingStatus.CANCELLED
          ? (booking.cancelledAt ?? now)
          : booking.cancelledAt,
      completedAt:
        input.status === BookingStatus.COMPLETED
          ? (booking.completedAt ?? now)
          : booking.completedAt,
    };
  }

  private async assertNoActiveBookingConflict(
    guideProfileId: string,
    startAt: Date,
    endAt: Date,
    excludedBookingId?: string,
    prisma: PrismaService | Prisma.TransactionClient = this.prisma,
  ) {
    const conflicts = await prisma.booking.count({
      where: {
        guideProfileId,
        ...(excludedBookingId
          ? {
              id: {
                not: excludedBookingId,
              },
            }
          : {}),
        status: {
          in: ACTIVE_BOOKING_STATUSES,
        },
        OR: [
          {
            startAt: {
              lt: endAt,
            },
            endAt: {
              gt: startAt,
            },
          },
          {
            startAt: null,
            endAt: null,
            travelDate: {
              gte: startAt,
              lt: endAt,
            },
          },
        ],
      },
    });

    if (conflicts > 0) {
      throw new BadRequestException(
        'Guide already has another booking in the selected time slot.',
      );
    }
  }

  private parseDateRange(startAtRaw: string, endAtRaw: string) {
    const startAt = new Date(startAtRaw);
    const endAt = new Date(endAtRaw);

    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
      throw new BadRequestException('Provide a valid booking time range.');
    }

    if (endAt <= startAt) {
      throw new BadRequestException(
        'Booking end time must be after start time.',
      );
    }

    return { startAt, endAt };
  }

  private resolveBookingWindow(booking: {
    travelDate: Date;
    startAt: Date | null;
    endAt: Date | null;
  }) {
    const startAt = booking.startAt ?? booking.travelDate;
    const endAt =
      booking.endAt ??
      new Date(startAt.getTime() + DEFAULT_LEGACY_BOOKING_DURATION_MS);

    return { startAt, endAt };
  }

  private calculateQuotedAmount(
    hourlyRate: number | null,
    startAt: Date,
    endAt: Date,
  ) {
    if (hourlyRate == null) {
      return null;
    }

    const durationHours = Math.max(
      1,
      Math.ceil((endAt.getTime() - startAt.getTime()) / (60 * 60 * 1000)),
    );

    return hourlyRate * durationHours;
  }

  private serializeBooking(booking: BookingWithRelations) {
    const { startAt, endAt } = this.resolveBookingWindow(booking);

    return {
      id: booking.id,
      status: booking.status,
      message: booking.message,
      totalAmount: booking.totalAmount,
      travelDate: booking.travelDate.toISOString(),
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      timezone: booking.timezone ?? null,
      guestCount: booking.guestCount,
      meetingPoint: booking.meetingPoint ?? null,
      cancellationReason: booking.cancellationReason ?? null,
      confirmedAt: booking.confirmedAt?.toISOString() ?? null,
      cancelledAt: booking.cancelledAt?.toISOString() ?? null,
      completedAt: booking.completedAt?.toISOString() ?? null,
      createdAt: booking.createdAt.toISOString(),
      tourist: booking.tourist,
      guide: {
        guideProfileId: booking.guideProfile.id,
        userId: booking.guideProfile.user.id,
        city: booking.guideProfile.city,
        hourlyRate: booking.guideProfile.hourlyRate,
        acceptingBookings: booking.guideProfile.acceptingBookings,
        fullName: booking.guideProfile.user.fullName,
        email: booking.guideProfile.user.email,
      },
      review: booking.review
        ? {
            id: booking.review.id,
            rating: booking.review.rating,
            comment: booking.review.comment ?? null,
            createdAt: booking.review.createdAt.toISOString(),
            updatedAt: booking.review.updatedAt.toISOString(),
          }
        : null,
    };
  }
}
