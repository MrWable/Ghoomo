import {
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class UpdateMyGuideDto {
  @IsString()
  city!: string;

  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  languages!: string[];

  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  specialties!: string[];

  @IsOptional()
  @IsString()
  bio?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  hourlyRate?: number | null;
}
