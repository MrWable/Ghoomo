import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/svg+xml',
] as const;

export class CreateCityPlaceDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(220)
  summary?: string;

  @IsString()
  @MinLength(32)
  @MaxLength(5_000_000)
  imageBase64!: string;

  @IsString()
  @IsIn(ALLOWED_IMAGE_TYPES)
  imageMimeType!: (typeof ALLOWED_IMAGE_TYPES)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  displayOrder?: number;
}

export class CreateCityDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(220)
  summary?: string;

  @IsString()
  @MinLength(32)
  @MaxLength(5_000_000)
  imageBase64!: string;

  @IsString()
  @IsIn(ALLOWED_IMAGE_TYPES)
  imageMimeType!: (typeof ALLOWED_IMAGE_TYPES)[number];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => CreateCityPlaceDto)
  places?: CreateCityPlaceDto[];
}
