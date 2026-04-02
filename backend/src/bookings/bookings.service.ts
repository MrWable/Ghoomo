import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BookingStatus,
  PaymentStatus,
  GuideVerificationStatus,
  Prisma,
  UserRole,
} from '@ghoomo/db';
import { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBookingReviewDto } from './dto/create-booking-review.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { CreateBookingPaymentOrderDto } from './dto/create-booking-payment-order.dto';
import { VerifyBookingPaymentDto } from './dto/verify-booking-payment.dto';
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

type RazorpayOrderResponse = {
  id: string;
  amount: number;
  currency: string;
  receipt?: string | null;
  status?: string;
};

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

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

  async createPaymentOrder(
    user: AuthenticatedUser,
    bookingId: string,
    _input: CreateBookingPaymentOrderDto,
  ) {
    void _input;
    const { keyId, keySecret } = this.getRazorpayCredentials();

    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        touristId: true,
        status: true,
        totalAmount: true,
        paymentStatus: true,
        startAt: true,
        endAt: true,
        travelDate: true,
        tourist: {
          select: {
            fullName: true,
            email: true,
            phone: true,
          },
        },
        guideProfile: {
          select: {
            city: true,
            user: {
              select: {
                fullName: true,
              },
            },
          },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found.');
    }

    if (booking.touristId !== user.id) {
      throw new BadRequestException('You can pay only for your own booking.');
    }

    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException(
        'Payment is available only after the guide confirms the booking.',
      );
    }

    if (!booking.totalAmount || booking.totalAmount <= 0) {
      throw new BadRequestException(
        'This booking does not have a payable amount yet.',
      );
    }

    if (booking.paymentStatus === PaymentStatus.PAID) {
      throw new BadRequestException('This booking has already been paid.');
    }

    const amount = booking.totalAmount * 100;
    const currency = 'INR';
    const receipt = `booking_${booking.id.slice(-18)}`.slice(0, 40);

    const order = await this.createRazorpayOrder(
      {
        amount,
        currency,
        receipt,
        notes: {
          bookingId: booking.id,
          touristId: booking.touristId,
          city: booking.guideProfile.city,
        },
      },
      keyId,
      keySecret,
    );

    const updatedBooking = await this.prisma.booking.update({
      where: { id: booking.id },
      data: {
        paymentStatus: PaymentStatus.ORDER_CREATED,
        paymentGateway: 'RAZORPAY',
        paymentOrderId: order.id,
        paymentCurrency: order.currency,
        paymentAmount: order.amount,
        paymentId: null,
        paymentSignature: null,
        paymentPaidAt: null,
      },
      include: bookingInclude,
    });

    const { startAt, endAt } = this.resolveBookingWindow(booking);

    return {
      item: {
        booking: this.serializeBooking(updatedBooking),
        payment: {
          provider: 'RAZORPAY',
          keyId,
          orderId: order.id,
          amount: order.amount,
          currency: order.currency,
          merchantName: 'Ghoomo',
          description: `${booking.guideProfile.user.fullName} in ${booking.guideProfile.city}`,
          bookingStartAt: startAt.toISOString(),
          bookingEndAt: endAt.toISOString(),
          prefill: {
            name: booking.tourist.fullName,
            email: booking.tourist.email,
            contact: booking.tourist.phone ?? null,
          },
        },
      },
    };
  }

  async verifyPayment(
    user: AuthenticatedUser,
    bookingId: string,
    input: VerifyBookingPaymentDto,
  ) {
    const { keySecret } = this.getRazorpayCredentials();

    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        touristId: true,
        status: true,
        totalAmount: true,
        paymentStatus: true,
        paymentOrderId: true,
        paymentPaidAt: true,
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found.');
    }

    if (booking.touristId !== user.id) {
      throw new BadRequestException(
        'You can verify payment only for your own booking.',
      );
    }

    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException(
        'Payment verification is allowed only for confirmed bookings.',
      );
    }

    if (!booking.paymentOrderId) {
      throw new BadRequestException(
        'Create a payment order for this booking before paying.',
      );
    }

    if (booking.paymentStatus === PaymentStatus.PAID) {
      const paidBooking = await this.prisma.booking.findUnique({
        where: { id: bookingId },
        include: bookingInclude,
      });

      if (!paidBooking) {
        throw new NotFoundException('Booking not found.');
      }

      return {
        item: this.serializeBooking(paidBooking),
      };
    }

    if (input.razorpayOrderId !== booking.paymentOrderId) {
      await this.prisma.booking.update({
        where: { id: booking.id },
        data: {
          paymentStatus: PaymentStatus.FAILED,
          paymentGateway: 'RAZORPAY',
        },
      });

      throw new BadRequestException(
        'Payment order does not match this booking.',
      );
    }

    const generatedSignature = createHmac('sha256', keySecret)
      .update(`${booking.paymentOrderId}|${input.razorpayPaymentId}`)
      .digest('hex');

    const expectedSignature = Buffer.from(generatedSignature);
    const receivedSignature = Buffer.from(input.razorpaySignature);
    const isSignatureValid =
      expectedSignature.length === receivedSignature.length &&
      timingSafeEqual(expectedSignature, receivedSignature);

    if (!isSignatureValid) {
      await this.prisma.booking.update({
        where: { id: booking.id },
        data: {
          paymentStatus: PaymentStatus.FAILED,
          paymentGateway: 'RAZORPAY',
          paymentId: input.razorpayPaymentId,
          paymentSignature: input.razorpaySignature,
        },
      });

      throw new BadRequestException('Payment signature verification failed.');
    }

    const updatedBooking = await this.prisma.booking.update({
      where: { id: booking.id },
      data: {
        paymentStatus: PaymentStatus.PAID,
        paymentGateway: 'RAZORPAY',
        paymentId: input.razorpayPaymentId,
        paymentSignature: input.razorpaySignature,
        paymentCurrency: 'INR',
        paymentAmount:
          booking.totalAmount != null ? booking.totalAmount * 100 : null,
        paymentPaidAt: booking.paymentPaidAt ?? new Date(),
      },
      include: bookingInclude,
    });

    return {
      item: this.serializeBooking(updatedBooking),
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
        totalAmount: true,
        paymentStatus: true,
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
      if (!booking.totalAmount || booking.totalAmount <= 0) {
        throw new BadRequestException(
          'Booking cannot be confirmed without a payable amount.',
        );
      }

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

    if (
      (input.status === BookingStatus.IN_PROGRESS ||
        input.status === BookingStatus.COMPLETED) &&
      booking.paymentStatus !== PaymentStatus.PAID
    ) {
      throw new BadRequestException(
        'Booking must be paid before the service can start or complete.',
      );
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

  private getRazorpayCredentials() {
    const keyId = this.configService.get<string>('RAZORPAY_KEY_ID')?.trim();
    const keySecret = this.configService
      .get<string>('RAZORPAY_KEY_SECRET')
      ?.trim();

    if (!keyId || !keySecret) {
      throw new BadRequestException('Payments are not configured yet.');
    }

    return { keyId, keySecret };
  }

  private async createRazorpayOrder(
    input: {
      amount: number;
      currency: string;
      receipt: string;
      notes?: Record<string, string>;
    },
    keyId: string,
    keySecret: string,
  ) {
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    const payload = (await response.json()) as
      | RazorpayOrderResponse
      | {
          error?: {
            description?: string;
          };
        };

    if (!response.ok) {
      throw new BadRequestException(
        payload && 'error' in payload && payload.error?.description
          ? payload.error.description
          : 'Unable to create a payment order right now.',
      );
    }

    return payload as RazorpayOrderResponse;
  }

  private serializeBooking(booking: BookingWithRelations) {
    const { startAt, endAt } = this.resolveBookingWindow(booking);

    return {
      id: booking.id,
      status: booking.status,
      message: booking.message,
      totalAmount: booking.totalAmount,
      paymentStatus: booking.paymentStatus,
      paymentGateway: booking.paymentGateway ?? null,
      paymentOrderId: booking.paymentOrderId ?? null,
      paymentId: booking.paymentId ?? null,
      paymentCurrency: booking.paymentCurrency ?? null,
      paymentAmount: booking.paymentAmount ?? null,
      paymentPaidAt: booking.paymentPaidAt?.toISOString() ?? null,
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
