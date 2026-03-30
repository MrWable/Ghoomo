import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GuideVerificationStatus } from '@ghoomo/db';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCityDto, CreateCityPlaceDto } from './dto/create-city.dto';
import { UpdateCityImageDto } from './dto/update-city-image.dto';
import { UpdateCityPlacesDto } from './dto/update-city-places.dto';

const MAX_IMAGE_BASE64_LENGTH = 5_000_000;
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/svg+xml',
]);

type GuideStatsMap = Map<
  string,
  {
    guideCount: number;
    startingRate: number | null;
  }
>;

type CityRecord = {
  id: string;
  name: string;
  slug: string;
  summary: string | null;
  imageBase64: string;
  imageMimeType: string;
  isActive: boolean;
  createdAt: Date;
  places?: Array<{
    id: string;
    name: string;
    slug: string;
    summary: string | null;
    imageBase64: string;
    imageMimeType: string;
    displayOrder: number;
  }>;
  _count?: {
    places: number;
  };
};

@Injectable()
export class CitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const [cities, guideStats] = await Promise.all([
      this.prisma.city.findMany({
        where: {
          isActive: true,
        },
        orderBy: [{ createdAt: 'desc' }],
        include: {
          _count: {
            select: {
              places: true,
            },
          },
        },
      }),
      this.loadGuideStats(),
    ]);

    return {
      items: cities
        .map((city) => this.serializeCity(city, guideStats))
        .sort((left, right) => {
          if (right.guideCount !== left.guideCount) {
            return right.guideCount - left.guideCount;
          }

          return left.name.localeCompare(right.name);
        }),
    };
  }

  async findForAdmin() {
    const [cities, guideStats] = await Promise.all([
      this.prisma.city.findMany({
        orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
        include: {
          _count: {
            select: {
              places: true,
            },
          },
        },
      }),
      this.loadGuideStats(),
    ]);

    return {
      items: cities.map((city) => this.serializeCity(city, guideStats)),
    };
  }

  async create(input: CreateCityDto) {
    const name = input.name.trim();
    const slug = this.toSlug(name);

    if (!slug) {
      throw new BadRequestException('City name is invalid.');
    }

    const imageBase64 = this.normalizeBase64(input.imageBase64);
    this.validateImage(input.imageMimeType, imageBase64);
    const places = this.normalizePlaces(input.places);

    const existingCity = await this.prisma.city.findUnique({
      where: { slug },
    });

    if (existingCity) {
      throw new ConflictException('City already exists.');
    }

    const city = await this.prisma.city.create({
      data: {
        name,
        slug,
        summary: input.summary?.trim() || null,
        imageBase64,
        imageMimeType: input.imageMimeType,
        isActive: input.isActive ?? true,
        places: places.length
          ? {
              create: places.map((place, index) => ({
                name: place.name,
                slug: place.slug,
                summary: place.summary,
                imageBase64: place.imageBase64,
                imageMimeType: place.imageMimeType,
                displayOrder: place.displayOrder ?? index,
              })),
            }
          : undefined,
      },
      include: {
        places: {
          orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
        },
        _count: {
          select: {
            places: true,
          },
        },
      },
    });

    const guideStats = await this.loadGuideStats();

    return {
      item: this.serializeCity(city, guideStats, true),
    };
  }

  async findOne(slug: string) {
    const [city, guideStats] = await Promise.all([
      this.prisma.city.findUnique({
        where: { slug },
        include: {
          places: {
            orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
          },
          _count: {
            select: {
              places: true,
            },
          },
        },
      }),
      this.loadGuideStats(),
    ]);

    if (!city || !city.isActive) {
      throw new NotFoundException('City not found.');
    }

    return {
      item: this.serializeCity(city, guideStats, true),
    };
  }

  async updatePlaces(id: string, input: UpdateCityPlacesDto) {
    const existingCity = await this.prisma.city.findUnique({
      where: { id },
    });

    if (!existingCity) {
      throw new NotFoundException('City not found.');
    }

    const places = this.normalizePlaces(input.places);

    const [city, guideStats] = await Promise.all([
      this.prisma.city.update({
        where: { id },
        data: {
          places: {
            deleteMany: {},
            create: places.map((place, index) => ({
              name: place.name,
              slug: place.slug,
              summary: place.summary,
              imageBase64: place.imageBase64,
              imageMimeType: place.imageMimeType,
              displayOrder: place.displayOrder ?? index,
            })),
          },
        },
        include: {
          places: {
            orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
          },
          _count: {
            select: {
              places: true,
            },
          },
        },
      }),
      this.loadGuideStats(),
    ]);

    return {
      item: this.serializeCity(city, guideStats, true),
    };
  }

  async updateImage(id: string, input: UpdateCityImageDto) {
    const existingCity = await this.prisma.city.findUnique({
      where: { id },
    });

    if (!existingCity) {
      throw new NotFoundException('City not found.');
    }

    const imageBase64 = this.normalizeBase64(input.imageBase64);
    this.validateImage(input.imageMimeType, imageBase64);

    const [city, guideStats] = await Promise.all([
      this.prisma.city.update({
        where: { id },
        data: {
          imageBase64,
          imageMimeType: input.imageMimeType,
        },
        include: {
          places: {
            orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
          },
          _count: {
            select: {
              places: true,
            },
          },
        },
      }),
      this.loadGuideStats(),
    ]);

    return {
      item: this.serializeCity(city, guideStats, true),
    };
  }

  private async loadGuideStats() {
    const guides = await this.prisma.guideProfile.findMany({
      where: {
        verificationStatus: GuideVerificationStatus.APPROVED,
      },
      select: {
        city: true,
        hourlyRate: true,
      },
    });

    return guides.reduce<GuideStatsMap>((stats, guide) => {
      const key = this.normalizeCityKey(guide.city);
      const current = stats.get(key) ?? {
        guideCount: 0,
        startingRate: null,
      };

      current.guideCount += 1;

      if (
        guide.hourlyRate &&
        (!current.startingRate || guide.hourlyRate < current.startingRate)
      ) {
        current.startingRate = guide.hourlyRate;
      }

      stats.set(key, current);
      return stats;
    }, new Map());
  }

  private serializeCity(
    city: CityRecord,
    guideStats: GuideStatsMap,
    includePlaces = false,
  ) {
    const cityStats = guideStats.get(this.normalizeCityKey(city.name)) ?? {
      guideCount: 0,
      startingRate: null,
    };

    const serializedCity = {
      id: city.id,
      name: city.name,
      slug: city.slug,
      summary: city.summary,
      imageBase64: city.imageBase64,
      imageMimeType: city.imageMimeType,
      isActive: city.isActive,
      createdAt: city.createdAt.toISOString(),
      guideCount: cityStats.guideCount,
      startingRate: cityStats.startingRate,
      placeCount: city._count?.places ?? city.places?.length ?? 0,
    };

    if (!includePlaces) {
      return serializedCity;
    }

    return {
      ...serializedCity,
      places:
        city.places?.map((place) => ({
          id: place.id,
          name: place.name,
          slug: place.slug,
          summary: place.summary,
          imageBase64: place.imageBase64,
          imageMimeType: place.imageMimeType,
          displayOrder: place.displayOrder,
        })) ?? [],
    };
  }

  private normalizeBase64(value: string) {
    const trimmedValue = value.trim();
    const payload = trimmedValue.includes(',')
      ? trimmedValue.slice(trimmedValue.indexOf(',') + 1)
      : trimmedValue;

    return payload.replace(/\s+/g, '');
  }

  private validateImage(mimeType: string, imageBase64: string) {
    if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
      throw new BadRequestException('Image type is not supported.');
    }

    if (imageBase64.length > MAX_IMAGE_BASE64_LENGTH) {
      throw new BadRequestException('Image is too large.');
    }
  }

  private normalizePlaces(inputPlaces?: CreateCityPlaceDto[]) {
    if (!inputPlaces?.length) {
      return [];
    }

    const seenSlugs = new Set<string>();

    return inputPlaces.map((place, index) => {
      const name = place.name.trim();
      const slug = this.toSlug(name);

      if (!slug) {
        throw new BadRequestException('Place name is invalid.');
      }

      if (seenSlugs.has(slug)) {
        throw new BadRequestException(
          'Place names must be unique within a city.',
        );
      }

      seenSlugs.add(slug);

      const imageBase64 = this.normalizeBase64(place.imageBase64);
      this.validateImage(place.imageMimeType, imageBase64);

      return {
        name,
        slug,
        summary: place.summary?.trim() || null,
        imageBase64,
        imageMimeType: place.imageMimeType,
        displayOrder: place.displayOrder ?? index,
      };
    });
  }

  private normalizeCityKey(value: string) {
    return value.trim().toLowerCase();
  }

  private toSlug(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
