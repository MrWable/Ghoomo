import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { GuideVerificationStatus, UserRole } from '@ghoomo/db';
import { compare, hash } from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleLoginDto } from './dto/google-login.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthenticatedUser } from './auth.types';

const MAX_IMAGE_BASE64_LENGTH = 5_000_000;
const ALLOWED_DOCUMENT_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

type UserWithGuideProfile = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  guideProfile: {
    id: string;
  } | null;
};

@Injectable()
export class AuthService {
  private readonly googleClient = new OAuth2Client();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(input: RegisterDto) {
    if (input.role === UserRole.ADMIN) {
      throw new BadRequestException('Admin accounts are not self-service.');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });

    if (existingUser) {
      throw new BadRequestException('Email is already registered.');
    }

    const passwordHash = await hash(input.password, 10);

    const user = await this.prisma.user.create({
      data: {
        fullName: input.fullName.trim(),
        email: input.email.toLowerCase(),
        passwordHash,
        phone: input.phone?.trim() || undefined,
        role: input.role,
        guideProfile:
          input.role === UserRole.GUIDE
            ? {
                create: this.buildGuideProfileInput(input),
              }
            : undefined,
      },
      include: {
        guideProfile: true,
      },
    });

    return this.buildAuthResponse(user);
  }

  async login(input: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
      include: {
        guideProfile: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const passwordMatches = await compare(input.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    return this.buildAuthResponse(user);
  }

  async loginWithGoogle(input: GoogleLoginDto) {
    const googleClientId = this.getGoogleClientId();

    if (!googleClientId) {
      throw new BadRequestException('Google login is not configured.');
    }

    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken: input.credential,
        audience: googleClientId,
      });
      const payload = ticket.getPayload();

      if (!payload?.email || payload.email_verified !== true) {
        throw new UnauthorizedException('Google email is not verified.');
      }

      const normalizedEmail = payload.email.toLowerCase();
      const existingUser = await this.prisma.user.findUnique({
        where: { email: normalizedEmail },
        include: {
          guideProfile: true,
        },
      });

      if (existingUser) {
        return this.buildAuthResponse(existingUser);
      }

      const passwordHash = await hash(randomBytes(32).toString('hex'), 10);
      const user = await this.prisma.user.create({
        data: {
          fullName: this.resolveGoogleFullName(payload.name, normalizedEmail),
          email: normalizedEmail,
          passwordHash,
          role: UserRole.USER,
        },
        include: {
          guideProfile: true,
        },
      });

      return this.buildAuthResponse(user);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException('Google login failed.');
    }
  }

  async validateToken(token: string): Promise<AuthenticatedUser> {
    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
      }>(token, {
        secret: this.getJwtSecret(),
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: {
          guideProfile: true,
        },
      });

      if (!user) {
        throw new UnauthorizedException('User not found.');
      }

      return this.toAuthenticatedUser(user);
    } catch {
      throw new UnauthorizedException('Invalid or expired token.');
    }
  }

  async findUsersForAdmin() {
    const users = await this.prisma.user.findMany({
      orderBy: [{ createdAt: 'desc' }],
      include: {
        guideProfile: {
          include: {
            reviews: {
              select: {
                rating: true,
                comment: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });

    return {
      items: users.map((user) => this.serializeAdminUser(user)),
    };
  }

  private buildAuthResponse(user: UserWithGuideProfile) {
    const authUser = this.toAuthenticatedUser(user);

    return {
      accessToken: this.jwtService.sign(
        {
          sub: authUser.id,
          role: authUser.role,
          guideProfileId: authUser.guideProfileId,
        },
        {
          secret: this.getJwtSecret(),
          expiresIn: '7d',
        },
      ),
      user: authUser,
    };
  }

  private toAuthenticatedUser(user: UserWithGuideProfile): AuthenticatedUser {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      guideProfileId: user.guideProfile?.id ?? null,
    };
  }

  private getJwtSecret() {
    return (
      this.configService.get<string>('JWT_SECRET') ?? 'change-me-in-local-env'
    );
  }

  private getGoogleClientId() {
    return this.configService.get<string>('GOOGLE_CLIENT_ID')?.trim() ?? '';
  }

  private resolveGoogleFullName(
    name: string | null | undefined,
    email: string,
  ) {
    const trimmedName = name?.trim();

    if (trimmedName) {
      return trimmedName;
    }

    const localPart = email
      .split('@')[0]
      ?.replace(/[._-]+/g, ' ')
      .trim();

    if (!localPart) {
      return 'Ghoomo User';
    }

    return localPart.replace(/\b\w/g, (character) => character.toUpperCase());
  }

  private serializeAdminUser(user: {
    id: string;
    fullName: string;
    email: string;
    phone: string | null;
    role: UserRole;
    createdAt: Date;
    updatedAt: Date;
    guideProfile: {
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
      createdAt: Date;
      aadhaarNumber: string | null;
      panNumber: string | null;
      aadhaarImageBase64: string | null;
      aadhaarImageMimeType: string | null;
      panImageBase64: string | null;
      panImageMimeType: string | null;
      passportPhotoBase64: string | null;
      passportPhotoMimeType: string | null;
      reviews: Array<{
        rating: number;
        comment: string | null;
        createdAt: Date;
      }>;
    } | null;
  }) {
    const reviewCount = user.guideProfile?.reviews.length ?? 0;
    const isGuideAvailable = user.guideProfile
      ? user.guideProfile.verificationStatus ===
          GuideVerificationStatus.APPROVED &&
        user.guideProfile.isVerified &&
        user.guideProfile.isAvailable &&
        user.guideProfile.acceptingBookings
      : false;
    const averageRating =
      reviewCount === 0
        ? null
        : Number(
            (
              user.guideProfile!.reviews.reduce(
                (sum, review) => sum + review.rating,
                0,
              ) / reviewCount
            ).toFixed(1),
          );

    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone ?? null,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      guideProfile: user.guideProfile
        ? {
            id: user.guideProfile.id,
            city: user.guideProfile.city,
            languages: user.guideProfile.languages,
            specialties: user.guideProfile.specialties,
            bio: user.guideProfile.bio,
            hourlyRate: user.guideProfile.hourlyRate,
            verificationStatus: user.guideProfile.verificationStatus,
            isVerified: user.guideProfile.isVerified,
            isAvailable: isGuideAvailable,
            acceptingBookings: user.guideProfile.acceptingBookings,
            createdAt: user.guideProfile.createdAt.toISOString(),
            reviewCount,
            averageRating,
            kyc: {
              aadhaarNumber: user.guideProfile.aadhaarNumber ?? null,
              panNumber: user.guideProfile.panNumber ?? null,
              aadhaarImageBase64: user.guideProfile.aadhaarImageBase64 ?? null,
              aadhaarImageMimeType:
                user.guideProfile.aadhaarImageMimeType ?? null,
              panImageBase64: user.guideProfile.panImageBase64 ?? null,
              panImageMimeType: user.guideProfile.panImageMimeType ?? null,
              passportPhotoBase64:
                user.guideProfile.passportPhotoBase64 ?? null,
              passportPhotoMimeType:
                user.guideProfile.passportPhotoMimeType ?? null,
            },
          }
        : null,
    };
  }

  private buildGuideProfileInput(input: RegisterDto) {
    const city = input.city?.trim();
    const normalizedLanguages = (input.languages ?? [])
      .map((language) => language.trim())
      .filter(Boolean);
    const specialties = (input.specialties ?? [])
      .map((specialty) => specialty.trim())
      .filter(Boolean);
    const documents = this.normalizeGuideDocuments(input);

    if (!city) {
      throw new BadRequestException('City is required for guide registration.');
    }

    return {
      city,
      languages:
        normalizedLanguages.length > 0 ? normalizedLanguages : ['English'],
      bio: input.bio?.trim() || undefined,
      hourlyRate: input.hourlyRate,
      specialties,
      verificationStatus: GuideVerificationStatus.PENDING,
      isVerified: false,
      isAvailable: false,
      acceptingBookings: false,
      ...documents,
    };
  }

  private normalizeGuideDocuments(input: RegisterDto) {
    const aadhaarNumber = input.aadhaarNumber?.replace(/\D/g, '') || undefined;
    const panNumber = input.panNumber?.trim().toUpperCase() || undefined;

    if (aadhaarNumber && !/^\d{12}$/.test(aadhaarNumber)) {
      throw new BadRequestException('Aadhaar number must be 12 digits.');
    }

    if (panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(panNumber)) {
      throw new BadRequestException('PAN number format is invalid.');
    }

    const aadhaarImage = this.normalizeDocumentImage(
      'Aadhaar card',
      input.aadhaarImageMimeType,
      input.aadhaarImageBase64,
    );
    const panImage = this.normalizeDocumentImage(
      'PAN card',
      input.panImageMimeType,
      input.panImageBase64,
    );
    const passportPhoto = this.normalizeDocumentImage(
      'Passport photo',
      input.passportPhotoMimeType,
      input.passportPhotoBase64,
    );

    return {
      aadhaarNumber,
      panNumber,
      aadhaarImageBase64: aadhaarImage?.base64,
      aadhaarImageMimeType: aadhaarImage?.mimeType,
      panImageBase64: panImage?.base64,
      panImageMimeType: panImage?.mimeType,
      passportPhotoBase64: passportPhoto?.base64,
      passportPhotoMimeType: passportPhoto?.mimeType,
    };
  }

  private normalizeDocumentImage(
    label: string,
    mimeType?: string,
    base64?: string,
  ) {
    const normalizedMimeType = mimeType?.trim().toLowerCase();
    const normalizedBase64 = base64?.trim();

    if (!normalizedMimeType && !normalizedBase64) {
      return undefined;
    }

    if (!normalizedMimeType || !normalizedBase64) {
      throw new BadRequestException(`${label} image is incomplete.`);
    }

    if (!ALLOWED_DOCUMENT_MIME_TYPES.has(normalizedMimeType)) {
      throw new BadRequestException(
        `${label} image must be PNG, JPG, or WEBP.`,
      );
    }

    if (normalizedBase64.length > MAX_IMAGE_BASE64_LENGTH) {
      throw new BadRequestException(`${label} image is too large.`);
    }

    return {
      mimeType: normalizedMimeType,
      base64: normalizedBase64,
    };
  }
}
