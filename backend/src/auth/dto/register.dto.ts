import { UserRole } from '@ghoomo/db';
import {
  ArrayUnique,
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(3)
  fullName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsEnum(UserRole)
  role: UserRole = UserRole.USER;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  hourlyRate?: number;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  languages?: string[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  specialties?: string[];

  @IsOptional()
  @IsString()
  aadhaarNumber?: string;

  @IsOptional()
  @IsString()
  panNumber?: string;

  @IsOptional()
  @IsString()
  aadhaarImageBase64?: string;

  @IsOptional()
  @IsString()
  aadhaarImageMimeType?: string;

  @IsOptional()
  @IsString()
  panImageBase64?: string;

  @IsOptional()
  @IsString()
  panImageMimeType?: string;

  @IsOptional()
  @IsString()
  passportPhotoBase64?: string;

  @IsOptional()
  @IsString()
  passportPhotoMimeType?: string;
}
