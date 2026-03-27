import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GuideVerificationStatus } from '@ghoomo/db';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateMyGuideDto } from './dto/update-my-guide.dto';

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
      },
    });

    return {
      item: this.serializeGuideWithProfileImage(updatedGuide),
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
    user: { id: string; fullName: string; email: string; role?: string };
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
    createdAt?: Date;
    passportPhotoBase64?: string | null;
    passportPhotoMimeType?: string | null;
    user: { id: string; fullName: string; email: string; role?: string };
    reviews: Array<{
      rating: number;
      comment?: string | null;
      createdAt?: Date;
    }>;
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
}
