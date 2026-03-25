import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { GuideVerificationStatus, UserRole } from '@ghoomo/db';
import { compare, hash } from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthenticatedUser } from './auth.types';

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
        fullName: input.fullName,
        email: input.email.toLowerCase(),
        passwordHash,
        phone: input.phone,
        role: input.role,
        guideProfile:
          input.role === UserRole.GUIDE
            ? {
                create: {
                  city: input.city ?? 'TBD',
                  bio: input.bio,
                  hourlyRate: input.hourlyRate,
                  languages:
                    input.languages && input.languages.length > 0
                      ? input.languages
                      : ['English'],
                  specialties: input.specialties ?? [],
                  verificationStatus: GuideVerificationStatus.PENDING,
                  isVerified: false,
                  isAvailable: true,
                },
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
}
