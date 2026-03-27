import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { UserRole } from '@ghoomo/db';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CitiesService } from './cities.service';
import { CreateCityDto } from './dto/create-city.dto';
import { UpdateCityImageDto } from './dto/update-city-image.dto';
import { UpdateCityPlacesDto } from './dto/update-city-places.dto';

@Controller('cities')
export class CitiesController {
  constructor(private readonly citiesService: CitiesService) {}

  @Public()
  @Get()
  findAll() {
    return this.citiesService.findAll();
  }

  @Roles(UserRole.ADMIN)
  @Get('admin')
  findForAdmin() {
    return this.citiesService.findForAdmin();
  }

  @Public()
  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.citiesService.findOne(slug);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id/image')
  updateImage(@Param('id') id: string, @Body() input: UpdateCityImageDto) {
    return this.citiesService.updateImage(id, input);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id/places')
  updatePlaces(@Param('id') id: string, @Body() input: UpdateCityPlacesDto) {
    return this.citiesService.updatePlaces(id, input);
  }

  @Roles(UserRole.ADMIN)
  @Post()
  create(@Body() input: CreateCityDto) {
    return this.citiesService.create(input);
  }
}
