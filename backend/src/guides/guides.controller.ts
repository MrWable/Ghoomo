import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { GuideVerificationStatus, UserRole } from '@ghoomo/db';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { CheckGuideAvailabilityQueryDto } from './dto/check-guide-availability-query.dto';
import { CreateGuideAvailabilityBlockDto } from './dto/create-guide-availability-block.dto';
import { ReviewGuidesQueryDto } from './dto/review-guides-query.dto';
import { UpdateGuideBookingPreferenceDto } from './dto/update-guide-booking-preference.dto';
import { UpdateMyGuideDto } from './dto/update-my-guide.dto';
import { UpdateGuideVerificationDto } from './dto/update-guide-verification.dto';
import { GuidesService } from './guides.service';
import type { AuthenticatedUser } from '../auth/auth.types';

@Controller('guides')
export class GuidesController {
  constructor(private readonly guidesService: GuidesService) {}

  @Public()
  @Get()
  findAll(@Query('city') city?: string) {
    return this.guidesService.findAll(city);
  }

  @Roles(UserRole.USER, UserRole.TOURIST, UserRole.GUIDE, UserRole.ADMIN)
  @Get('discover')
  findForLoggedInCity(@Query('city') city?: string) {
    return this.guidesService.findForLoggedInCity(city);
  }

  @Roles(UserRole.GUIDE)
  @Get('me')
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.guidesService.findMine(user.id);
  }

  @Roles(UserRole.GUIDE)
  @Patch('me')
  updateMine(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: UpdateMyGuideDto,
  ) {
    return this.guidesService.updateMine(user.id, input);
  }

  @Roles(UserRole.GUIDE)
  @Patch('me/booking-preference')
  updateBookingPreference(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: UpdateGuideBookingPreferenceDto,
  ) {
    return this.guidesService.updateBookingPreference(
      user.id,
      input.acceptingBookings,
    );
  }

  @Roles(UserRole.GUIDE)
  @Get('me/availability-blocks')
  getAvailabilityBlocks(@CurrentUser() user: AuthenticatedUser) {
    return this.guidesService.getAvailabilityBlocks(user.id);
  }

  @Roles(UserRole.GUIDE)
  @Post('me/availability-blocks')
  createAvailabilityBlock(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: CreateGuideAvailabilityBlockDto,
  ) {
    return this.guidesService.createAvailabilityBlock(user.id, input);
  }

  @Roles(UserRole.GUIDE)
  @Delete('me/availability-blocks/:blockId')
  deleteAvailabilityBlock(
    @CurrentUser() user: AuthenticatedUser,
    @Param('blockId') blockId: string,
  ) {
    return this.guidesService.deleteAvailabilityBlock(user.id, blockId);
  }

  @Roles(UserRole.ADMIN)
  @Get('admin/review')
  findForReview(@Query() query: ReviewGuidesQueryDto) {
    return this.guidesService.findForReview(
      query.status ?? GuideVerificationStatus.PENDING,
    );
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id/verification')
  updateVerification(
    @Param('id') id: string,
    @Body() input: UpdateGuideVerificationDto,
  ) {
    return this.guidesService.updateVerification(id, input.status);
  }

  @Public()
  @Get(':id/availability')
  getAvailability(
    @Param('id') id: string,
    @Query() query: CheckGuideAvailabilityQueryDto,
  ) {
    return this.guidesService.getAvailability(id, query.startAt, query.endAt);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.guidesService.findOne(id);
  }
}
