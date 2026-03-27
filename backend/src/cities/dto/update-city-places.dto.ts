import { ArrayMaxSize, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateCityPlaceDto } from './create-city.dto';

export class UpdateCityPlacesDto {
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => CreateCityPlaceDto)
  places!: CreateCityPlaceDto[];
}
