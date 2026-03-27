import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/svg+xml',
] as const;

export class UpdateCityImageDto {
  @IsString()
  @MinLength(32)
  @MaxLength(5_000_000)
  imageBase64!: string;

  @IsString()
  @IsIn(ALLOWED_IMAGE_TYPES)
  imageMimeType!: (typeof ALLOWED_IMAGE_TYPES)[number];
}
