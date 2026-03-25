import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { GuideVerificationStatus, UserRole } from '@ghoomo/db';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { ReviewGuidesQueryDto } from './dto/review-guides-query.dto';
import { UpdateGuideVerificationDto } from './dto/update-guide-verification.dto';
import { GuidesService } from './guides.service';

@Controller('guides')
export class GuidesController {
  constructor(private readonly guidesService: GuidesService) {}

  @Public()
  @Get()
  findAll(@Query('city') city?: string) {
    return this.guidesService.findAll(city);
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
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.guidesService.findOne(id);
  }
}
