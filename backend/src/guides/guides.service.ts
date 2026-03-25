import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GuideVerificationStatus } from '@ghoomo/db';
import { PrismaService } from '../prisma/prisma.service';

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
      items: guides.map((guide) => this.serializeGuide(guide)),
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
    createdAt?: Date;
    user: { id: string; fullName: string; email: string };
    reviews: Array<{
      rating: number;
      comment?: string | null;
      createdAt?: Date;
    }>;
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
      isAvailable: guide.isAvailable,
      createdAt: guide.createdAt?.toISOString(),
      reviewCount,
      averageRating,
      user: guide.user,
      reviews: guide.reviews.map((review) => ({
        rating: review.rating,
        comment: review.comment ?? null,
        createdAt: review.createdAt?.toISOString(),
      })),
    };
  }
}
