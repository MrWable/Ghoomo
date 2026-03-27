import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { GuideVerificationStatus, UserRole } from '@ghoomo/db';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ReviewGuidesQueryDto } from './dto/review-guides-query.dto';
import { UpdateMyGuideDto } from './dto/update-my-guide.dto';
import { UpdateGuideVerificationDto } from './dto/update-guide-verification.dto';
import { GuidesService } from './guides.service';
import type { AuthenticatedUser } from '../auth/auth.types';

@Controller('guides')
export class GuidesController {
  constructor(private readonly guidesService: GuidesService) {}

  @Roles(UserRole.ADMIN)
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

  @Roles(UserRole.ADMIN)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.guidesService.findOne(id);
  }
}
