import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, GuideVerificationStatus } from '@ghoomo/db';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGuideAvailabilityBlockDto } from './dto/create-guide-availability-block.dto';
import { UpdateMyGuideDto } from './dto/update-my-guide.dto';

const ACTIVE_BOOKING_STATUSES = [
  BookingStatus.CONFIRMED,
  BookingStatus.IN_PROGRESS,
];
type AvailabilityBlockRecord = {
  id: string;
  startAt: Date;
  endAt: Date;
  reason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class GuidesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(city?: string) {
    const guides = await this.prisma.guideProfile.findMany({
      where: {
        verificationStatus: GuideVerificationStatus.APPROVED,
        ...(city
          ? {
              city: {
                contains: city,
                mode: 'insensitive',
              },
            }
          : {}),
      },
      orderBy: [{ isAvailable: 'desc' }, { createdAt: 'desc' }],
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          },
        },
        reviews: {
          select: {
            rating: true,
          },
        },
      },
    });

    return {
      items: guides.map((guide) => this.serializeGuide(guide)),
    };
  }

  async findForLoggedInCity(city?: string) {
    const normalizedCity = city?.trim();

    if (!normalizedCity) {
      throw new BadRequestException('City is required.');
    }

    return this.findAll(normalizedCity);
  }

  async findForReview(status: GuideVerificationStatus) {
    const guides = await this.prisma.guideProfile.findMany({
      where: {
        verificationStatus: status,
      },
      orderBy: [{ createdAt: 'asc' }],
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        reviews: {
          select: {
            rating: true,
          },
        },
      },
    });

    return {
      items: guides.map((guide) => this.serializeGuideForAdmin(guide)),
    };
  }

  async findMine(userId: string) {
    const guide = await this.prisma.guideProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        reviews: {
          select: {
            rating: true,
            comment: true,
            createdAt: true,
          },
        },
        availabilityBlocks: {
          orderBy: {
            startAt: 'asc',
          },
        },
      },
    });

    if (!guide) {
      throw new NotFoundException('Guide profile not found.');
    }

    return {
      item: this.serializeGuideWithProfileImage(guide),
    };
  }

  async updateMine(userId: string, input: UpdateMyGuideDto) {
    const guide = await this.prisma.guideProfile.findUnique({
      where: { userId },
    });

    if (!guide) {
      throw new NotFoundException('Guide profile not found.');
    }

    const city = input.city.trim();
    if (!city) {
      throw new BadRequestException('City is required.');
    }

    const matchedCity = await this.prisma.city.findFirst({
      where: {
        name: {
          equals: city,
          mode: 'insensitive',
        },
      },
    });

    if (!matchedCity) {
      throw new BadRequestException('Select a configured city.');
    }

    const languages = input.languages
      .map((language) => language.trim())
      .filter(Boolean);
    const specialties = input.specialties
      .map((specialty) => specialty.trim())
      .filter(Boolean);

    if (!languages.length) {
      throw new BadRequestException('Add at least one language.');
    }

    const updatedGuide = await this.prisma.guideProfile.update({
      where: { id: guide.id },
      data: {
        city: matchedCity.name,
        bio: input.bio?.trim() || null,
        hourlyRate: input.hourlyRate ?? null,
        languages,
        specialties,
        verificationStatus: GuideVerificationStatus.PENDING,
        isVerified: false,
        isAvailable: false,
        acceptingBookings: false,
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        reviews: {
          select: {
            rating: true,
            comment: true,
            createdAt: true,
          },
        },
        availabilityBlocks: {
          orderBy: {
            startAt: 'asc',
          },
        },
      },
    });

    return {
      item: this.serializeGuideWithProfileImage(updatedGuide),
    };
  }

  async updateBookingPreference(userId: string, acceptingBookings: boolean) {
    const guide = await this.prisma.guideProfile.findUnique({
      where: { userId },
    });

    if (!guide) {
      throw new NotFoundException('Guide profile not found.');
    }

    if (
      acceptingBookings &&
      (!guide.isVerified ||
        guide.verificationStatus !== GuideVerificationStatus.APPROVED)
    ) {
      throw new BadRequestException(
        'Only approved guides can start accepting bookings.',
      );
    }

    const updatedGuide = await this.prisma.guideProfile.update({
      where: { id: guide.id },
      data: {
        acceptingBookings,
        isAvailable:
          acceptingBookings &&
          guide.isVerified &&
          guide.verificationStatus === GuideVerificationStatus.APPROVED,
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        reviews: {
          select: {
            rating: true,
            comment: true,
            createdAt: true,
          },
        },
        availabilityBlocks: {
          orderBy: {
            startAt: 'asc',
          },
        },
      },
    });

    return {
      item: this.serializeGuideWithProfileImage(updatedGuide),
    };
  }

  async getAvailabilityBlocks(userId: string) {
    const guide = await this.prisma.guideProfile.findUnique({
      where: { userId },
      select: {
        id: true,
      },
    });

    if (!guide) {
      throw new NotFoundException('Guide profile not found.');
    }

    const blocks = await this.prisma.guideAvailabilityBlock.findMany({
      where: {
        guideProfileId: guide.id,
      },
      orderBy: {
        startAt: 'asc',
      },
    });

    return {
      items: blocks.map((block) => this.serializeAvailabilityBlock(block)),
    };
  }

  async createAvailabilityBlock(
    userId: string,
    input: CreateGuideAvailabilityBlockDto,
  ) {
    const guide = await this.prisma.guideProfile.findUnique({
      where: { userId },
      select: {
        id: true,
      },
    });

    if (!guide) {
      throw new NotFoundException('Guide profile not found.');
    }

    const { startAt, endAt } = this.parseDateRange(input.startAt, input.endAt);

    await this.assertNoActiveBookingConflict(guide.id, startAt, endAt);

    const block = await this.prisma.guideAvailabilityBlock.create({
      data: {
        guideProfileId: guide.id,
        startAt,
        endAt,
        reason: input.reason?.trim() || null,
      },
    });

    return {
      item: this.serializeAvailabilityBlock(block),
    };
  }

  async deleteAvailabilityBlock(userId: string, blockId: string) {
    const guide = await this.prisma.guideProfile.findUnique({
      where: { userId },
      select: {
        id: true,
      },
    });

    if (!guide) {
      throw new NotFoundException('Guide profile not found.');
    }

    const block = await this.prisma.guideAvailabilityBlock.findUnique({
      where: { id: blockId },
    });

    if (!block || block.guideProfileId !== guide.id) {
      throw new NotFoundException('Availability block not found.');
    }

    await this.prisma.guideAvailabilityBlock.delete({
      where: { id: blockId },
    });

    return {
      success: true,
    };
  }

  async getAvailability(id: string, startAtRaw: string, endAtRaw: string) {
    const { startAt, endAt } = this.parseDateRange(startAtRaw, endAtRaw);

    const guide = await this.prisma.guideProfile.findUnique({
      where: { id },
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
      throw new NotFoundException('Guide not found.');
    }

    if (!guide.acceptingBookings || !guide.isAvailable) {
      return {
        item: {
          guideProfileId: id,
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
          isAvailable: false,
          reason: 'Guide is not accepting bookings right now.',
        },
      };
    }

    if (guide.availabilityBlocks.length > 0) {
      return {
        item: {
          guideProfileId: id,
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
          isAvailable: false,
          reason:
            guide.availabilityBlocks[0]?.reason?.trim() ||
            'Guide is unavailable for the selected slot.',
        },
      };
    }

    const conflictCount = await this.countActiveBookingConflicts(
      id,
      startAt,
      endAt,
    );

    return {
      item: {
        guideProfileId: id,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        isAvailable: conflictCount === 0,
        reason:
          conflictCount === 0
            ? null
            : 'Guide already has another booking in the selected time slot.',
      },
    };
  }

  async findOne(id: string) {
    const guide = await this.prisma.guideProfile.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        reviews: {
          select: {
            rating: true,
            comment: true,
            createdAt: true,
          },
        },
        availabilityBlocks: {
          where: {
            endAt: {
              gte: new Date(),
            },
          },
          orderBy: {
            startAt: 'asc',
          },
          take: 8,
        },
      },
    });

    if (!guide) {
      throw new NotFoundException('Guide not found.');
    }

    if (guide.verificationStatus !== GuideVerificationStatus.APPROVED) {
      throw new NotFoundException('Guide not found.');
    }

    return {
      item: this.serializeGuide(guide),
    };
  }

  async updateVerification(id: string, status: GuideVerificationStatus) {
    if (status === GuideVerificationStatus.PENDING) {
      throw new BadRequestException(
        'Admin updates must use APPROVED or REJECTED.',
      );
    }

    const guide = await this.prisma.guideProfile.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        reviews: {
          select: {
            rating: true,
          },
        },
      },
    });

    if (!guide) {
      throw new NotFoundException('Guide not found.');
    }

    const updatedGuide = await this.prisma.guideProfile.update({
      where: { id },
      data: {
        verificationStatus: status,
        isVerified: status === GuideVerificationStatus.APPROVED,
        isAvailable: status === GuideVerificationStatus.APPROVED,
        acceptingBookings: status === GuideVerificationStatus.APPROVED,
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        reviews: {
          select: {
            rating: true,
          },
        },
      },
    });

    return {
      item: this.serializeGuide(updatedGuide),
    };
  }

  private parseDateRange(startAtRaw: string, endAtRaw: string) {
    const startAt = new Date(startAtRaw);
    const endAt = new Date(endAtRaw);

    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
      throw new BadRequestException('Provide a valid availability range.');
    }

    if (endAt <= startAt) {
      throw new BadRequestException('End time must be after start time.');
    }

    return { startAt, endAt };
  }

  private async assertNoActiveBookingConflict(
    guideProfileId: string,
    startAt: Date,
    endAt: Date,
  ) {
    const conflicts = await this.countActiveBookingConflicts(
      guideProfileId,
      startAt,
      endAt,
    );

    if (conflicts > 0) {
      throw new BadRequestException(
        'This slot overlaps with an active booking.',
      );
    }
  }

  private async countActiveBookingConflicts(
    guideProfileId: string,
    startAt: Date,
    endAt: Date,
  ) {
    return this.prisma.booking.count({
      where: {
        guideProfileId,
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
  }

  private resolvePublicAvailability(guide: {
    verificationStatus: GuideVerificationStatus;
    isVerified: boolean;
    isAvailable: boolean;
    acceptingBookings: boolean;
  }) {
    return (
      guide.verificationStatus === GuideVerificationStatus.APPROVED &&
      guide.isVerified &&
      guide.isAvailable &&
      guide.acceptingBookings
    );
  }

  private serializeGuide(guide: {
    id: string;
    city: string;
    languages: string[];
    specialties: string[];
    bio: string | null;
    hourlyRate: number | null;
    verificationStatus: GuideVerificationStatus;
    isVerified: boolean;
    isAvailable: boolean;
    acceptingBookings: boolean;
    createdAt?: Date;
    user: { id: string; fullName: string; email: string; role?: string };
    reviews: Array<{
      rating: number;
      comment?: string | null;
      createdAt?: Date;
    }>;
    availabilityBlocks?: AvailabilityBlockRecord[];
  }) {
    const reviewCount = guide.reviews.length;
    const averageRating =
      reviewCount === 0
        ? null
        : Number(
            (
              guide.reviews.reduce((sum, review) => sum + review.rating, 0) /
              reviewCount
            ).toFixed(1),
          );

    return {
      id: guide.id,
      city: guide.city,
      languages: guide.languages,
      specialties: guide.specialties,
      bio: guide.bio,
      hourlyRate: guide.hourlyRate,
      verificationStatus: guide.verificationStatus,
      isVerified: guide.isVerified,
      isAvailable: this.resolvePublicAvailability(guide),
      acceptingBookings: guide.acceptingBookings,
      createdAt: guide.createdAt?.toISOString(),
      reviewCount,
      averageRating,
      user: guide.user,
      reviews: guide.reviews.map((review) => ({
        rating: review.rating,
        comment: review.comment ?? null,
        createdAt: review.createdAt?.toISOString(),
      })),
      availabilityBlocks: guide.availabilityBlocks?.map((block) =>
        this.serializeAvailabilityBlock(block),
      ),
    };
  }

  private serializeGuideWithProfileImage(guide: {
    id: string;
    city: string;
    languages: string[];
    specialties: string[];
    bio: string | null;
    hourlyRate: number | null;
    verificationStatus: GuideVerificationStatus;
    isVerified: boolean;
    isAvailable: boolean;
    acceptingBookings: boolean;
    createdAt?: Date;
    passportPhotoBase64?: string | null;
    passportPhotoMimeType?: string | null;
    user: { id: string; fullName: string; email: string; role?: string };
    reviews: Array<{
      rating: number;
      comment?: string | null;
      createdAt?: Date;
    }>;
    availabilityBlocks?: AvailabilityBlockRecord[];
  }) {
    return {
      ...this.serializeGuide(guide),
      profileImageBase64: guide.passportPhotoBase64 ?? null,
      profileImageMimeType: guide.passportPhotoMimeType ?? null,
    };
  }

  private serializeGuideForAdmin(guide: {
    id: string;
    city: string;
    languages: string[];
    specialties: string[];
    bio: string | null;
    hourlyRate: number | null;
    verificationStatus: GuideVerificationStatus;
    isVerified: boolean;
    isAvailable: boolean;
    acceptingBookings: boolean;
    createdAt?: Date;
    aadhaarNumber: string | null;
    panNumber: string | null;
    aadhaarImageBase64: string | null;
    aadhaarImageMimeType: string | null;
    panImageBase64: string | null;
    panImageMimeType: string | null;
    passportPhotoBase64: string | null;
    passportPhotoMimeType: string | null;
    user: { id: string; fullName: string; email: string; role?: string };
    reviews: Array<{
      rating: number;
      comment?: string | null;
      createdAt?: Date;
    }>;
  }) {
    return {
      ...this.serializeGuide(guide),
      kyc: {
        aadhaarNumber: guide.aadhaarNumber ?? null,
        panNumber: guide.panNumber ?? null,
        aadhaarImageBase64: guide.aadhaarImageBase64 ?? null,
        aadhaarImageMimeType: guide.aadhaarImageMimeType ?? null,
        panImageBase64: guide.panImageBase64 ?? null,
        panImageMimeType: guide.panImageMimeType ?? null,
        passportPhotoBase64: guide.passportPhotoBase64 ?? null,
        passportPhotoMimeType: guide.passportPhotoMimeType ?? null,
      },
    };
  }

  private serializeAvailabilityBlock(block: AvailabilityBlockRecord) {
    return {
      id: block.id,
      startAt: block.startAt.toISOString(),
      endAt: block.endAt.toISOString(),
      reason: block.reason ?? null,
      createdAt: block.createdAt.toISOString(),
      updatedAt: block.updatedAt.toISOString(),
    };
  }
}
